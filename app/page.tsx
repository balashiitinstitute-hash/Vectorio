"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clipboard, ExternalLink, ImagePlus, Loader2, RefreshCw, Sparkles, UploadCloud, X, WandSparkles } from "lucide-react";

type VectorType = "vector-illustration" | "black-white" | "line-drawing";
const styles: { id: VectorType; title: string; description: string; detail: string }[] = [
  { id: "vector-illustration", title: "Vector Illustration", description: "Clean shapes and polished colors", detail: "COLOR" },
  { id: "black-white", title: "Black & White", description: "High-contrast laser engraving style", detail: "B&W" },
  { id: "line-drawing", title: "Line Drawing", description: "Crisp outlines and fine details", detail: "LINES" }
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [type, setType] = useState<VectorType>("vector-illustration");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingToGemini, setSendingToGemini] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState("");

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items || []).find(entry => entry.type.startsWith("image/"));
      const pastedFile = item?.getAsFile();
      if (pastedFile) { event.preventDefault(); chooseImage(pastedFile); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function chooseImage(next?: File) {
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) { setError("Please choose a PNG, JPG, or WEBP image."); return; }
    if (next.size > 10 * 1024 * 1024) { setError("Image must be 10 MB or smaller."); return; }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setPrompt("");
    setError("");
    setGeminiStatus("");
  }

  // Optimize only the image used for AI prompt analysis. The original file is
  // preserved and is still sent to Gemini by the Chrome extension.
  async function preparePromptImage(source: File): Promise<File> {
    const safeRequestSize = 3.7 * 1024 * 1024; // Leave room for multipart overhead under Vercel's request limit.
    if (source.size <= safeRequestSize) return source;

    const bitmap = await createImageBitmap(source);
    try {
      const canvas = document.createElement("canvas");
      let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      let quality = 0.86;

      for (let attempt = 0; attempt < 12; attempt++) {
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not optimize the image in this browser.");
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        const optimized = await new Promise<Blob | null>(resolve =>
          canvas.toBlob(resolve, "image/webp", quality)
        );
        if (!optimized) throw new Error("Could not compress the image. Please try a JPG or PNG.");

        if (optimized.size <= safeRequestSize) {
          return new File([optimized], "vectorio-prompt-image.webp", { type: "image/webp" });
        }

        if (quality > 0.56) quality -= 0.1;
        else {
          scale *= 0.78;
          quality = 0.82;
        }
      }
      throw new Error("This image could not be reduced enough for prompt analysis. Please use a smaller image.");
    } finally {
      bitmap.close();
    }
  }

  async function generatePrompt() {
    if (!file) return;
    setGenerating(true); setError(""); setPrompt("");
    try {
      const promptImage = await preparePromptImage(file);
      const body = new FormData();
      body.append("image", promptImage);
      body.append("vectorType", type);
      const response = await fetch("/api/generate-prompt", { method: "POST", body });
      const responseText = await response.text();
      let data: { prompt?: string; error?: string };
      try {
        data = JSON.parse(responseText);
      } catch {
        const detail = responseText.trim().slice(0, 220) || response.statusText || "Non-JSON server response";
        throw new Error(`Server error (${response.status}): ${detail}`);
      }
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status}). Please try again.`);
      }
      if (!data.prompt) throw new Error("The server did not return a prompt. Please try again.");
      setPrompt(data.prompt);
      // Automatically transfer the original image and completed prompt to the
      // user's already-open Gemini tab. The user still submits manually.
      setGeminiStatus("Prompt generated. Switching to your open Gemini chat and attaching the image…");
      await transferToGemini(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error while generating prompt.");
    } finally {
      setGenerating(false);
    }
  }

  async function openGeminiWithImage() {
    if (!file || !prompt) return;
    setError("");
    setGeminiStatus("");
    await transferToGemini(prompt);
  }

  async function transferToGemini(promptToSend: string) {
    if (!file || !promptToSend) return;
    setSendingToGemini(true);
    setError("");
    setGeminiStatus("Sending image and prompt to your open Gemini chat…");
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      const result = await new Promise<{ok:boolean;error?:string}>((resolve) => {
        let settled = false;
        const finish = (value: {ok:boolean;error?:string}) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          window.removeEventListener("message", onResult);
          resolve(value);
        };
        function onResult(event: MessageEvent) {
          if (event.source !== window || event.origin !== window.location.origin) return;
          if (event.data?.type === "VECTORIO_EXTENSION_SENT") finish({ok:true});
          else if (event.data?.type === "VECTORIO_EXTENSION_ERROR") finish({ok:false,error:event.data.error});
        }
        window.addEventListener("message", onResult);
        const timer = window.setTimeout(() => finish({
          ok:false,
          error:"No response from the Vectorio Chrome Extension. Check that it is enabled and allowed on vectorio-ai.vercel.app, then reload both the extension and this website."
        }), 12000);

        // Send only after the response listener is ready to avoid missing a fast extension reply.
        window.postMessage({
          type: "VECTORIO_SEND_TO_GEMINI",
          imageDataUrl,
          fileName: file.name,
          mimeType: file.type,
          prompt: promptToSend
        }, window.location.origin);
      });
      if (!result.ok) throw new Error(result.error || "Could not send to Gemini.");
      setGeminiStatus("Image and prompt are ready in your existing Gemini chat. Just click Submit/Generate when you're ready.");
    } catch (err) {
      setGeminiStatus("");
      setError(err instanceof Error ? err.message : "Could not send to Gemini.");
    } finally {
      setSendingToGemini(false);
    }
  }

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError("Clipboard access was blocked. Please select and copy the prompt manually."); }
  }

  function reset() {
    setFile(null); setPreview(""); setPrompt(""); setError(""); setGeminiStatus("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const selectedStyle = styles.find(style => style.id === type);

  return (
    <main className="min-h-screen pb-16">
      <header className="topbar">
        <div className="site-width flex h-[76px] items-center justify-between">
          <a href="/" className="brand-lockup" aria-label="Vectorio AI home">
            <span className="brand-mark"><WandSparkles size={20} strokeWidth={2.2}/></span>
            <span>Vectorio<span className="brand-ai"> AI</span></span>
          </a>
          <div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex">
            <span className="status-dot"></span>
            AI prompt workspace
          </div>
          <div className="flex items-center gap-2">
            <span className="topbar-tag">BETA</span>
          </div>
        </div>
      </header>

      <section className="hero-showcase">
        <div className="hero-decoration hero-decoration-left" aria-hidden="true"><span className="grid-square square-one"/><span className="grid-square square-two"/><span className="grid-cross cross-one">+</span><span className="grid-cross cross-two">+</span><span className="grid-dot dot-one"/><span className="grid-dot dot-two"/></div>
        <div className="hero-decoration hero-decoration-right" aria-hidden="true"><span className="grid-square square-one"/><span className="grid-square square-two"/><span className="grid-cross cross-one">+</span><span className="grid-cross cross-two">+</span><span className="grid-dot dot-one"/><span className="grid-dot dot-two"/></div>
        <div className="hero-content">
          <div className="eyebrow"><Sparkles size={14}/> IMAGE-TO-PROMPT WORKSPACE</div>
          <h1 className="hero-title">VECTORIO AI</h1>
          <p className="hero-copy">Upload your artwork, choose a style, and get a carefully tailored prompt ready to use with Gemini.</p>
        </div>
      </section>

      <section className="site-width mt-10 max-w-[1160px]">
        <div className="workspace">
          <div className="workspace-heading">
            <div>
              <div className="step-kicker">YOUR WORKSPACE</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Prepare your image</h2>
              <p className="mt-1 text-sm text-slate-500">A simple workflow from source image to a ready-to-use prompt.</p>
            </div>
            {file && <button onClick={reset} className="text-button"><X size={15}/> Clear image</button>}
          </div>

          <div className="workspace-grid">
            <div className="upload-column">
              <div className="section-label"><span className="step-number">1</span><div><h3>Upload image</h3><p>Start with a PNG, JPG or WEBP file</p></div></div>
              <div
                onDragOver={event => event.preventDefault()}
                onDrop={event => { event.preventDefault(); chooseImage(event.dataTransfer.files?.[0]); }}
                onClick={() => inputRef.current?.click()}
                className={"upload-zone " + (preview ? "upload-zone-filled" : "")}
                role="button"
                tabIndex={0}
                onKeyDown={event => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
                aria-label="Upload an image"
              >
                {preview ? (
                  <div className="preview-wrap">
                    <img src={preview} alt="Uploaded image preview" className="image-preview"/>
                    <div className="preview-overlay"><span><RefreshCw size={14}/> Replace image</span></div>
                  </div>
                ) : (
                  <div className="upload-empty">
                    <div className="upload-icon"><UploadCloud size={27} strokeWidth={1.7}/></div>
                    <p className="mt-4 text-[15px] font-semibold text-slate-800">Drop your image here</p>
                    <p className="mt-1 text-sm text-slate-500">or <span className="font-semibold text-slate-800 underline underline-offset-4">browse files</span></p>
                    <div className="upload-meta"><span>PNG</span><span>JPG</span><span>WEBP</span><span>MAX 10 MB</span></div>
                  </div>
                )}
              </div>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event => chooseImage(event.target.files?.[0])}/>
              <div className="upload-footnote"><ImagePlus size={14}/> You can also paste an image with Ctrl + V.</div>
              {file && <div className="file-chip"><Check size={14}/><span className="truncate">{file.name}</span><span className="file-size">{(file.size / (1024 * 1024)).toFixed(2)} MB</span></div>}
            </div>

            <div className="settings-column">
              <div className="section-label"><span className="step-number">2</span><div><h3>Choose a style</h3><p>Select the output direction for your prompt</p></div></div>
              <div className="style-list">
                {styles.map((style, index) => (
                  <button key={style.id} onClick={() => { setType(style.id); setPrompt(""); setError(""); }} className={"style-option " + (type === style.id ? "style-option-active" : "")} aria-pressed={type === style.id}>
                    <span className={"style-icon style-icon-" + index}>{index === 0 ? <Sparkles size={18}/> : index === 1 ? <span className="bw-icon">B/W</span> : <span className="line-icon"><span></span><span></span><span></span></span>}</span>
                    <span className="min-w-0 flex-1 text-left"><span className="block text-sm font-semibold text-slate-900">{style.title}</span><span className="mt-1 block text-xs text-slate-500">{style.description}</span></span>
                    <span className="style-radio">{type === style.id && <span/>}</span>
                  </button>
                ))}
              </div>
              <button disabled={!file || generating} onClick={generatePrompt} className="generate-button mt-5 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-40">
                {generating ? <><Loader2 size={17} className="animate-spin"/> Analyzing image…</> : <><Sparkles size={17}/> Generate prompt <ArrowRight size={16}/></>}
              </button>
              <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">Your image is analyzed to create a prompt. Vectorio AI does not generate the final artwork.</p>
            </div>
          </div>
          {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>

      {prompt && <section className="site-width mt-6 max-w-[1160px]">
        <div className="result-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3"><span className="result-check"><Check size={17}/></span><div><div className="step-kicker">STEP 3 · READY TO USE</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Your image-specific prompt</h2><p className="mt-1 text-sm text-slate-500">Created for {selectedStyle?.title || "your selected style"}.</p></div></div>
            <span className="ready-tag">Prompt ready</span>
          </div>
          <textarea readOnly value={prompt} className="prompt-output mt-5 min-h-[220px] w-full resize-y" aria-label="Generated prompt"/>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={copyPrompt} className="action-primary flex items-center justify-center gap-2"><Clipboard size={16}/>{copied ? "Copied!" : "Copy prompt"}</button>
            <button onClick={openGeminiWithImage} disabled={sendingToGemini} className="action-secondary flex items-center justify-center gap-2 disabled:opacity-50">{sendingToGemini ? <Loader2 size={16} className="animate-spin"/> : <ExternalLink size={16}/>} {sendingToGemini ? "Opening Gemini…" : "Open Gemini with image + prompt"}</button>
            <button onClick={generatePrompt} disabled={generating} className="action-quiet flex items-center gap-2"><RefreshCw size={15}/> Regenerate</button>
          </div>
          {geminiStatus && <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{geminiStatus}</p>}
          <p className="mt-4 text-xs leading-5 text-slate-400">Keep a Gemini New Chat open in Chrome. After prompt generation, Vectorio AI automatically switches to that tab and fills in the image and prompt. You only need to click Submit/Generate.</p>
        </div>
      </section>}

      <footer className="site-width mt-16 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"><span className="font-semibold text-slate-600">Vectorio AI</span><span>·</span><span>Image-aware prompt generator</span><span>·</span><span>Made for creative workflows</span></div>
      </footer>
    </main>
  );
}
