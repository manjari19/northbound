import { STATUSES, type Application } from "@/lib/postings";

const COLORS: Record<string, string> = {
  saved: "#4a536d",
  applied: "color-mix(in srgb, var(--violet) 55%, #0a0d14)",
  oa: "color-mix(in srgb, var(--violet) 78%, #0a0d14)",
  interview: "var(--violet)",
  offer: "var(--aurora)",
  rejected: "color-mix(in srgb, var(--red) 60%, #0a0d14)",
};

export default function Pipeline({ apps }: { apps: Application[] }) {
  const counts = STATUSES.map((s) => ({ ...s, n: apps.filter((a) => a.status === s.id).length }));
  const total = apps.length || 1;
  return (
    <div>
      <div className="bar" role="img" aria-label={counts.map((c) => `${c.label} ${c.n}`).join(", ")}>
        {counts.map((c) => (c.n ? <span key={c.id} style={{ width: `${(c.n / total) * 100}%`, background: COLORS[c.id] }} /> : null))}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexWrap: "wrap", gap: "8px 18px" }}>
        {counts.map((c) => (
          <li key={c.id} className="small" style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[c.id], flex: "none" }} />
            <span className="muted">{c.label}</span>
            <strong style={{ fontVariantNumeric: "tabular-nums" }}>{c.n}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
