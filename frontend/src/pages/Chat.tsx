import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api";
import Icon from "../components/icons";
import MessageView from "../components/MessageView";
import PageHeader from "../components/PageHeader";
import Shell from "../components/Shell";
import type { Conversation, Msg, PendingAction } from "../types";

const STARTERS = [
  "What is the company's leave policy?",
  "How many annual leave days do I have left?",
  "How do I request a laptop?",
  "Book annual leave for next Monday and Tuesday",
];

export default function Chat() {
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
    <Shell fill>
      <PageHeader title="Assistant" crumbs={["Northwind", "Apps", "Assistant"]} />
      <div className="flex min-h-0 flex-1 gap-5">
        <aside className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-2xl bg-white shadow-card md:flex">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-[17px] font-bold">Conversations <span className="ml-1 rounded-md bg-signal-wash px-1.5 py-0.5 text-xs font-semibold text-signal">{convs.length}</span></h2>
            <button onClick={() => open(null)} aria-label="New conversation" title="New conversation"
              className="grid h-9 w-9 place-items-center rounded-lg bg-signal text-white hover:bg-signal-dark"><Icon name="plus" /></button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-label="Conversations">
            {convs.length === 0 && <p className="px-2 py-3 text-sm text-muted">Your conversations will appear here.</p>}
            {convs.map((c) => (
              <div key={c.id} className={`group mb-1 flex items-center rounded-xl ${c.id === activeId ? "bg-signal-wash" : "hover:bg-paper"}`}>
                <button onClick={() => open(c.id)} className={`min-w-0 flex-1 truncate px-3 py-2.5 text-left text-[15px] ${c.id === activeId ? "font-semibold text-signal" : ""}`}>{c.title}</button>
                <button onClick={() => remove(c.id)} aria-label={`Delete ${c.title}`} className="px-3 text-xs text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100">Delete</button>
              </div>
            ))}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
            {msgs.length === 0 ? (
              <div className="mx-auto mt-[6vh] max-w-2xl">
                <h2 className="text-3xl font-bold text-ink">How can I help you today?</h2>
                <p className="mt-2 text-muted">Answers come from your company's documents, with the page they were found on.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-xl border border-rule bg-side px-4 py-3.5 text-left text-[15px] font-medium hover:border-signal hover:bg-signal-wash hover:text-signal">{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-5">
                {msgs.map((m) => <MessageView key={m.id} msg={m} busy={sending} onFeedback={feedback} onDecide={decide} />)}
                {sending && <p className="pl-11 text-sm text-muted" role="status">Searching the documents...</p>}
                <div ref={endRef} />
              </div>
            )}
          </div>
          <div className="border-t border-rule px-5 py-4 md:px-8">
            {error && <p role="alert" className="mx-auto mb-2 max-w-3xl text-sm text-danger">{error}</p>}
            <form onSubmit={submit} className="mx-auto flex max-w-3xl gap-2.5">
              <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} aria-label="Your question"
                placeholder="Ask about a policy, or request leave" className="min-w-0 flex-1 rounded-xl border border-rule bg-side px-4 py-3 text-[15px]" />
              <button disabled={sending || !input.trim()} className="rounded-xl bg-signal px-6 py-3 text-[15px] font-semibold text-white hover:bg-signal-dark disabled:opacity-50">Send</button>
            </form>
          </div>
        </main>
      </div>
    </Shell>
  );
}
