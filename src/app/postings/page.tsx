"use client";

import { useEffect, useMemo, useState } from "react";
import { openFit } from "@/components/FitDrawer";
import FitBadge from "@/components/FitBadge";
import { Logo } from "@/components/fx";
import { Arrow } from "@/components/Nav";
import TrackSelect from "@/components/TrackSelect";
import {
  ageLabel,
  isNew,
  inRegions,
  REGIONS,
  relativeTime,
  termLabel,
  termOrder,
  useApps,
  useFeed,
  useRegions,
  type Posting,
  type Region,
} from "@/lib/postings";
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
  const [onlyIds, setOnlyIds] = useState<Set<string> | null>(null);
  const [hideTracked, setHideTracked] = useState(false);
  const [bc, setBc] = useState(false);
  const [payOnly, setPayOnly] = useState(false);
  const [regions, setRegions] = useRegions();
  const [limit, setLimit] = useState(PAGE);

  const terms = useMemo(() => {
    const set = new Set<string>();
    feed?.postings.forEach((p) => p.terms.forEach((t) => set.add(t)));
    // Soonest term first
    return [...set].sort((a, b) => termOrder(a) - termOrder(b));
  }, [feed]);

  const tracked = useMemo(() => new Set(apps.map((a) => a.postingId).filter(Boolean)), [apps]);

  const rows = useMemo(() => {
    if (!feed) return [];
    const needle = q.trim().toLowerCase();
    return feed.postings.filter((p: Posting) => {
      if (!inRegions(p, regions)) return false;
      if (!cats.includes(p.category)) return false;
      if (payOnly && !p.pay) return false;
      if (term && !p.terms.includes(term)) return false;
      if (onlyIds) return onlyIds.has(p.id);
      if (freshOnly && !isNew(p)) return false;
      if (hideTracked && tracked.has(p.id)) return false;
      if (bc && !p.locations.some((l) => /,\s*BC\b|british columbia|vancouver|burnaby|remote/i.test(l))) return false;
      if (needle && !`${p.company} ${p.title} ${p.locations.join(" ")}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [feed, q, cats, term, freshOnly, hideTracked, bc, tracked, regions, payOnly, onlyIds]);

  const regionCounts = useMemo(() => {
    const c: Record<string, number> = {};
    feed?.postings.forEach((p) => (p.regions?.length ? p.regions : ["Canada"]).forEach((r) => (c[r] = (c[r] ?? 0) + 1)));
    return c;
  }, [feed]);

  const toggleRegion = (r: Region) => {
    setLimit(PAGE);
    setRegions((prev) => {
      const next = prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r];
      return next.length ? next : prev; // keep at least one region on
    });
  };

  // ?fresh=1 (home page) opens with "New today" on. ?ids=a,b,c (alert emails) shows exactly those postings.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fresh")) setFreshOnly(true);
    const ids = params.get("ids");
    if (ids) setOnlyIds(new Set(ids.split(",").filter(Boolean)));
  }, []);

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
            ? `${feed.count.toLocaleString()} internship and co-op roles in Canada and the US. Updated ${relativeTime(feed.updated_at)}.`
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
            <option key={t} value={t}>
              {termLabel(t)}
            </option>
          ))}
        </select>
        <div className={styles.chipRow}>
          <span className={styles.chipLabel}>Where</span>
          <div className="chips" aria-label="Regions">
            {REGIONS.map((r) => (
              <button key={r} className="chip" aria-pressed={regions.includes(r)} onClick={() => toggleRegion(r)}>
                {r} <span className={styles.count}>{(regionCounts[r] ?? 0).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.chipRow}>
          <span className={styles.chipLabel}>What</span>
        <div className="chips" aria-label="Categories">
          {CATEGORIES.map((c) => (
            <button key={c} className="chip" aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
              {c}
            </button>
          ))}
        </div>
        </div>
        <div className={styles.toggles}>
          <label className="toggle">
            <input type="checkbox" checked={freshOnly} onChange={(e) => setFreshOnly(e.target.checked)} />
            New today
          </label>
          <label className="toggle">
            <input type="checkbox" checked={bc} onChange={(e) => setBc(e.target.checked)} />
            BC or remote
          </label>
          <label className="toggle">
            <input type="checkbox" checked={payOnly} onChange={(e) => setPayOnly(e.target.checked)} />
            Pay listed
          </label>
          <label className="toggle">
            <input type="checkbox" checked={hideTracked} onChange={(e) => setHideTracked(e.target.checked)} />
            Hide ones I&apos;m tracking
          </label>
        </div>
      </div>

      {onlyIds ? (
        <div className={styles.fromEmail} role="status">
          <span>
            Showing the {onlyIds.size} posting{onlyIds.size === 1 ? "" : "s"} from your alert email.
          </span>
          <button
            className="btn"
            onClick={() => {
              setOnlyIds(null);
              window.history.replaceState(null, "", "/postings/");
            }}
          >
            Show all postings
          </button>
        </div>
      ) : null}

      <p className="muted small" aria-live="polite" style={{ margin: "18px 0 10px" }}>
        {feed ? `Showing ${Math.min(limit, rows.length)} of ${rows.length.toLocaleString()}` : ""}
      </p>

      {feed && rows.length === 0 ? (
        <div className="empty">
          <strong>No postings match those filters</strong>
          Try another category or clear the search.
        </div>
      ) : null}

      <ul className={styles.list}>
        {rows.slice(0, limit).map((p) => {
          const fresh = isNew(p);
          return (
            <li key={p.id} className={styles.row}>
              <Logo name={p.company} size={40} />
              <div className={styles.main}>
                <div className={styles.company}>{p.company}</div>
                <div className={styles.title}>{p.title}</div>
                <div className={styles.meta}>
                  <span>{p.locations.join("; ") || "Canada"}</span>
                  {p.terms.length ? <span>{p.terms.join(", ")}</span> : null}
                  {p.pay ? <span className={styles.pay}>{p.pay}</span> : null}
                  <span>{p.category}</span>
                </div>
              </div>
              <div className={styles.age}>
                {fresh ? (
                  <span className="pill new" title={`Found today. Posted ${ageLabel(p)} ago by the company.`}>
                    New
                  </span>
                ) : (
                  <span className="muted" title="How long ago the company posted it">
                    {ageLabel(p)}
                  </span>
                )}
              </div>
              <div className={styles.actions}>
                <FitBadge target={p} onClick={() => openFit(p)} />
                <a className="btn amber" href={p.url} target="_blank" rel="noreferrer">
                  Apply <Arrow />
                </a>
                <TrackSelect posting={p} />
              </div>
            </li>
          );
        })}
      </ul>

      {rows.length > limit ? (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button className="btn white" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, rows.length - limit)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
