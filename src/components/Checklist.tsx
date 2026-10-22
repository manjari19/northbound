"use client";

import type { Checklist as C } from "@/lib/prep-data";
import { useStored } from "@/lib/store";

export default function Checklist({ list }: { list: C }) {
  const [checks, setChecks] = useStored<Record<string, boolean>>("checks", {});
  const done = list.items.filter((i) => checks[`${list.id}.${i.id}`]).length;
  return (
    <div>
      <p className="muted small" style={{ margin: "0 0 10px" }}>
        {done} of {list.items.length} done
      </p>
      <div className="bar" style={{ marginBottom: 18 }}>
        <span style={{ width: `${(done / list.items.length) * 100}%`, background: "var(--teal)" }} />
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 2 }}>
        {list.items.map((item) => {
          const k = `${list.id}.${item.id}`;
          return (
            <li key={k}>
              <label className="toggle" style={{ color: checks[k] ? "var(--muted)" : "var(--text)", padding: "7px 0", fontSize: 15, alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={!!checks[k]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [k]: e.target.checked }))}
                  style={{ marginTop: 3, flex: "none" }}
                />
                <span style={{ textDecoration: checks[k] ? "line-through" : "none" }}>{item.text}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
