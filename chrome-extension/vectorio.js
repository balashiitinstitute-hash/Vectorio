// Receives the selected image and generated prompt from the Vectorio AI web app.
window.addEventListener("message", (event) => {
  if (event.source !== window || !["https://vectorio-ai.vercel.app", "https://vectorify-ai.vercel.app"].includes(event.origin)) return;
  if (event.data?.type !== "VECTORIO_SEND_TO_GEMINI") return;
  const payload = event.data;
  if (typeof payload.imageDataUrl !== "string" || typeof payload.prompt !== "string") return;
  chrome.runtime.sendMessage({
    type: "VECTORIO_OPEN_GEMINI",
    imageDataUrl: payload.imageDataUrl,
    fileName: payload.fileName || "vectorio-source.png",
    mimeType: payload.mimeType || "image/png",
    prompt: payload.prompt
  }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      window.postMessage({ type: "VECTORIO_EXTENSION_ERROR", error: response?.error || chrome.runtime.lastError?.message || "Could not open Gemini." }, "*");
    } else {
      window.postMessage({ type: "VECTORIO_EXTENSION_SENT" }, "*");
    }
  });
});
