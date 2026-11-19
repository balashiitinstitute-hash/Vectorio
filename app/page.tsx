"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Clipboard, Download, ExternalLink, ImagePlus, RefreshCw, Sparkles, UploadCloud, X } from "lucide-react";
import { DEFAULT_PROMPTS } from "@/lib/prompts";

type VectorType = "vector-illustration" | "black-white" | "line-drawing";
const styles: { id: VectorType; title: string; description: string }[] = [
  { id: "vector-illustration", title: "Vector Illustration", description: "Clean shapes and polished colors" },
  { id: "black-white", title: "Black & White", description: "High-contrast monochrome artwork" },
  { id: "line-drawing", title: "Line Drawing", description: "Crisp outlines and fine details" }
];

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [resultPreview, setResultPreview] = useState("");
  const [type, setType] = useState<VectorType>("vector-illustration");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"upload" | "ready" | "result">("upload");

  const prompt = DEFAULT_PROMPTS[type];

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const pasted = Array.from(event.clipboardData?.items || []).find(item => item.type.startsWith("image/"));
      const pastedFile = pasted?.getAsFile();
      if (pastedFile) {
        event.preventDefault();
        chooseImage(pastedFile);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  function chooseImage(next: File | undefined) {
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) { setError("Please choose a PNG, JPG, or WEBP image."); return; }
    if (next.size > 10 * 1024 * 1024) { setError("Image must be 10 MB or smaller."); return; }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setResultFile(null);
    setResultPreview("");
    setError("");
    setStep("ready");
  }

  function chooseResult(next: File | undefined) {
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) { setError("Please choose a PNG, JPG, or WEBP result image."); return; }
    if (next.size > 10 * 1024 * 1024) { setError("Result image must be 10 MB or smaller."); return; }
    setResultFile(next);
    setResultPreview(URL.createObjectURL(next));
    setError("");
    setStep("result");
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Clipboard access was blocked. Select and copy the prompt from the prompt box.");
    }
  }

  function reset() {
    setFile(null); setPreview(""); setResultFile(null); setResultPreview(""); setError(""); setStep("upload");
    if (inputRef.current) inputRef.current.value = "";
    if (resultInputRef.current) resultInputRef.current.value = "";
  }

  function retry() {
    setResultFile(null);
    setResultPreview("");
    setStep("ready");
    if (resultInputRef.current) resultInputRef.current.value = "";
  }

  return (
    <main className="min-h-screen pb-16">
      <header className="shell flex h-20 items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-xl font-black tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#7357e8] text-white"><Sparkles size={19}/></span>vectorify<span className="text-[#7357e8]">.ai</span></a>
        <span className="rounded-full border border-[#e8e3f5] bg-white px-4 py-2 text-xs font-semibold text-[#6f55d9]">PERSONAL GEMINI WORKFLOW</span>
      </header>

      <section className="shell pt-12 text-center md:pt-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e8e2fb] bg-white px-4 py-2 text-xs font-semibold text-[#7257df]"><Sparkles size={14}/> Your Gemini account · Manual handoff</div>
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">Transform images into <span className="text-[#7357e8]">vector style.</span></h1>
        <p className="muted mx-auto mt-5 max-w-xl text-base leading-7">Prepare your image and a dedicated style prompt here, create it with your own free Gemini account, then bring the result back.</p>
      </section>

      <section className="shell mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-5 md:p-7">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">01. Upload image</h2><p className="muted mt-1 text-sm">PNG, JPG or WEBP · Up to 10 MB</p></div>{file && <button onClick={reset} className="secondary flex items-center gap-2 text-sm"><X size={15}/> Clear</button>}</div>
          <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseImage(e.dataTransfer.files?.[0]);}} onClick={()=>inputRef.current?.click()} className="flex min-h-[310px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#dcd5f1] bg-[#faf9ff] p-5 text-center hover:border-[#8d78e8]">
            {preview ? <img src={preview} alt="Original upload" className="max-h-[285px] max-w-full rounded-xl object-contain"/> : <><div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#eee9ff] text-[#7357e8]"><UploadCloud size={30}/></div><p className="font-bold">Drop your image here</p><p className="muted mt-2 text-sm">or click to browse files</p><span className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-sm"><ImagePlus className="mr-2 inline" size={16}/> Choose image</span></>}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>chooseImage(e.target.files?.[0])}/>
          <p className="muted mt-3 text-xs">You can also paste an image from your clipboard (Ctrl + V) while this page is active.</p>
          {file && <a href={preview} download={file.name || "vectorify-source.png"} className="secondary mt-4 inline-flex items-center gap-2 text-sm"><Download size={15}/> Download source for Gemini</a>}
        </div>

        <div className="panel p-5 md:p-7">
          <h2 className="text-lg font-bold">02. Choose vector type</h2><p className="muted mt-1 text-sm">Select the look you want to create.</p>
          <div className="mt-5 space-y-3">{styles.map(s=><button key={s.id} onClick={()=>{setType(s.id);setError("");}} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${type===s.id?"border-[#8c77e9] bg-[#f6f3ff]":"border-[#eceaf3] bg-white hover:border-[#c9c0e9]"}`}><span><span className="block font-bold">{s.title}</span><span className="muted mt-1 block text-sm">{s.description}</span></span><span className={`grid h-6 w-6 place-items-center rounded-full border ${type===s.id?"border-[#7357e8] bg-[#7357e8] text-white":"border-[#ddd9e8]"}`}>{type===s.id&&<Check size={14}/>}</span></button>)}</div>
          <button disabled={!file} onClick={()=>{setStep("ready");setError("");}} className="primary mt-6 flex w-full items-center justify-center gap-2"><Sparkles size={18}/> Prepare for Gemini <ArrowRight size={17}/></button>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>

      {file && <section className="shell mt-6"><div className="panel p-5 md:p-7">
        <div className="mb-5"><h2 className="text-lg font-bold">03. Create with your Gemini account</h2><p className="muted mt-1 text-sm">This workflow uses the Gemini website you sign in to. It does not call the paid Gemini API.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#eceaf3] bg-[#faf9ff] p-4"><p className="mb-2 text-sm font-bold">Your style prompt</p><textarea readOnly value={prompt} className="min-h-[190px] w-full resize-y rounded-xl border border-[#e7e2f0] bg-white p-3 text-sm leading-6 text-[#49465b] outline-none"/><button onClick={copyPrompt} className="primary mt-3 flex w-full items-center justify-center gap-2"><Clipboard size={16}/>{copied?"Copied!":"Copy prompt"}</button></div>
          <div className="flex flex-col justify-center rounded-2xl border border-[#eceaf3] p-5"><div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[#eee9ff] text-[#7357e8]"><ExternalLink size={23}/></div><h3 className="font-bold">Open Gemini</h3><p className="muted mt-2 text-sm leading-6">1. Download the source image on the left. 2. Open Gemini and upload it. 3. Paste the copied prompt and generate. 4. Download the generated image and return here.</p><a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className="primary mt-5 flex items-center justify-center gap-2">Open Gemini <ExternalLink size={16}/></a><p className="muted mt-3 text-xs">Gemini generation and its usage limits are controlled by Google and your signed-in account.</p></div>
        </div>
      </div></section>}

      {file && <section className="shell mt-6"><div className="panel p-5 md:p-7">
        <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">04. Import your Gemini result</h2><p className="muted mt-1 text-sm">Upload the image you downloaded from Gemini.</p></div>{resultFile&&<span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Result added</span>}</div>
        <input ref={resultInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>chooseResult(e.target.files?.[0])}/>
        {resultPreview ? <img src={resultPreview} alt="Gemini generated result" className="mx-auto max-h-[600px] max-w-full rounded-xl object-contain"/> : <button onClick={()=>resultInputRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseResult(e.dataTransfer.files?.[0]);}} className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dcd5f1] bg-[#faf9ff] p-5 text-center hover:border-[#8d78e8]"><ImagePlus size={30} className="mb-3 text-[#7357e8]"/><span className="font-bold">Upload Gemini result</span><span className="muted mt-1 text-sm">Click here to choose the generated image</span></button>}
        {resultFile && <div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={retry} className="secondary flex items-center gap-2"><RefreshCw size={16}/> Retry with Gemini</button><a href={resultPreview} download="vectorify-result.png" className="primary flex items-center gap-2"><Download size={16}/> Download result</a><button onClick={()=>resultInputRef.current?.click()} className="secondary">Replace result</button></div>}
      </div></section>}

      <footer className="shell mt-16 border-t border-[#eceaf3] pt-6 text-center text-xs text-[#9290a0]">Vectorify AI · Personal Gemini workflow · Generated images are raster outputs, not editable SVG/EPS files.</footer>
    </main>
  );
}