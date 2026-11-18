import { useState } from "react";
import type { Msg } from "../types";
import ActionCard from "./ActionCard";

interface Props {
  msg: Msg; busy: boolean;
  onFeedback: (id: number, rating: 1 | -1) => void;
  onDecide: (id: number, d: "approve" | "reject") => void;
}

export default function MessageView({ msg, busy, onFeedback, onDecide }: Props) {
  const [active, setActive] = useState<number | null>(null);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-ink px-4 py-2 text-sm text-white">{msg.content}</p>
      </div>
    );
  }

  // Renders **bold**, "- " bullet lists and clickable [n] citation markers.
  const inline = (text: string, key: string) =>
    text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}${i}`}>{part.slice(2, -2)}</strong>;
      const m = /^\[(\d+)\]$/.exec(part);
      if (!m) return <span key={`${key}${i}`}>{part}</span>;
      const n = Number(m[1]);
      if (!msg.sources.some((s) => s.ref === n)) return null;
      return (
        <button key={`${key}${i}`} onClick={() => setActive(active === n ? null : n)} aria-label={`Show source ${n}`}
          className={`mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 font-sans text-[11px] font-semibold align-baseline ${active === n ? "bg-slip text-white" : "bg-slip-wash text-slip hover:bg-slip-edge"}`}>
          {n}
        </button>
      );
    });

  const blocks: { bullets: boolean; lines: string[] }[] = [];
  for (const raw of msg.content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = /^[-*•]\s+/.test(line);
    const text = bullet ? line.replace(/^[-*•]\s+/, "") : line;
    const last = blocks[blocks.length - 1];
    if (last && last.bullets === bullet && bullet) last.lines.push(text);
    else blocks.push({ bullets: bullet, lines: [text] });
  }
  const parts = blocks.map((blk, bi) =>
    blk.bullets ? (
      <ul key={bi} className="my-1 list-disc space-y-1 pl-5">
        {blk.lines.map((l, li) => <li key={li}>{inline(l, `${bi}-${li}-`)}</li>)}
      </ul>
    ) : (
      <p key={bi} className="my-1">{inline(blk.lines[0], `${bi}-`)}</p>
    ),
  );

  return (
    <div className="max-w-[46rem]">
      <div className="font-serif text-[17px] leading-relaxed">{parts}</div>

      {msg.sources.length > 0 && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Sources">
          {msg.sources.map((s) => (
            <li key={s.ref}>
              <button onClick={() => setActive(active === s.ref ? null : s.ref)}
                className={`flex w-full gap-2 rounded border text-left transition-colors ${active === s.ref ? "border-slip bg-slip-wash" : "border-rule bg-white hover:border-slip-edge"}`}>
                <span className="grid w-7 shrink-0 place-items-center rounded-l bg-slip-wash text-xs font-bold text-slip">{s.ref}</span>
                <span className="min-w-0 py-1.5 pr-2">
                  <span className="block truncate text-sm font-semibold">{s.document}</span>
                  <span className="block text-xs text-muted">{s.location}</span>
                  {active === s.ref && <span className="mt-1 block font-serif text-xs italic text-ink">{s.snippet}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {msg.action && <ActionCard action={msg.action} busy={busy} onDecide={onDecide} />}

      {!msg.action && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted">
          <span className="mr-1">Was this helpful?</span>
          {([1, -1] as const).map((r) => (
            <button key={r} onClick={() => onFeedback(msg.id, r)} aria-pressed={msg.feedback === r}
              className={`rounded border px-2 py-0.5 ${msg.feedback === r ? "border-signal bg-signal-wash text-signal-dark" : "border-rule bg-white hover:bg-paper"}`}>
              {r === 1 ? "Yes" : "No"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}