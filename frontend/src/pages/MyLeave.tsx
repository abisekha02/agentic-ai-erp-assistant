import { useEffect, useState } from "react";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import LeaveStatus, { dateRange } from "../components/LeaveStatus";
import PageHeader from "../components/PageHeader";
import Shell from "../components/Shell";
import type { Balance, LeaveReq } from "../types";

export default function MyLeave() {
  const [data, setData] = useState<{ balance: Balance; requests: LeaveReq[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<{ balance: Balance; requests: LeaveReq[] }>("/hr/my/").then(setData).catch((e) => setError(e.message)); }, []);

  return (
    <Shell>
      <PageHeader title="My Leave" crumbs={["Northwind", "Apps", "My Leave"]} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!data && !error && <p className="text-muted">Loading...</p>}
      {data && (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon="calendar" tone="blue" value={String(data.balance.remaining)} title="Days remaining" subtitle="Annual leave you can still request" />
            <KpiCard icon="thumb" tone="teal" value={String(data.balance.taken)} title="Days taken" subtitle="Approved and already used" />
            <KpiCard icon="clock" tone="orange" value={String(data.balance.pending)} title="Awaiting approval" subtitle="Reserved until a manager decides" />
            <KpiCard icon="file" tone="cyan" value={String(data.balance.annual_total)} title="Yearly allowance" subtitle="Annual leave per calendar year" />
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-card">
            <h2 className="px-5 pt-5 text-lg font-bold">My requests</h2>
            <p className="px-5 text-sm text-muted">To request leave, ask the assistant, for example "Book annual leave next Monday and Tuesday".</p>
            <table className="mt-3 w-full text-left text-[15px]">
              <thead className="bg-side text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-5 py-3 font-semibold">Type</th><th className="px-3 py-3 font-semibold">Dates</th><th className="px-3 py-3 font-semibold">Days</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Decision</th></tr>
              </thead>
              <tbody>
                {data.requests.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted">No leave requests yet.</td></tr>}
                {data.requests.map((r) => (
                  <tr key={r.id} className="border-t border-rule">
                    <td className="px-5 py-3 font-semibold capitalize text-signal">{r.leave_type}</td>
                    <td className="px-3 py-3">{dateRange(r)}</td>
                    <td className="px-3 py-3">{r.days}</td>
                    <td className="px-3 py-3"><LeaveStatus status={r.status} /></td>
                    <td className="px-5 py-3 text-sm text-muted">
                      {r.decided_by ? <>By {r.decided_by}{r.decision_note && <span className="block italic">"{r.decision_note}"</span>}</> : "Pending"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Shell>
  );
}
