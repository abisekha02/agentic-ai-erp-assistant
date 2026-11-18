import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import PageHeader from "../components/PageHeader";
import Shell from "../components/Shell";
import type { Stats } from "../types";

const pct = (v: number | null) => (v === null ? "-" : `${v}%`);

function Bar({ label, value, tone }: { label: string; value: number | null; tone: string }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="font-bold">{pct(value)}</span></div>
      <div className="h-2.5 rounded-full bg-paper"><div className={`h-2.5 rounded-full ${tone}`} style={{ width: `${value ?? 0}%` }} /></div>
    </div>
  );
}

export default function Analytics() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Stats>("/chat/stats/").then(setS).catch((e) => setError(e.message)); }, []);

  const max = Math.max(1, ...(s?.daily.map((d) => d.count) ?? [0]));
  const change = s?.questions_change_pct ?? null;

  return (
    <Shell>
      <PageHeader title="Assistant Analytics" crumbs={["Northwind", "Dashboards", "Analytics"]} />
      {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}
      {!s && !error && <p className="text-muted">Loading...</p>}
      {s && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr_1.35fr]">
          <div className="grid gap-5 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
            <KpiCard icon="file" tone="blue" value={String(s.documents.total)} title="Documents" subtitle="Indexed knowledge sources"
              pill={{ text: `${s.documents.ready} ready`, up: null }} />
            <KpiCard icon="chat" tone="cyan" value={String(s.questions_7d)} title="Questions (7 days)" subtitle="Messages sent to the assistant"
              pill={change === null ? undefined : { text: `${change >= 0 ? "+" : ""}${change}%`, up: change >= 0 }} pillNote="vs prior week" />
            <KpiCard icon="searchx" tone="orange" value={pct(s.not_found_rate)} title="Not found rate" subtitle="Questions the documents could not answer"
              pill={{ text: `${s.questions_total} asked`, up: null }} />
            <KpiCard icon="thumb" tone="yellow" value={pct(s.helpful_rate)} title="Helpful answers" subtitle="Thumbs-up share of rated answers"
              pill={{ text: `${s.rated} rated`, up: null }} />
            <KpiCard icon="calendar" tone="red" value={String(s.leave_requests)} title="Leave requests" subtitle="Submitted through the assistant" />
            <KpiCard icon="clock" tone="teal" value={s.avg_latency_s === null ? "-" : `${s.avg_latency_s}s`} title="Response time" subtitle="Average time to answer" />
          </div>

          <section className="rounded-2xl bg-white p-5 shadow-card xl:row-span-1">
            <h2 className="text-lg font-bold">Questions per day</h2>
            <p className="text-sm text-muted">Last 14 days</p>
            {s.daily.every((d) => d.count === 0) ? (
              <p className="mt-10 text-center text-sm text-muted">No questions yet. Ask the assistant something.</p>
            ) : (
              <div className="mt-4 flex h-56 items-end gap-1.5 border-b border-rule">
                {s.daily.map((d) => (
                  <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                    <span className="mb-1 text-[11px] font-medium text-muted">{d.count || ""}</span>
                    <div className="w-full max-w-[18px] rounded-t-full" title={`${d.date}: ${d.count}`}
                      style={{ height: `${Math.max(d.count / max * 100, d.count ? 4 : 0)}%`, background: "linear-gradient(to bottom,#4F6BE8,#B93FDB)" }} />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1.5 flex gap-1.5">
              {s.daily.map((d, i) => <span key={d.date} className="min-w-0 flex-1 text-center text-[10px] text-muted">{i % 2 === 0 ? d.date.slice(8) : ""}</span>)}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-card xl:col-span-1">
            <h2 className="text-lg font-bold">Answer quality</h2>
            <div className="mt-5 space-y-5">
              <Bar label="Helpful" value={s.helpful_rate} tone="bg-good" />
              <Bar label="Not found in documents" value={s.not_found_rate} tone="bg-[#EE7447]" />
            </div>
            <p className="mt-5 text-sm text-muted">A high not-found rate usually means a policy document is missing. Check the downvoted answers.</p>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-card xl:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Most cited documents</h2>
              <Link to="/admin" className="rounded-lg border border-rule px-4 py-1.5 text-sm font-semibold text-muted hover:bg-paper">View documents</Link>
            </div>
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 font-semibold">Document</th><th className="py-2 text-right font-semibold">Citations</th></tr></thead>
              <tbody>
                {s.top_documents.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-muted">No citations yet.</td></tr>}
                {s.top_documents.map((d) => (
                  <tr key={d.document} className="border-t border-rule"><td className="py-2.5 font-semibold text-signal">{d.document}</td><td className="py-2.5 text-right font-bold">{d.count}</td></tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-card xl:col-span-4">
            <h2 className="text-lg font-bold">Answers marked not helpful</h2>
            {s.downvoted.length === 0 ? <p className="mt-3 text-sm text-muted">Nothing here yet.</p> : (
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 font-semibold">User</th><th className="py-2 font-semibold">Question</th><th className="py-2 font-semibold">Answer</th></tr></thead>
                <tbody>
                  {s.downvoted.map((d) => (
                    <tr key={d.id} className="border-t border-rule align-top"><td className="py-2.5 pr-3 font-medium">{d.user}</td><td className="py-2.5 pr-3">{d.question}</td><td className="py-2.5 text-muted">{d.answer}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
