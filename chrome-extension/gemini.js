let filling = false;

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "VECTORIFY_FILL_GEMINI") fillGemini();
});

async function fillGemini() {
  if (filling) return;
  filling = true;
  try {
    const stored = await chrome.storage.local.get("vectorifyPending");
    const payload = stored.vectorifyPending;
    if (!payload?.imageDataUrl || !payload?.prompt) return;

    const response = await fetch(payload.imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], payload.fileName || "vectorify-source.png", { type: payload.mimeType || blob.type || "image/png" });

    // Gemini exposes a file input when its upload control is available.
    let fileInput = null;
    for (let attempt = 0; attempt < 20 && !fileInput; attempt++) {
      fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) await wait(500);
    }
    if (!fileInput) throw new Error("Gemini upload control was not found. Please attach the image manually.");

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Wait for Gemini to accept the image before placing the prompt.
    await wait(1800);
    let editor = null;
    for (let attempt = 0; attempt < 24 && !editor; attempt++) {
      editor = document.querySelector('rich-textarea [contenteditable="true"]')
        || document.querySelector('[contenteditable="true"][role="textbox"]')
        || document.querySelector('div[contenteditable="true"]')
        || document.querySelector("textarea");
      if (!editor) await wait(500);
    }
    if (!editor) throw new Error("Gemini prompt box was not found. The image may be attached; paste the prompt manually.");

    editor.focus();
    if (editor instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(editor, payload.prompt);
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: payload.prompt }));
    } else {
      editor.textContent = payload.prompt;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: payload.prompt }));
    }
    await chrome.storage.local.remove("vectorifyPending");
  } catch (error) {
    console.error("Vectorify → Gemini:", error);
    showNotice("Vectorify could not automatically finish setup. Please attach the source image and paste your prompt manually. " + (error?.message || ""));
  } finally {
    filling = false;
  }
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function showNotice(message) {
  const notice = document.createElement("div");
  notice.textContent = message;
  Object.assign(notice.style, { position: "fixed", zIndex: "999999", top: "12px", left: "12px", right: "12px", padding: "14px 18px", background: "#fff4d6", color: "#4b3710", border: "1px solid #e7c66a", borderRadius: "12px", font: "14px/1.5 Arial,sans-serif", boxShadow: "0 4px 18px #0002" });
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 12000);
}
