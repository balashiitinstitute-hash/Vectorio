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
    if (!response.ok) throw new Error("Could not read the selected image.");
    const blob = await response.blob();
    const file = new File([blob], payload.fileName || "vectorify-source.png", {
      type: payload.mimeType || blob.type || "image/png"
    });

    // Gemini does not create its file input until the upload menu is opened.
    let fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) {
      const uploadButton = [...document.querySelectorAll("button,[role='button']")]
        .find((el) => /upload\s*&\s*tools|attach files|add files/i.test(
          (el.getAttribute("aria-label") || "") + " " + (el.innerText || "")
        ));
      if (!uploadButton) throw new Error('Gemini "Upload & tools" button was not found.');
      uploadButton.click();
      await wait(500);

      const uploadOption = [...document.querySelectorAll("button,[role='button'],[role='menuitem']")]
        .find((el) => /^(upload files?|from computer|upload from computer)$/i.test(
          (el.innerText || el.getAttribute("aria-label") || "").trim()
        ));
      if (uploadOption) {
        uploadOption.click();
        await wait(500);
      }
    }

    // Wait for the native file input to be added after opening the upload menu.
    for (let attempt = 0; attempt < 30 && !fileInput; attempt++) {
      fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) await wait(400);
    }
    if (!fileInput) throw new Error('Gemini did not open its image file picker. Please use "Upload & tools" → "Upload files" once.');

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInput.files = transfer.files;
    fileInput.dispatchEvent(new Event("input", { bubbles: true }));
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Wait until Gemini displays the uploaded attachment before filling the prompt.
    await wait(2500);
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
    // Leave final submission to the user. Gemini's UI may change, so never auto-click Generate.
    await chrome.storage.local.remove("vectorifyPending");
    showNotice("Your image and prompt have been sent to Gemini. Please review them and click Generate when ready.");
  } catch (error) {
    console.error("Vectorify → Gemini:", error);
    showNotice("Vectorify could not automatically attach the image. Please use Gemini's Upload & tools → Upload files, then check the prompt. " + (error?.message || ""));
  } finally {
    filling = false;
  }
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function showNotice(message) {
  const notice = document.createElement("div");
  notice.textContent = message;
  Object.assign(notice.style, {
    position: "fixed", zIndex: "999999", top: "12px", left: "12px", right: "12px",
    padding: "14px 18px", background: "#fff4d6", color: "#4b3710",
    border: "1px solid #e7c66a", borderRadius: "12px",
    font: "14px/1.5 Arial,sans-serif", boxShadow: "0 4px 18px #0002"
  });
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 12000);
}
