chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "VECTORIFY_OPEN_GEMINI") return;
  (async () => {
    try {
      await chrome.storage.local.set({ vectorifyPending: { imageDataUrl: message.imageDataUrl, fileName: message.fileName, mimeType: message.mimeType, prompt: message.prompt, createdAt: Date.now() } });
      const tab = await chrome.tabs.create({ url: "https://gemini.google.com/app", active: true });
      const listener = async (tabId, changeInfo) => {
        if (tabId !== tab.id || changeInfo.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(listener);
        // Give Gemini's app UI time to hydrate before attempting attachment.
        setTimeout(async () => {
          try { await chrome.tabs.sendMessage(tab.id, { type: "VECTORIFY_FILL_GEMINI" }); }
          catch (error) { console.warn("Vectorify: Gemini content script was not ready.", error); }
        }, 2500);
      };
      chrome.tabs.onUpdated.addListener(listener);
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();
  return true;
});
