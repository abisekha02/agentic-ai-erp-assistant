import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import KpiCard from "../components/KpiCard";
import LeaveStatus, { dateRange } from "../components/LeaveStatus";
import PageHeader from "../components/PageHeader";
import Shell from "../components/Shell";
import type { LeaveReq } from "../types";

export default function Approvals() {
  const [all, setAll] = useState<LeaveReq[]>([]);
  const [tab, setTab] = useState<"submitted" | "all">("submitted");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => api<LeaveReq[]>("/hr/requests/").then(setAll).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const decide = async (r: LeaveReq, decision: "approve" | "reject") => {
    let note = "";
    if (decision === "reject") {
      const answer = window.prompt(`Reason for rejecting ${r.employee_name}'s request (optional):`, "");
      if (answer === null) return; // cancelled
      note = answer;
    }
    setBusyId(r.id); setError("");
    try {
      await api(`/hr/requests/${r.id}/decision/`, { body: { decision, note } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the decision.");
      await load();
    } finally { setBusyId(null); }
  };

  const count = (s: LeaveReq["status"]) => all.filter((r) => r.status === s).length;
  const rows = tab === "submitted" ? all.filter((r) => r.status === "submitted") : all;
  const tabBtn = (t: "submitted" | "all", label: string) => (
    <button onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === t ? "bg-signal text-white" : "text-muted hover:bg-paper"}`}>{label}</button>
  );

  return (
    <Shell>
      <PageHeader title="Leave Approvals" crumbs={["Northwind", "Apps", "Leave Approvals"]} />
      <div className="grid gap-5 sm:grid-cols-3">
        <KpiCard icon="clock" tone="orange" value={String(count("submitted"))} title="Awaiting decision" subtitle="Requests that need your review" />
        <KpiCard icon="thumb" tone="teal" value={String(count("approved"))} title="Approved" subtitle="Requests you approved" />
        <KpiCard icon="searchx" tone="red" value={String(count("rejected"))} title="Rejected" subtitle="Requests you declined" />
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow-card">
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-bold">Leave requests</h2>
          <div className="flex gap-1 rounded-xl bg-side p-1">{tabBtn("submitted", "Pending")}{tabBtn("all", "All")}</div>
        </div>
        <table className="mt-3 w-full text-left text-[15px]">
          <thead className="bg-side text-xs uppercase tracking-wide text-muted">
            <tr><th className="px-5 py-3 font-semibold">Employee</th><th className="px-3 py-3 font-semibold">Type</th><th className="px-3 py-3 font-semibold">Dates</th><th className="px-3 py-3 font-semibold">Days</th><th className="px-3 py-3 font-semibold">Reason</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-5 py-3" /></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted">{tab === "submitted" ? "Nothing waiting for approval." : "No leave requests yet."}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-rule hover:bg-side">
                <td className="px-5 py-3"><p className="font-semibold text-signal">{r.employee_name}</p><p className="text-xs text-muted">@{r.employee}</p></td>
                <td className="px-3 py-3 capitalize">{r.leave_type}</td>
                <td className="px-3 py-3">{dateRange(r)}</td>
                <td className="px-3 py-3">{r.days}</td>
                <td className="max-w-[14rem] truncate px-3 py-3 text-muted" title={r.reason}>{r.reason || "-"}</td>
                <td className="px-3 py-3">
                  <LeaveStatus status={r.status} />
                  {r.decided_by && <p className="mt-1 text-xs text-muted">by {r.decided_by}</p>}
                </td>
                <td className="space-x-2 whitespace-nowrap px-5 py-3 text-right">
                  {r.status === "submitted" && (
                    <>
                      <button disabled={busyId === r.id} onClick={() => decide(r, "approve")} className="rounded-lg bg-good px-3.5 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">Approve</button>
                      <button disabled={busyId === r.id} onClick={() => decide(r, "reject")} className="rounded-lg border border-rule px-3.5 py-1.5 text-sm font-semibold text-danger hover:bg-red-50 disabled:opacity-50">Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
