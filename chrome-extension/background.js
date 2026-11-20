// Remember the Gemini tab the user last worked in.
// When Vectorio sends an image, reuse that exact tab; never create a new Gemini tab.
async function rememberGeminiTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab?.url?.startsWith("https://gemini.google.com/")) {
      await chrome.storage.local.set({ vectorioGeminiTabId: tabId });
    }
  } catch {}
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  rememberGeminiTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) {
    if (tab.url?.startsWith("https://gemini.google.com/")) {
      chrome.storage.local.set({ vectorioGeminiTabId: tabId }).catch(() => {});
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "VECTORIO_OPEN_GEMINI") return;
  (async () => {
    try {
      const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
      if (!tabs.length) {
        sendResponse({ ok: false, error: "No Gemini tab is open. Open Gemini, start a New Chat, and leave that tab open before sending." });
        return;
      }

      const stored = await chrome.storage.local.get("vectorioGeminiTabId");
      let tab = tabs.find(item => item.id === stored.vectorioGeminiTabId);
      if (!tab) {
        // If no previously focused Gemini tab was recorded, use the most recently used existing Gemini tab.
        tab = [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
      }
      if (tab.id == null) throw new Error("Could not identify the existing Gemini tab.");

      // Store the payload only after selecting the existing target tab.
      await chrome.storage.local.set({ vectorioPending: {
        imageDataUrl: message.imageDataUrl,
        fileName: message.fileName,
        mimeType: message.mimeType,
        prompt: message.prompt,
        createdAt: Date.now()
      }});

      // Activate the already-open Gemini tab. Deliberately do not call chrome.tabs.create.
      await chrome.tabs.update(tab.id, { active: true });
      if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });

      try {
        await chrome.tabs.sendMessage(tab.id, { type: "VECTORIO_FILL_GEMINI" });
      } catch {
        // Wait for the content script to be ready in the existing tab; never open another tab.
        await new Promise(resolve => {
          let finished = false;
          const done = () => {
            if (finished) return;
            finished = true;
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timeout);
            resolve();
          };
          const listener = (updatedTabId, info) => {
            if (updatedTabId === tab.id && info.status === "complete") done();
          };
          const timeout = setTimeout(done, 5000);
          chrome.tabs.onUpdated.addListener(listener);
        });
        await chrome.tabs.sendMessage(tab.id, { type: "VECTORIO_FILL_GEMINI" });
      }
      sendResponse({ ok: true, reusedExistingTab: true, tabId: tab.id });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
  })();
  return true;
});
