// Receives the selected image and generated prompt from the Vectorify web app.
window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== "https://vectorify-ai.vercel.app") return;
  if (event.data?.type !== "VECTORIFY_SEND_TO_GEMINI") return;
  const payload = event.data;
  if (typeof payload.imageDataUrl !== "string" || typeof payload.prompt !== "string") return;
  chrome.runtime.sendMessage({
    type: "VECTORIFY_OPEN_GEMINI",
    imageDataUrl: payload.imageDataUrl,
    fileName: payload.fileName || "vectorify-source.png",
    mimeType: payload.mimeType || "image/png",
    prompt: payload.prompt
  }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      window.postMessage({ type: "VECTORIFY_EXTENSION_ERROR", error: response?.error || chrome.runtime.lastError?.message || "Could not open Gemini." }, "*");
    } else {
      window.postMessage({ type: "VECTORIFY_EXTENSION_SENT" }, "*");
    }
  });
});
