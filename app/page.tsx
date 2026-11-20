"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clipboard, ExternalLink, ImagePlus, Loader2, RefreshCw, Sparkles, UploadCloud, X, WandSparkles, Settings2, Monitor, Smartphone, Download, Globe } from "lucide-react";

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
  const [device, setDevice] = useState<"auto" | "windows" | "android">("auto");
  const [target, setTarget] = useState<"ask" | "web" | "app">("ask");
  const [targetDialog, setTargetDialog] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [detectedDevice, setDetectedDevice] = useState<"windows" | "android">("windows");

  useEffect(() => {
    const ua = navigator.userAgent;
    setDetectedDevice(/Android/i.test(ua) ? "android" : "windows");
    const saved = localStorage.getItem("vectorio-settings");
    if (saved) {
      try {
        const value = JSON.parse(saved);
        if (value.device) setDevice(value.device);
        if (value.geminiTarget) setTarget(value.geminiTarget);
      } catch {}
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  function saveSettings(nextDevice: typeof device, nextTarget: typeof target) {
    setDevice(nextDevice);
    setTarget(nextTarget);
    localStorage.setItem("vectorio-settings", JSON.stringify({ device: nextDevice, geminiTarget: nextTarget, autoGenerate: false }));
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

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

  async function generatePrompt() {
    if (!file) return;
    setGenerating(true); setError(""); setPrompt("");
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("vectorType", type);
      const response = await fetch("/api/generate-prompt", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate the prompt. Please try again.");
      setPrompt(data.prompt);
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
    if (target === "ask") setTargetDialog(true);
    else await transferToGemini(target);
  }

  async function transferToGemini(choice: "web" | "app") {
    if (!file || !prompt) return;
    setTargetDialog(false);
    setSendingToGemini(true);
    try {
      const isAndroid = (device === "auto" ? detectedDevice : device) === "android";
      if (choice === "app") {
        if (!isAndroid) {
          setGeminiStatus("Gemini App target is available on Android. Choose Gemini Web on this device.");
          return;
        }
        if (!navigator.share) throw new Error("Native sharing is not supported in this browser. Open Vectorio AI in Chrome on Android.");
        const shareFile = new File([file], file.name, { type: file.type });
        const shareData = { title: "Vectorio AI", text: prompt, files: [shareFile] };
        if (!navigator.canShare || !navigator.canShare({ files: [shareFile] })) {
          throw new Error("This device cannot share image files from this app. Use Gemini Web or share the image manually.");
        }
        await navigator.share(shareData);
        setGeminiStatus("Share sheet opened. Select Gemini. Review the image and prompt there, then tap Generate yourself.");
      } else {
        await navigator.clipboard.writeText(prompt).catch(() => {});
        const imageUrl = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = file.name || "vectorio-source.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(imageUrl), 10000);
        window.open("https://gemini.google.com/app", "_blank", "noopener,noreferrer");
        setGeminiStatus("Gemini Web opened in a new tab. Your prompt was copied and the original image was downloaded. Attach that image in Gemini, then paste the prompt and click Generate.");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setGeminiStatus("Sharing cancelled. Your image and prompt are still available in Vectorio AI.");
      } else {
        setError(err instanceof Error ? err.message : "Could not transfer to Gemini.");
      }
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
            {installPrompt && <button onClick={installApp} className="text-button"><Download size={14}/> Install App</button>}
            <button onClick={() => setShowSettings(!showSettings)} className="text-button" aria-label="App settings"><Settings2 size={15}/> Settings</button>
            <span className="topbar-tag">BETA</span>
          </div>
        </div>
      </header>

      {showSettings && <section className="site-width mt-4 max-w-[1160px]"><div className="result-panel">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Vectorio AI Settings</h2><button className="text-button" onClick={() => setShowSettings(false)}><X size={14}/> Close</button></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Device
            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 font-normal" value={device} onChange={e => saveSettings(e.target.value as typeof device, target)}>
              <option value="auto">Auto detect (Recommended)</option><option value="windows">Windows</option><option value="android">Android</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">Detected: {detectedDevice === "android" ? "Android" : "Windows / Desktop"}</span>
          </label>
          <label className="text-sm font-semibold">Gemini Target
            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-3 font-normal" value={target} onChange={e => saveSettings(device, e.target.value as typeof target)}>
              <option value="ask">Ask every time</option><option value="web">Gemini Web</option><option value="app">Gemini Android App</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">Auto Generate is always disabled. If Install App is not shown, use your browser menu → Install app / Add to Home screen.</span>
          </label>
        </div>
      </div></section>}
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
          <p className="mt-4 text-xs leading-5 text-slate-400">Choose Gemini Web or Android App. Transfer methods use your existing signed-in Gemini session; review the result and click Generate yourself.</p>
        </div>
      </section>}

      {targetDialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="gemini-target-title">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-center justify-between"><h2 id="gemini-target-title" className="text-lg font-semibold">Choose Gemini</h2><button className="text-button" onClick={() => setTargetDialog(false)}><X size={15}/></button></div>
          <p className="mt-1 text-sm text-slate-500">Device: {device === "auto" ? detectedDevice : device}. Choose where to continue.</p>
          <div className="mt-4 grid gap-3">
            <button onClick={() => transferToGemini("web")} className="style-option"><span className="style-icon"><Globe size={19}/></span><span className="flex-1 text-left"><strong className="block text-sm">Gemini Web</strong><span className="text-xs text-slate-500">Open Gemini in your browser</span></span><ArrowRight size={17}/></button>
            <button onClick={() => transferToGemini("app")} disabled={(device === "auto" ? detectedDevice : device) !== "android"} className="style-option disabled:opacity-40"><span className="style-icon"><Smartphone size={19}/></span><span className="flex-1 text-left"><strong className="block text-sm">Gemini Android App</strong><span className="text-xs text-slate-500">Open Android share sheet and choose Gemini</span></span><ArrowRight size={17}/></button>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500">Image and prompt transfer depends on the selected browser and Gemini share support. Vectorio never presses Generate for you.</p>
        </div>
      </div>}
      <footer className="site-width mt-16 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1"><span className="font-semibold text-slate-600">Vectorio AI</span><span>·</span><span>Image-aware prompt generator</span><span>·</span><span>Made for creative workflows</span></div>
      </footer>
    </main>
  );
}
