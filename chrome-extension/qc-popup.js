const $ = (id) => document.getElementById(id);
const fields = ["appKey", "rootPath", "backendUrl"];
function notify(message, error = false) { $("notice").textContent = message; $("notice").style.color = error ? "#b42318" : "#557b20"; }
async function send(type, extra = {}) { return chrome.runtime.sendMessage({ type, ...extra }); }
async function load() {
  const data = await chrome.storage.local.get(["qcAppKey","qcRootPath","qcBackendUrl","qcDropboxConnected","qcMonitoring","qcQueue","qcActivity"]);
  $("appKey").value = data.qcAppKey || "";
  $("redirectUri").value = chrome.identity.getRedirectURL("dropbox");
  $("rootPath").value = data.qcRootPath || "";
  $("backendUrl").value = data.qcBackendUrl || "";
  $("connectionBadge").textContent = data.qcDropboxConnected ? "Connected" : "Not connected";
  $("connectionBadge").className = "badge " + (data.qcDropboxConnected ? "ok" : "");
  $("connectBtn").classList.toggle("hidden", !!data.qcDropboxConnected);
  $("disconnectBtn").classList.toggle("hidden", !data.qcDropboxConnected);
  $("accountText").textContent = data.qcDropboxConnected ? "Dropbox authorization is active." : "Connect the Dropbox account used for production.";
  $("watchBadge").textContent = data.qcMonitoring ? "Monitoring" : "Stopped";
  $("watchBadge").className = "badge " + (data.qcMonitoring ? "ok" : "");
  $("watchText").textContent = data.qcMonitoring ? "Watching your order folders for completed uploads." : "Monitor Complete folders for new or changed files.";
  $("startBtn").disabled = !data.qcDropboxConnected || !data.qcRootPath || !!data.qcMonitoring;
  $("stopBtn").disabled = !data.qcMonitoring;
  const queue = data.qcQueue || [];
  const activity = data.qcActivity || [];
  $("queuedCount").textContent = queue.length;
  $("checkedCount").textContent = activity.filter(x => x.status === "QC_DONE").length;
  $("failedCount").textContent = activity.filter(x => x.status === "NEEDS_SETUP" || x.status === "ERROR").length;
  $("activityList").innerHTML = activity.slice(0,5).map(x => '<div class="activity-item"><span class="badge '+(x.status==="QC_DONE"?"ok":"warn")+'">'+escapeHtml(x.label || x.status)+'</span><strong>'+escapeHtml(x.orderId || "Dropbox file")+' · '+escapeHtml(x.name || "")+'</strong><small>'+escapeHtml(x.message || x.path || "")+'</small></div>').join("") || '<p class="empty">No QC activity yet.</p>';
}
function escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
$("saveBtn").addEventListener("click", async () => {
  const values = { qcAppKey: $("appKey").value.trim(), qcRootPath: $("rootPath").value.trim(), qcBackendUrl: $("backendUrl").value.trim().replace(/\/$/,"") };
  await chrome.storage.local.set(values);
  await send("VECTORIO_QC_SAVE_SETTINGS", values);
  notify("Settings saved.");
  load();
});
$("connectBtn").addEventListener("click", async () => {
  if (!$("appKey").value.trim()) { notify("Enter your Dropbox App Key first.", true); return; }
  await chrome.storage.local.set({qcAppKey:$("appKey").value.trim()});
  const r = await send("VECTORIO_QC_CONNECT");
  if (!r?.ok) notify(r?.error || "Dropbox connection failed.", true); else notify("Dropbox connected.");
  load();
});
$("disconnectBtn").addEventListener("click", async () => { const r=await send("VECTORIO_QC_DISCONNECT"); notify(r?.ok?"Dropbox disconnected.":r?.error,true); load(); });
$("startBtn").addEventListener("click", async () => { const r=await send("VECTORIO_QC_START"); if(!r?.ok) notify(r?.error||"Could not start monitoring.",true); else notify("Monitoring started."); load(); });
$("stopBtn").addEventListener("click", async () => { await send("VECTORIO_QC_STOP"); notify("Monitoring stopped."); load(); });
$("refreshBtn").addEventListener("click", load);
load();