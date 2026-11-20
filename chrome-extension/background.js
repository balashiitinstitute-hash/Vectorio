chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "VECTORIO_OPEN_GEMINI") return;
  (async () => {
    try {
      await chrome.storage.local.set({ vectorioPending: {
        imageDataUrl: message.imageDataUrl, fileName: message.fileName,
        mimeType: message.mimeType, prompt: message.prompt, createdAt: Date.now()
      }});
      const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
      if (!tabs.length) {
        await chrome.storage.local.remove("vectorioPending");
        sendResponse({ ok: false, error: "Open Gemini in Chrome and start a New Chat first, then click Open Gemini again." });
        return;
      }
      const tab = tabs.find(t => t.active) || tabs.sort((a,b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
      if (tab.id == null) throw new Error("Could not find your open Gemini tab.");
      await chrome.tabs.update(tab.id, { active: true });
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "VECTORIO_FILL_GEMINI" });
      } catch {
        await new Promise(resolve => {
          const listener = (tabId, info) => {
            if (tabId === tab.id && info.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener); resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 5000);
        });
        await chrome.tabs.sendMessage(tab.id, { type: "VECTORIO_FILL_GEMINI" });
      }
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
  })();
  return true;
});
