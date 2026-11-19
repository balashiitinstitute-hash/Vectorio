"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check, Download, ImagePlus, RefreshCw, Sparkles, UploadCloud, X } from "lucide-react";

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
  const [output, setOutput] = useState("");
  const [type, setType] = useState<VectorType>("vector-illustration");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");

  function chooseImage(next: File | undefined) {
    if (!next) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(next.type)) { setError("Please choose a PNG, JPG, or WEBP image."); return; }
    if (next.size > 10 * 1024 * 1024) { setError("Image must be 10 MB or smaller."); return; }
    setFile(next); setPreview(URL.createObjectURL(next)); setOutput(""); setError(""); setJobId("");
  }

  async function convert(retry = false) {
    if (!file) { setError("Upload an image first."); return; }
    setLoading(true); setError("");
    try {
      const body = new FormData();
      body.append("image", file);
      body.append("vectorType", type);
      if (retry && jobId) body.append("retryOf", jobId);
      const response = await fetch("/api/convert", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Conversion failed. Please try again.");
      setOutput(data.imageUrl);
      setJobId(data.conversionId || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setLoading(false); }
  }

  function reset() {
    setFile(null); setPreview(""); setOutput(""); setError(""); setJobId("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="min-h-screen pb-16">
      <header className="shell flex h-20 items-center justify-between">
        <a href="/" className="flex items-center gap-2 text-xl font-black tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#7357e8] text-white"><Sparkles size={19}/></span>vectorify<span className="text-[#7357e8]">.ai</span></a>
        <span className="rounded-full border border-[#e8e3f5] bg-white px-4 py-2 text-xs font-semibold text-[#6f55d9]">AI IMAGE STUDIO</span>
      </header>

      <section className="shell pt-12 text-center md:pt-16">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e8e2fb] bg-white px-4 py-2 text-xs font-semibold text-[#7257df]"><Sparkles size={14}/> Turn raster into art</div>
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">Transform images into <span className="text-[#7357e8]">vector style.</span></h1>
        <p className="muted mx-auto mt-5 max-w-xl text-base leading-7">Upload an image, choose your style, and let AI create a clean new artwork in seconds.</p>
      </section>

      <section className="shell mt-12 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="panel p-5 md:p-7">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">01. Upload image</h2><p className="muted mt-1 text-sm">PNG, JPG or WEBP · Up to 10 MB</p></div>{file && <button onClick={reset} className="secondary flex items-center gap-2 text-sm"><X size={15}/> Clear</button>}</div>
          <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();chooseImage(e.dataTransfer.files?.[0]);}} onClick={()=>inputRef.current?.click()} className="flex min-h-[310px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#dcd5f1] bg-[#faf9ff] p-5 text-center hover:border-[#8d78e8]">
            {preview ? <img src={preview} alt="Original upload" className="max-h-[285px] max-w-full rounded-xl object-contain"/> : <><div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#eee9ff] text-[#7357e8]"><UploadCloud size={30}/></div><p className="font-bold">Drop your image here</p><p className="muted mt-2 text-sm">or click to browse files</p><span className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold shadow-sm"><ImagePlus className="mr-2 inline" size={16}/> Choose image</span></>}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>chooseImage(e.target.files?.[0])}/>
          <p className="muted mt-3 text-xs">Tip: You can also paste an image from your clipboard (Ctrl + V) when this page is active.</p>
        </div>

        <div className="panel p-5 md:p-7">
          <h2 className="text-lg font-bold">02. Choose vector type</h2><p className="muted mt-1 text-sm">Select the look you want to create.</p>
          <div className="mt-5 space-y-3">{styles.map(s=><button key={s.id} onClick={()=>{setType(s.id);setOutput("");}} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${type===s.id?"border-[#8c77e9] bg-[#f6f3ff]":"border-[#eceaf3] bg-white hover:border-[#c9c0e9]"}`}><span><span className="block font-bold">{s.title}</span><span className="muted mt-1 block text-sm">{s.description}</span></span><span className={`grid h-6 w-6 place-items-center rounded-full border ${type===s.id?"border-[#7357e8] bg-[#7357e8] text-white":"border-[#ddd9e8]"}`}>{type===s.id&&<Check size={14}/>}</span></button>)}</div>
          <button disabled={!file||loading} onClick={()=>convert(false)} className="primary mt-6 flex w-full items-center justify-center gap-2">{loading?<><RefreshCw className="animate-spin" size={18}/> Creating artwork...</>:<> <Sparkles size={18}/> Convert image <ArrowRight size={17}/></>}</button>
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {loading && <p className="muted mt-3 text-center text-xs">AI is processing your original image. Please keep this page open.</p>}
        </div>
      </section>

      {(output || loading) && <section className="shell mt-6"><div className="panel p-5 md:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold">03. Your result</h2><p className="muted mt-1 text-sm">AI-generated image preview</p></div>{output&&<span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Complete</span>}</div>{loading?<div className="grid min-h-64 place-items-center text-center"><div><RefreshCw className="mx-auto animate-spin text-[#7357e8]" size={30}/><p className="mt-3 font-semibold">Creating your artwork...</p></div></div>:<><img src={output} alt="Generated result" className="mx-auto max-h-[650px] max-w-full rounded-xl object-contain"/><div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={()=>convert(true)} disabled={loading} className="secondary flex items-center gap-2"><RefreshCw size={16}/> Retry</button><a href={output} download="vectorify-output.png" className="primary flex items-center gap-2"><Download size={16}/> Download PNG</a></div></>}</div></section>}

      <footer className="shell mt-16 border-t border-[#eceaf3] pt-6 text-center text-xs text-[#9290a0]">Vectorify AI · AI-generated vector-style images are raster outputs, not editable SVG/EPS files.</footer>
    </main>
  );
}