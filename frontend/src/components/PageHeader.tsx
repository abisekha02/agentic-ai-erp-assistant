export default function PageHeader({ title, crumbs }: { title: string; crumbs: string[] }) {
  return (
    <div className="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-2">
      <h1 className="text-[26px] font-bold leading-tight text-ink">{title}</h1>
      <p className="text-[15px] text-muted">
        {crumbs.map((c, i) => (
          <span key={c}>{i > 0 && <span className="mx-1.5">/</span>}<span className={i === crumbs.length - 1 ? "text-ink" : ""}>{c}</span></span>
        ))}
      </p>
    </div>
  );
}
