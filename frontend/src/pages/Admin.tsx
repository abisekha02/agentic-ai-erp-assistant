import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Doc } from "../types";

const BADGE: Record<Doc["status"], string> = {
  ready: "bg-signal-wash text-signal-dark",
  processing: "bg-slip-wash text-slip",
  failed: "bg-red-50 text-danger",
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="text-sm text-signal underline">Back to chat</Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold">Documents</h1>
      <p className="mt-1 text-sm text-muted">Employees can only get answers from documents marked "All employees".</p>

      <form onSubmit={upload} className="mt-6 grid gap-3 rounded-lg border border-rule bg-white p-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
        <label className="text-sm font-medium">File (PDF or DOCX)
          <input id="file" type="file" accept=".pdf,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
        </label>
        <label className="text-sm font-medium">Title (optional)
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-rule px-3 py-2 text-sm" />
        </label>
        <label className="text-sm font-medium">Who can read it
          <select value={access} onChange={(e) => setAccess(e.target.value as "all" | "admin")} className="mt-1 w-full rounded border border-rule px-3 py-2 text-sm">
            <option value="all">All employees</option><option value="admin">Admins only</option>
          </select>
        </label>
        <button disabled={!file || busy} className="rounded bg-signal px-4 py-2 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-50">
          {busy ? "Processing..." : "Upload"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-lg border border-rule bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-rule text-muted">
            <tr><th className="p-3 font-medium">Document</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Chunks</th><th className="p-3 font-medium">Access</th><th className="p-3" /></tr>
          </thead>
          <tbody>
            {docs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted">No documents yet. Upload a policy to get started.</td></tr>}
            {docs.map((d) => (
              <tr key={d.id} className="border-b border-rule last:border-0">
                <td className="p-3"><p className="font-medium">{d.title}</p><p className="text-xs text-muted">{d.original_name}</p>
                  {d.error && <p className="text-xs text-danger">{d.error}</p>}</td>
                <td className="p-3"><span className={`rounded px-2 py-0.5 text-xs font-medium ${BADGE[d.status]}`}>{d.status}</span></td>
                <td className="p-3">{d.chunk_count}</td>
                <td className="p-3">
                  <select aria-label={`Access for ${d.title}`} value={d.access_level} className="rounded border border-rule px-2 py-1"
                    onChange={(e) => act(() => api(`/documents/${d.id}/`, { method: "PATCH", body: { access_level: e.target.value } }))}>
                    <option value="all">All employees</option><option value="admin">Admins only</option>
                  </select>
                </td>
                <td className="space-x-3 p-3 text-right">
                  <button onClick={() => act(() => api(`/documents/${d.id}/reprocess/`, { method: "POST", body: {} }))} className="text-signal underline">Reprocess</button>
                  <button onClick={() => confirm(`Delete "${d.title}" and its indexed text?`) && act(() => api(`/documents/${d.id}/`, { method: "DELETE" }))} className="text-danger underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
