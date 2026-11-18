import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import Shell from "../components/Shell";
import type { Doc } from "../types";

const BADGE: Record<Doc["status"], string> = {
  ready: "bg-[#DFF4F0] text-[#1B8F7E]",
  processing: "bg-signal-wash text-signal",
  failed: "bg-[#FDE6EB] text-[#D83B5E]",
};

export default function Admin() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [access, setAccess] = useState<"all" | "admin">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => api<Doc[]>("/documents/").then(setDocs).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.append("file", file); fd.append("access_level", access);
    if (title.trim()) fd.append("title", title.trim());
    try {
      await api("/documents/", { body: fd });
      setFile(null); setTitle("");
      (document.getElementById("file") as HTMLInputElement).value = "";
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed."); }
    finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError("");
    try { await fn(); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Action failed."); }
  };

  const field = "mt-1.5 h-11 w-full rounded-xl border border-rule bg-side px-3.5 text-[15px]";
  return (
    <Shell>
      <PageHeader title="Documents" crumbs={["Northwind", "Apps", "Documents"]} />
      <div className="grid gap-5 sm:grid-cols-3">
        <KpiCard icon="file" tone="blue" value={String(docs.length)} title="Total documents" subtitle="Everything uploaded" />
        <KpiCard icon="thumb" tone="teal" value={String(docs.filter((d) => d.status === "ready").length)} title="Ready" subtitle="Indexed and searchable" />
        <KpiCard icon="searchx" tone="orange" value={String(docs.filter((d) => d.access_level === "admin").length)} title="Admins only" subtitle="Hidden from employees" />
      </div>

      <form onSubmit={upload} className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h2 className="mb-4 text-lg font-bold">Upload a document</h2>
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_auto_auto] md:items-end">
          <label className="text-sm font-semibold">File (PDF or DOCX)
            <input id="file" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={`${field} file:mr-3 file:rounded-lg file:border-0 file:bg-signal-wash file:px-3 file:py-1 file:font-semibold file:text-signal`} />
          </label>
          <label className="text-sm font-semibold">Title (optional)
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="text-sm font-semibold">Who can read it
            <select value={access} onChange={(e) => setAccess(e.target.value as "all" | "admin")} className={field}>
              <option value="all">All employees</option><option value="admin">Admins only</option>
            </select>
          </label>
          <button disabled={!file || busy} className="h-11 rounded-xl bg-signal px-6 text-[15px] font-semibold text-white hover:bg-signal-dark disabled:opacity-50">
            {busy ? "Processing..." : "Upload"}
          </button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-card">
        <h2 className="px-5 pt-5 text-lg font-bold">All documents</h2>
        <table className="mt-3 w-full text-left text-[15px]">
          <thead className="bg-side text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-3 font-semibold">Document</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Chunks</th><th className="px-3 py-3 font-semibold">Access</th><th className="px-5 py-3" /></tr>
          </thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted">No documents yet. Upload a policy to get started.</td></tr>}
            {docs.map((d) => (
              <tr key={d.id} className="border-t border-rule hover:bg-side">
                <td className="px-5 py-3"><p className="font-semibold text-signal">{d.title}</p><p className="text-xs text-muted">{d.original_name}</p>
                  {d.error && <p className="text-xs text-danger">{d.error}</p>}</td>
                <td className="px-3 py-3"><span className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${BADGE[d.status]}`}>{d.status}</span></td>
                <td className="px-3 py-3">{d.chunk_count}</td>
                <td className="px-3 py-3">
                  <select aria-label={`Access for ${d.title}`} value={d.access_level} className="rounded-lg border border-rule bg-white px-2.5 py-1.5 text-sm"
                    onChange={(e) => act(() => api(`/documents/${d.id}/`, { method: "PATCH", body: { access_level: e.target.value } }))}>
                    <option value="all">All employees</option><option value="admin">Admins only</option>
                  </select>
                </td>
                <td className="space-x-4 px-5 py-3 text-right text-sm">
                  <button onClick={() => act(() => api(`/documents/${d.id}/reprocess/`, { method: "POST", body: {} }))} className="font-semibold text-signal hover:underline">Reprocess</button>
                  <button onClick={() => confirm(`Delete "${d.title}" and its indexed text?`) && act(() => api(`/documents/${d.id}/`, { method: "DELETE" }))} className="font-semibold text-danger hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
