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
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-signal px-4 py-2.5 text-[15px] text-white">{msg.content}</p>
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
          className={`mx-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded px-1 text-[11px] font-semibold align-baseline ${active === n ? "bg-signal text-white" : "bg-signal-wash text-signal-dark hover:bg-blue-200"}`}>
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
    if (last && last.bullets && bullet) last.lines.push(text);
    else blocks.push({ bullets: bullet, lines: [text] });
  }
  const parts = blocks.map((blk, bi) =>
    blk.bullets ? (
      <ul key={bi} className="my-1.5 list-disc space-y-1 pl-5">
        {blk.lines.map((l, li) => <li key={li}>{inline(l, `${bi}-${li}-`)}</li>)}
      </ul>
    ) : (
      <p key={bi} className="my-1.5">{inline(blk.lines[0], `${bi}-`)}</p>
    ),
  );

  return (
    <div className="flex max-w-[48rem] gap-3">
      <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-signal text-[11px] font-bold text-white" aria-hidden>AI</div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-side px-5 py-3 text-[15px] leading-relaxed">{parts}</div>

        {msg.sources.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Sources</p>
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Sources">
              {msg.sources.map((s) => (
                <li key={s.ref}>
                  <button onClick={() => setActive(active === s.ref ? null : s.ref)}
                    className={`flex w-full overflow-hidden rounded-xl border bg-white text-left transition-colors ${active === s.ref ? "border-signal ring-1 ring-signal" : "border-rule hover:border-signal"}`}>
                    <span className="grid w-8 shrink-0 place-items-center bg-signal-wash text-xs font-bold text-signal-dark">{s.ref}</span>
                    <span className="min-w-0 px-2.5 py-1.5">
                      <span className="block truncate text-sm font-semibold text-signal-dark">{s.document}</span>
                      <span className="block text-xs text-muted">{s.location}</span>
                      {active === s.ref && <span className="mt-1.5 block border-t border-rule pt-1.5 text-xs italic text-ink">{s.snippet}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {msg.action && <ActionCard action={msg.action} busy={busy} onDecide={onDecide} />}

        {!msg.action && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
            <span className="mr-1">Was this helpful?</span>
            {([1, -1] as const).map((r) => (
              <button key={r} onClick={() => onFeedback(msg.id, r)} aria-pressed={msg.feedback === r}
                className={`rounded border px-2.5 py-0.5 font-medium ${msg.feedback === r ? "border-signal bg-signal-wash text-signal-dark" : "border-rule bg-white hover:bg-paper"}`}>
                {r === 1 ? "Yes" : "No"}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
