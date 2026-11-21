// Dropbox monitoring and OAuth for Vectorio AI QC.
// This module only detects completed uploads and queues them; file QC runs in the backend milestone.
(() => {
  const ALARM = "vectorio-qc-dropbox-poll";
  const API = "https://api.dropboxapi.com/2";
  const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
  const COMPLETE_EXTS = new Set(["ai","eps","svg","pdf"]);
  const KEEP_QUEUE = 300;
  const KEEP_ACTIVITY = 100;

  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const randomString = (length=64) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(bytes, b => chars[b % chars.length]).join("");
  };
  const normalizePath = (value) => {
    let path = String(value || "").trim().replace(/\\/g,"/");
    if (!path || path === "/") return "";
    return "/" + path.split("/").filter(Boolean).join("/");
  };
  const storage = (keys) => chrome.storage.local.get(keys);
  const save = (values) => chrome.storage.local.set(values);
  async function recordActivity(item) {
    const {qcActivity=[]} = await storage(["qcActivity"]);
    await save({qcActivity:[{time:Date.now(),...item},...qcActivity].slice(0,KEEP_ACTIVITY)});
  }
  async function getFreshAccessToken() {
    const data = await storage(["qcAccessToken","qcRefreshToken","qcTokenExpiresAt","qcAppKey"]);
    if (!data.qcRefreshToken || !data.qcAppKey) throw new Error("Dropbox is not connected.");
    if (data.qcAccessToken && data.qcTokenExpiresAt > Date.now()+120000) return data.qcAccessToken;
    const body = new URLSearchParams({grant_type:"refresh_token",refresh_token:data.qcRefreshToken,client_id:data.qcAppKey});
    const response = await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error_description || result.error || "Dropbox token refresh failed.");
    await save({qcAccessToken:result.access_token,qcTokenExpiresAt:Date.now()+(result.expires_in||14400)*1000,qcDropboxConnected:true});
    return result.access_token;
  }
  async function dropboxApi(endpoint, body) {
    const token = await getFreshAccessToken();
    let response = await fetch(API+endpoint,{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});
    if (response.status === 401) {
      await save({qcTokenExpiresAt:0});
      const fresh = await getFreshAccessToken();
      response = await fetch(API+endpoint,{method:"POST",headers:{"Authorization":"Bearer "+fresh,"Content-Type":"application/json"},body:JSON.stringify(body)});
    }
    const result = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(result.error_summary || result.error || "Dropbox API request failed ("+response.status+").");
    return result;
  }
  async function connectDropbox() {
    const {qcAppKey} = await storage(["qcAppKey"]);
    if (!qcAppKey) throw new Error("Enter your Dropbox App Key in the extension settings first.");
    const redirectUri = chrome.identity.getRedirectURL("dropbox");
    const verifier = randomString(64);
    const challenge = b64url(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier)));
    const state = randomString(32);
    const params = new URLSearchParams({
      client_id:qcAppKey,response_type:"code",code_challenge:challenge,code_challenge_method:"S256",
      token_access_type:"offline",scope:"files.metadata.read files.content.read",
      redirect_uri:redirectUri,state
    });
    const authUrl = "https://www.dropbox.com/oauth2/authorize?"+params.toString();
    const redirect = await chrome.identity.launchWebAuthFlow({url:authUrl,interactive:true});
    if (!redirect) throw new Error("Dropbox authorization was cancelled.");
    const callback = new URL(redirect);
    if (callback.searchParams.get("state") !== state) throw new Error("Dropbox OAuth state did not match.");
    const authError = callback.searchParams.get("error_description") || callback.searchParams.get("error");
    if (authError) throw new Error(authError);
    const code = callback.searchParams.get("code");
    if (!code) throw new Error("Dropbox did not return an authorization code.");
    const tokenBody = new URLSearchParams({code,grant_type:"authorization_code",code_verifier:verifier,client_id:qcAppKey,redirect_uri:redirectUri});
    const response = await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:tokenBody});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error_description || result.error || "Dropbox token exchange failed.");
    await save({qcAccessToken:result.access_token,qcRefreshToken:result.refresh_token,qcTokenExpiresAt:Date.now()+(result.expires_in||14400)*1000,qcDropboxConnected:true});
    return {ok:true};
  }
  async function disconnectDropbox() {
    const {qcAccessToken} = await storage(["qcAccessToken"]);
    if (qcAccessToken) {
      try { await fetch(API+"/auth/token/revoke",{method:"POST",headers:{"Authorization":"Bearer "+qcAccessToken}}); } catch {}
    }
    await chrome.alarms.clear(ALARM);
    await chrome.storage.local.remove(["qcAccessToken","qcRefreshToken","qcTokenExpiresAt","qcDropboxConnected","qcMonitoring","qcDropboxCursor","qcQueue"]);
    return {ok:true};
  }
  function completedFile(entry, rootPath) {
    if (entry[".tag"] !== "file" || !entry.path_display) return null;
    const path = entry.path_display;
    const root = normalizePath(rootPath).toLowerCase();
    const lower = path.toLowerCase();
    if (!lower.startsWith(root ? root+"/" : "/")) return null;
    const relative = (root ? path.slice(root.length) : path).split("/").filter(Boolean);
    if (relative.length < 3 || relative[1].toLowerCase() !== "complete") return null;
    const extension = (relative[relative.length-1].split(".").pop()||"").toLowerCase();
    if (!COMPLETE_EXTS.has(extension)) return null;
    return {orderId:relative[0],path,name:relative[relative.length-1],extension,id:entry.id,rev:entry.rev,contentHash:entry.content_hash};
  }
  async function queueFile(entry, rootPath) {
    const item = completedFile(entry,rootPath);
    if (!item) return;
    const key = item.id+":"+item.rev;
    const {qcQueue=[],qcSeenRevisions=[]} = await storage(["qcQueue","qcSeenRevisions"]);
    if (qcSeenRevisions.includes(key)) return;
    const job = {...item,key,status:"QUEUED",detectedAt:Date.now()};
    const queue = [job,...qcQueue].slice(0,KEEP_QUEUE);
    const seen = [key,...qcSeenRevisions].slice(0,2000);
    await save({qcQueue:queue,qcSeenRevisions:seen});
    await recordActivity({status:"NEEDS_SETUP",label:"QUEUED",orderId:item.orderId,name:item.name,path:item.path,message:"Completed file detected. QC engine/backend setup is the next step."});
  }
  async function pollDropbox() {
    const {qcMonitoring,qcRootPath,qcDropboxCursor} = await storage(["qcMonitoring","qcRootPath","qcDropboxCursor"]);
    if (!qcMonitoring) return;
    if (!qcRootPath) throw new Error("Set the Dropbox orders root folder.");
    let result;
    if (qcDropboxCursor) {
      result = await dropboxApi("/files/list_folder/continue",{cursor:qcDropboxCursor});
    } else {
      result = await dropboxApi("/files/list_folder",{path:normalizePath(qcRootPath),recursive:true,include_deleted:false,include_non_downloadable_files:false,limit:2000});
    }
    do {
      for (const entry of result.entries||[]) await queueFile(entry,qcRootPath);
      if (result.has_more) result = await dropboxApi("/files/list_folder/continue",{cursor:result.cursor});
      else break;
    } while (true);
    if (result.cursor) await save({qcDropboxCursor:result.cursor});
  }
  async function startMonitoring() {
    const {qcDropboxConnected,qcRootPath} = await storage(["qcDropboxConnected","qcRootPath"]);
    if (!qcDropboxConnected) throw new Error("Connect Dropbox first.");
    if (!normalizePath(qcRootPath)) throw new Error("Enter the parent folder that contains your order-ID folders.");
    await save({qcMonitoring:true});
    chrome.alarms.create(ALARM,{periodInMinutes:5});
    await pollDropbox();
    return {ok:true};
  }
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM) pollDropbox().catch(error => recordActivity({status:"ERROR",label:"WATCHER ERROR",message:String(error.message||error)}));
  });
  chrome.runtime.onStartup.addListener(async () => {
    const {qcMonitoring} = await storage(["qcMonitoring"]);
    if (qcMonitoring) chrome.alarms.create(ALARM,{periodInMinutes:5});
  });
  chrome.runtime.onInstalled.addListener(async () => {
    const {qcMonitoring} = await storage(["qcMonitoring"]);
    if (qcMonitoring) chrome.alarms.create(ALARM,{periodInMinutes:5});
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message?.type?.startsWith("VECTORIO_QC_")) return;
    (async()=>{
      try {
        let result={ok:true};
        if (message.type==="VECTORIO_QC_CONNECT") result=await connectDropbox();
        if (message.type==="VECTORIO_QC_DISCONNECT") result=await disconnectDropbox();
        if (message.type==="VECTORIO_QC_SAVE_SETTINGS") {
          await save({qcAppKey:message.qcAppKey||"",qcRootPath:message.qcRootPath||"",qcBackendUrl:message.qcBackendUrl||""});
        }
        if (message.type==="VECTORIO_QC_START") result=await startMonitoring();
        if (message.type==="VECTORIO_QC_STOP") {
          await chrome.alarms.clear(ALARM); await save({qcMonitoring:false}); result={ok:true};
        }
        sendResponse(result);
      } catch(error) { sendResponse({ok:false,error:String(error.message||error)}); }
    })();
    return true;
  });
})();