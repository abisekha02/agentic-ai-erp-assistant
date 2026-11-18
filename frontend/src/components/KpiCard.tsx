import type { ReactNode } from "react";
import Icon from "./icons";

export type Tone = "blue" | "cyan" | "orange" | "yellow" | "red" | "teal";
const TONES: Record<Tone, string> = {
  blue: "bg-[#EAEEFF] text-[#4E6AE6]",
  cyan: "bg-[#E2F5FA] text-[#25A8CE]",
  orange: "bg-[#FDEBE3] text-[#EE7447]",
  yellow: "bg-[#FFF5D2] text-[#D9AA00]",
  red: "bg-[#FDE6EB] text-[#E5486A]",
  teal: "bg-[#DFF4F0] text-[#1FA38F]",
};

export function Pill({ value, up, children }: { value?: string; up?: boolean | null; children?: ReactNode }) {
  const good = up === true, bad = up === false;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${good ? "bg-[#DFF4F0] text-[#1B8F7E]" : bad ? "bg-[#FDE6EB] text-[#D83B5E]" : "bg-paper text-muted"}`}>
      {up != null && <Icon name={up ? "up" : "down"} className="h-3 w-3" />}
      {value ?? children}
    </span>
  );
}

interface Props {
  icon: "file" | "chat" | "searchx" | "thumb" | "calendar" | "clock";
  tone: Tone; value: string; title: string; subtitle: string;
  pill?: { text: string; up: boolean | null }; pillNote?: string;
}

export default function KpiCard({ icon, tone, value, title, subtitle, pill, pillNote }: Props) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl ${TONES[tone]}`}><Icon name={icon} className="h-7 w-7" /></div>
        <div className="min-w-0 text-right">
          <p className="text-[28px] font-bold leading-none text-ink">{value}</p>
          {pill && <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 text-[13px] text-muted"><Pill value={pill.text} up={pill.up} />{pillNote}</div>}
        </div>
      </div>
      <div className="mt-4 border-t border-dashed border-rule pt-4">
        <p className="text-[17px] font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
