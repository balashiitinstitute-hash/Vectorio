"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clipboard, ExternalLink, ImagePlus, Loader2, Sparkles, UploadCloud, X } from "lucide-react";

type VectorType = "vector-illustration" | "black-white" | "line-drawing";
const styles: { id: VectorType; title: string; description: string }[] = [
  { id: "vector-illustration", title: "Vector Illustration", description: "Clean shapes and polished colors" },
  { id: "black-white", title: "Black & White", description: "High-contrast monochrome artwork" },
  { id: "line-drawing", title: "Line Drawing", description: "Crisp outlines and fine details" }
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

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError("Clipboard access was blocked. Please select and copy the prompt manually."); }
  }

  function reset() {
    setFile(null); setPreview(""); setPrompt(""); setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="min-h-screen pb-16">
      <header className="shell flex h-20 items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-xl font-black tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#7357e8] text-white"><Sparkles size={19}/></span>vectorify<span className="text-[#7357e8]">.ai</span></a>
        <span className="rounded-full border border-[#e8e3f5] bg-white px-4 py-2 text-xs font-semibold text-[#6f55d9]">AI PROMPT GENERATOR</span>
      </header>

      <section className="shell pt-12 text-center md:pt-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e8e2fb] bg-white px-4 py-2 text-xs font-semibold text-[#7257df]"><Sparkles size={14}/> Image-aware prompts · Free Gemini text/vision tier</div>
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">Turn images into <span className="text-[#7357e8]">better prompts.</span></h1>
        <p className="muted mx-auto mt-5 max-w-xl text-base leading-7">Upload an image, choose a service, and get a tailored prompt that describes the exact image and the transformation you want.</p>
      </section>

      <section className="shell mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-5 md:p-7">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">01. Upload image</h2><p className="muted mt-1 text-sm">PNG, JPG or WEBP · Up to 10 MB</p></div>{file && <button onClick={reset} className="secondary flex items-center gap-2 text-sm"><X size={15}/> Clear</button>}</div>
          <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseImage(e.dataTransfer.files?.[0]);}} onClick={()=>inputRef.current?.click()} className="flex min-h-[310px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#dcd5f1] bg-[#faf9ff] p-5 text-center hover:border-[#8d78e8]">
            {preview ? <img src={preview} alt="Uploaded image preview" className="max-h-[285px] max-w-full rounded-xl object-contain"/> : <><div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#eee9ff] text-[#7357e8]"><UploadCloud size={30}/></div><p className="font-bold">Drop your image here</p><p className="muted mt-2 text-sm">or click to browse files</p><span className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-sm"><ImagePlus className="mr-2 inline" size={16}/> Choose image</span></>}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>chooseImage(e.target.files?.[0])}/>
          <p className="muted mt-3 text-xs">You can also paste an image from your clipboard (Ctrl + V) while this page is active.</p>
        </div>

        <div className="panel p-5 md:p-7">
          <h2 className="text-lg font-bold">02. Choose service</h2><p className="muted mt-1 text-sm">Select the transformation prompt you need.</p>
          <div className="mt-5 space-y-3">{styles.map(s=><button key={s.id} onClick={()=>{setType(s.id);setPrompt("");setError("");}} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${type===s.id?"border-[#8c77e9] bg-[#f6f3ff]":"border-[#eceaf3] bg-white hover:border-[#c9c0e9]"}`}><span><span className="block font-bold">{s.title}</span><span className="muted mt-1 block text-sm">{s.description}</span></span><span className={`grid h-6 w-6 place-items-center rounded-full border ${type===s.id?"border-[#7357e8] bg-[#7357e8] text-white":"border-[#ddd9e8]"}`}>{type===s.id&&<Check size={14}/>}</span></button>)}</div>
          <button disabled={!file || generating} onClick={generatePrompt} className="primary mt-6 flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">{generating?<><Loader2 size={18} className="animate-spin"/> Analyzing image…</>:<><Sparkles size={18}/> Generate prompt <ArrowRight size={17}/></>}</button>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>

      {prompt && <section className="shell mt-6"><div className="panel p-5 md:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">03. Your image-specific prompt</h2><p className="muted mt-1 text-sm">Generated from your uploaded image and selected service.</p></div><span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Prompt ready</span></div>
        <textarea readOnly value={prompt} className="min-h-[220px] w-full resize-y rounded-xl border border-[#e7e2f0] bg-[#faf9ff] p-4 text-sm leading-7 text-[#49465b] outline-none"/>
        <div className="mt-4 flex flex-wrap gap-3"><button onClick={copyPrompt} className="primary flex items-center justify-center gap-2"><Clipboard size={16}/>{copied?"Copied!":"Copy prompt"}</button><a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="secondary flex items-center justify-center gap-2">Open Gemini <ExternalLink size={16}/></a><button onClick={generatePrompt} disabled={generating} className="secondary flex items-center gap-2"><Sparkles size={16}/> Regenerate prompt</button></div>
        <p className="muted mt-4 text-xs">Copy this prompt, upload your original image to Gemini, and ask Gemini to apply the requested style. Vectorify AI only creates prompts; it does not generate or import images.</p>
      </div></section>}

      <footer className="shell mt-16 border-t border-[#eceaf3] pt-6 text-center text-xs text-[#9290a0]">Vectorify AI · Image-aware prompt generator · PNG/JPG/WEBP input · No generated-result import.</footer>
    </main>
  );
}
