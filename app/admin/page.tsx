import { DEFAULT_PROMPTS } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const configured = Boolean(process.env.ADMIN_EMAIL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  return <main className="shell min-h-screen py-12"><a href="/" className="text-sm font-semibold text-[#7357e8]">← Back to converter</a><div className="mt-6"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#7357e8]">Vectorify AI</p><h1 className="mt-2 text-3xl font-black">Admin dashboard</h1><p className="muted mt-2">Prompt configuration and application status.</p></div><div className="panel mt-8 p-6"><h2 className="text-lg font-bold">Environment status</h2><p className="muted mt-2 text-sm">Admin email and Supabase server key: {configured ? "Configured" : "Not configured"}</p><p className="muted mt-2 text-xs">This initial dashboard is a setup view. Before public launch, enable Supabase Auth and enforce server-side admin authorization.</p></div><div className="mt-6 grid gap-4 md:grid-cols-3">{Object.entries(DEFAULT_PROMPTS).map(([key,value])=><div className="panel p-5" key={key}><h2 className="font-bold">{key}</h2><p className="muted mt-3 line-clamp-5 text-sm">{value}</p></div>)}</div></main>;
}