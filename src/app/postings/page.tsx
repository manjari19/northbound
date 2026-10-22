"use client";

import { useMemo, useState } from "react";
import TrackSelect from "@/components/TrackSelect";
import { ageLabel, daysAgo, relativeTime, useApps, useFeed, type Posting } from "@/lib/postings";
import styles from "./postings.module.css";

const CATEGORIES = ["Software", "Data & ML", "Product", "Hardware", "Quant", "Other"] as const;
const PAGE = 60;

export default function PostingsPage() {
  const { feed, error } = useFeed();
  const [apps] = useApps();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<string[]>(["Software", "Data & ML", "Product"]);
  const [term, setTerm] = useState("");
  const [freshOnly, setFreshOnly] = useState(false);
  const [hideTracked, setHideTracked] = useState(false);
  const [bc, setBc] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const terms = useMemo(() => {
    const set = new Set<string>();
    feed?.postings.forEach((p) => p.terms.forEach((t) => set.add(t)));
    const order = (t: string) => {
      const [s, y] = t.split(" ");
      return Number(y) * 10 + ["Winter", "Spring", "Summer", "Fall"].indexOf(s);
    };
    return [...set].sort((a, b) => order(b) - order(a));
  }, [feed]);

  const tracked = useMemo(() => new Set(apps.map((a) => a.postingId).filter(Boolean)), [apps]);

  const rows = useMemo(() => {
    if (!feed) return [];
    const needle = q.trim().toLowerCase();
    return feed.postings.filter((p: Posting) => {
      if (!cats.includes(p.category)) return false;
      if (term && !p.terms.includes(term)) return false;
      if (freshOnly && (daysAgo(p.posted ?? p.first_seen) ?? 99) > 2) return false;
      if (hideTracked && tracked.has(p.id)) return false;
      if (bc && !p.locations.some((l) => /,\s*BC\b|british columbia|vancouver|burnaby|remote/i.test(l))) return false;
      if (needle && !`${p.company} ${p.title} ${p.locations.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [feed, q, cats, term, freshOnly, hideTracked, bc, tracked]);

  const toggleCat = (c: string) => {
    setLimit(PAGE);
    setCats((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Postings</h1>
        <p>
          {feed
            ? `${feed.count} Canadian internship and co-op roles. Updated ${relativeTime(feed.updated_at)}.`
            : error ?? "Loading…"}
        </p>
      </header>

      <div className={styles.filters} role="search">
        <input
          className="input"
          type="search"
          placeholder="Search company, role or city"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE);
          }}
          aria-label="Search postings"
        />
        <select className="select" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Work term">
          <option value="">Any term</option>
          {terms.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <div className="chips" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <button key={c} className="chip" aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className={styles.toggles}>
          <label className="toggle">
            <input type="checkbox" checked={freshOnly} onChange={(e) => setFreshOnly(e.target.checked)} />
            Posted in the last 2 days
          </label>
          <label className="toggle">
            <input type="checkbox" checked={bc} onChange={(e) => setBc(e.target.checked)} />
            BC or remote
          </label>
          <label className="toggle">
            <input type="checkbox" checked={hideTracked} onChange={(e) => setHideTracked(e.target.checked)} />
            Hide ones I&apos;m tracking
          </label>
        </div>
      </div>

      <p className="muted small" aria-live="polite" style={{ margin: "18px 0 10px" }}>
        {feed ? `Showing ${Math.min(limit, rows.length)} of ${rows.length}` : ""}
      </p>

      {feed && rows.length === 0 ? (
        <div className="empty">
          <strong>No postings match those filters</strong>
          Try another category or clear the search.
        </div>
      ) : null}

      <ul className={styles.list}>
        {rows.slice(0, limit).map((p) => {
          const age = daysAgo(p.posted ?? p.first_seen) ?? 99;
          return (
            <li key={p.id} className={styles.row}>
              <div className={styles.main}>
                <div className={styles.company}>{p.company}</div>
                <div className={styles.title}>{p.title}</div>
                <div className={styles.meta}>
                  <span>{p.locations.join("; ") || "Canada"}</span>
                  {p.terms.length ? <span>{p.terms.join(", ")}</span> : null}
                  <span>{p.category}</span>
                </div>
              </div>
              <div className={styles.age}>
                {age <= 1 ? <span className="pill new">{ageLabel(p)}</span> : <span className="muted">{ageLabel(p)}</span>}
              </div>
              <div className={styles.actions}>
                <a className="btn amber" href={p.url} target="_blank" rel="noreferrer">
                  Apply
                </a>
                <TrackSelect posting={p} />
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length > limit ? (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
