import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import MessageView from "../components/MessageView";
import type { Conversation, Msg, PendingAction } from "../types";

const STARTERS = [
  "What is the company's leave policy?",
  "How many annual leave days do I have left?",
  "How do I request a laptop?",
  "Book annual leave for next Monday and Tuesday",
];

export default function Chat() {
  const { user, logout } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(() => api<Conversation[]>("/chat/conversations/").then(setConvs).catch(() => {}), []);
  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, sending]);

  const open = async (id: number | null) => {
    setActiveId(id); setError("");
    if (id === null) { setMsgs([]); return; }
    try { setMsgs((await api<{ messages: Msg[] }>(`/chat/conversations/${id}/`)).messages); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load the conversation."); }
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || sending) return;
    setInput(""); setError(""); setSending(true);
    const temp: Msg = { id: -Date.now(), role: "user", content: t, sources: [], feedback: null, action: null, created_at: "" };
    setMsgs((m) => [...m, temp]);
    try {
      const r = await api<{ conversation_id: number; message: Msg }>("/chat/ask/", { body: { message: t, conversation_id: activeId } });
      setActiveId(r.conversation_id);
      setMsgs((m) => [...m, r.message]);
      loadConvs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setSending(false); }
  };

  const decide = async (actionId: number, decision: "approve" | "reject") => {
    setSending(true); setError("");
    try {
      const r = await api<{ message: Msg; action: PendingAction }>(`/chat/actions/${actionId}/decision/`, { body: { decision } });
      setMsgs((m) => [...m.map((x) => (x.action?.id === actionId ? { ...x, action: r.action } : x)), r.message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record your decision.");
    } finally { setSending(false); }
  };

  const feedback = async (id: number, rating: 1 | -1) => {
    setMsgs((m) => m.map((x) => (x.id === id ? { ...x, feedback: rating } : x)));
    api(`/chat/messages/${id}/feedback/`, { body: { rating } }).catch(() => setError("Could not save your feedback."));
  };

  const remove = async (id: number) => {
    await api(`/chat/conversations/${id}/`, { method: "DELETE" });
    if (id === activeId) open(null);
    loadConvs();
  };

  const submit = (e: FormEvent) => { e.preventDefault(); send(input); };

  return (
    <div className="flex h-screen">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-rule bg-white md:flex">
        <div className="p-4">
          <p className="font-serif text-lg font-semibold leading-tight">Northwind Knowledge Assistant</p>
          <button onClick={() => open(null)} className="mt-3 w-full rounded bg-signal px-3 py-2 text-sm font-semibold text-white hover:bg-signal-dark">
            New conversation
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2" aria-label="Conversations">
          {convs.length === 0 && <p className="px-2 text-sm text-muted">Your conversations will appear here.</p>}
          {convs.map((c) => (
            <div key={c.id} className={`group flex items-center rounded ${c.id === activeId ? "bg-signal-wash" : "hover:bg-paper"}`}>
              <button onClick={() => open(c.id)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm">{c.title}</button>
              <button onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`} className="px-2 text-xs text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100">Delete</button>
            </div>
          ))}
        </nav>
        <div className="border-t border-rule p-4 text-sm">
          <p className="font-medium">{user?.first_name || user?.username}</p>
          <p className="text-xs capitalize text-muted">{user?.role}</p>
          <div className="mt-2 flex gap-3">
            {user?.role === "admin" && <Link to="/admin" className="text-signal underline">Manage documents</Link>}
            <button onClick={logout} className="text-signal underline">Sign out</button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10">
          {msgs.length === 0 ? (
            <div className="mx-auto mt-[12vh] max-w-xl">
              <h1 className="font-serif text-3xl font-semibold">What do you need to know?</h1>
              <p className="mt-2 text-muted">Answers come from your company's documents, with the page they were found on.</p>
              <div className="mt-6 grid gap-2">
                {STARTERS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded border border-rule bg-white px-4 py-2.5 text-left text-sm hover:border-signal">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {msgs.map((m) => <MessageView key={m.id} msg={m} busy={sending} onFeedback={feedback} onDecide={decide} />)}
              {sending && <p className="text-sm text-muted" role="status">Searching the documents...</p>}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-rule bg-white px-4 py-3 md:px-10">
          {error && <p role="alert" className="mx-auto mb-2 max-w-3xl text-sm text-danger">{error}</p>}
          <form onSubmit={submit} className="mx-auto flex max-w-3xl gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} aria-label="Your question"
              placeholder="Ask about a policy, or request leave" className="min-w-0 flex-1 rounded border border-rule px-3 py-2 text-sm" />
            <button disabled={sending || !input.trim()} className="rounded bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Send</button>
          </form>
        </div>
      </main>
    </div>
  );
}
