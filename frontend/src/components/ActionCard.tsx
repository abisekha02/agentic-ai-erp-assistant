import type { PendingAction } from "../types";

const LABEL: Record<PendingAction["status"], string> = {
  pending: "Waiting for your approval",
  executed: "Submitted",
  rejected: "Cancelled",
  failed: "Could not be submitted",
};

export default function ActionCard({ action, busy, onDecide }: {
  action: PendingAction; busy: boolean; onDecide: (id: number, d: "approve" | "reject") => void;
}) {
  const p = action.payload;
  const rows: [string, string][] = [
    ["Type", `${p.leave_type} leave`], ["From", p.start_date], ["To", p.end_date],
    ["Working days", String(p.days)], ["Reason", p.reason || "Not given"],
  ];
  return (
    <section className="mt-3 max-w-md rounded-md border border-slip-edge bg-slip-wash" aria-label="Action awaiting approval">
      <header className="flex items-center justify-between border-b border-slip-edge px-4 py-2">
        <h3 className="text-sm font-semibold text-slip">Leave request</h3>
        <span className="text-xs font-medium text-slip">{LABEL[action.status]}</span>
      </header>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 px-4 py-3 text-sm">
        {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>))}
      </dl>
      {action.status === "pending" ? (
        <footer className="flex gap-2 border-t border-slip-edge px-4 py-3">
          <button disabled={busy} onClick={() => onDecide(action.id, "approve")}
            className="rounded bg-signal px-3 py-1.5 text-sm font-semibold text-white hover:bg-signal-dark disabled:opacity-60">Approve and submit</button>
          <button disabled={busy} onClick={() => onDecide(action.id, "reject")}
            className="rounded border border-rule bg-white px-3 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-60">Cancel</button>
        </footer>
      ) : action.result ? (
        <footer className="border-t border-slip-edge px-4 py-2 text-xs text-muted">{action.result}</footer>
      ) : null}
    </section>
  );
}
