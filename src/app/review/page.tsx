"use client";

import { useEffect, useMemo, useState } from "react";
import Checklist from "@/components/Checklist";
import { openFit } from "@/components/FitDrawer";
import { ScoreRing } from "@/components/FitResult";
import { Logo, toast } from "@/components/fx";
import ResumeDrop from "@/components/ResumeDrop";
import { CHECKLISTS } from "@/lib/prep-data";
import { coachRewrite, RadarError, useFits, useRadarUser, useResume, type Rewrite } from "@/lib/radar";
import { reviewAll, type BulletResult } from "@/lib/review";
import { useStored } from "@/lib/store";
import styles from "./review.module.css";

const TABS = [
  { id: "mine", name: "My résumé" },
  { id: "fits", name: "Fit checks" },
  ...CHECKLISTS.map((c) => ({ id: c.id, name: `${c.name} checklist` })),
];

function Grade({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone = pct >= 85 ? "offer" : pct >= 60 ? "applied" : "rejected";
  return <span className={`pill ${tone}`}>{pct}%</span>;
}

function BulletCard({ r, rewrite, onRewrite, busy }: { r: BulletResult; rewrite?: Rewrite; onRewrite: () => void; busy: boolean }) {
  const failing = r.checks.filter((c) => !c.ok);
  return (
    <li className={styles.result}>
      <div className={styles.resultHead}>
        <p className={styles.bullet}>{r.text}</p>
        <Grade score={r.score} />
      </div>
      {failing.length ? (
        <ul className={styles.checks}>
          {failing.map((c) => (
            <li key={c.id}>
              <span className={styles.label}>{c.label}</span>
              <span>{c.fix}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.pass}>Passes every check.</p>
      )}
      {rewrite ? (
        <div className={styles.rewrite}>
          <span className={styles.label}>Suggested rewrite</span>
          <p>{rewrite.rewrite}</p>
          <p className="muted small">{rewrite.why}</p>
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard?.writeText(rewrite.rewrite);
              toast("Rewrite copied.");
            }}
          >
            Copy
          </button>
        </div>
      ) : failing.length ? (
        <button className={`btn ghost ${styles.rewriteBtn}`} onClick={onRewrite} disabled={busy}>
          {busy ? "Rewriting…" : "Rewrite with AI"}
        </button>
      ) : null}
    </li>
  );
}

function MyResume() {
  const [resume] = useResume();
  const [draft, setDraft] = useStored<string>("review.draft", "");
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState("");
  const [rewrites, setRewrites] = useStored<Record<string, Rewrite>>("rewrites", {});
  const [busy, setBusy] = useState<string | "all" | null>(null);
  const [err, setErr] = useState("");
  const [user, setUser] = useRadarUser();

  // The bullets under review: what was pulled from the PDF, unless you've edited them by hand
  const source = draft.trim() ? draft : (resume?.bullets ?? []).map((b) => `• ${b}`).join("\n");
  const results = useMemo(() => reviewAll(source), [source]);
  const avg = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;
  const needsWork = results.filter((r) => r.score < 0.85);
  const weak = needsWork.filter((r) => !rewrites[r.text]);

  async function rewrite(targets: BulletResult[], tag: string) {
    if (!targets.length) return;
    setBusy(tag);
    setErr("");
    try {
      const { suggestions } = await coachRewrite(targets.map((t) => t.text), role || undefined);
      setRewrites((prev) => {
        const next = { ...prev };
        targets.forEach((t, i) => suggestions[i] && (next[t.text] = suggestions[i]));
        return next;
      });
      toast(`Rewrote ${targets.length} bullet${targets.length === 1 ? "" : "s"}.`);
    } catch (e) {
      setErr(e instanceof RadarError ? e.message : "Rewrites failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.stack}>
      <ResumeDrop />

      {results.length ? (
        <>
          <div className={styles.scoreBar}>
            <ScoreRing score={avg * 100} size={76} label={`Bullets average ${Math.round(avg * 100)} percent`} />
            <div className={styles.scoreText}>
              <h2>
                {results.length} bullets, averaging {Math.round(avg * 100)}%
              </h2>
              <p className="muted">
                {results.filter((r) => r.score >= 0.85).length} pass every check.{" "}
                {!needsWork.length
                  ? "Nothing left to fix."
                  : weak.length
                    ? `${needsWork.length} could be stronger.`
                    : `${needsWork.length} could be stronger, and each has a suggested rewrite below.`}
              </p>
            </div>
            <div className={styles.scoreActions}>
              <input
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Target role (optional)"
                aria-label="Target role for rewrites"
              />
              <button className="btn white" onClick={() => rewrite(weak.slice(0, 15), "all")} disabled={!weak.length || busy !== null}>
                {busy === "all" ? "Rewriting…" : weak.length ? `Rewrite ${Math.min(weak.length, 15)} weak bullet${weak.length === 1 ? "" : "s"}` : "All weak bullets rewritten"}
              </button>
              <button className="btn ghost" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
                {editing ? "Done editing" : "Edit bullets"}
              </button>
            </div>
          </div>
          {err ? (
            <p className={styles.err} role="alert">
              {err}
            </p>
          ) : null}
          {editing ? (
            <label className="field">
              <span>One bullet per line. Clear this box to go back to the bullets from your PDF.</span>
              <textarea className="textarea" rows={12} value={source} onChange={(e) => setDraft(e.target.value)} />
            </label>
          ) : null}
          <ol className={styles.results}>
            {results
              .slice()
              .sort((a, b) => a.score - b.score)
              .map((r) => (
                <BulletCard key={r.text} r={r} rewrite={rewrites[r.text]} busy={busy === r.text || busy === "all"} onRewrite={() => rewrite([r], r.text)} />
              ))}
          </ol>
        </>
      ) : resume ? (
        <div className="empty">
          <strong>No bullet points found in that PDF</strong>
          Some templates draw bullets as shapes. Use Edit bullets to paste them in instead.
          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setEditing(true)}>
              Edit bullets
            </button>
          </div>
          {editing ? (
            <textarea className="textarea" rows={10} style={{ marginTop: 12 }} value={draft} onChange={(e) => setDraft(e.target.value)} />
          ) : null}
        </div>
      ) : null}

      <details className={styles.settings}>
        <summary>ResumeRadar connection</summary>
        <p className="muted small">
          Fit checks, tailoring and mock interviews run on your ResumeRadar API. This ID groups them in ResumeRadar&apos;s
          tables. Use your ResumeRadar user ID to see northbound&apos;s practice sessions there too.
        </p>
        <input className="input" value={user} onChange={(e) => setUser(e.target.value.trim() || "northbound")} aria-label="ResumeRadar user ID" />
      </details>
    </div>
  );
}

function FitChecks() {
  const [fits] = useFits();
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const list = Object.values(fits).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
  return (
    <div className={styles.stack}>
      <form
        className={styles.newCheck}
        onSubmit={(e) => {
          e.preventDefault();
          if (company.trim() && title.trim()) openFit({ company: company.trim(), title: title.trim() });
        }}
      >
        <div className={styles.newCheckText}>
          <strong>Check a job that isn&apos;t on the board</strong>
          <span className="muted small">myExperience, a referral, LinkedIn. You&apos;ll paste the description next.</span>
        </div>
        <input className="input" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} aria-label="Company" />
        <input className="input" placeholder="Role" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Role" />
        <button className="btn white" type="submit" disabled={!company.trim() || !title.trim()}>
          Check fit
        </button>
      </form>

      {list.length ? (
        <ul className={styles.fitList}>
          {list.map((f) => (
            <li key={f.key}>
              <button className={styles.fitRow} onClick={() => openFit({ company: f.company, title: f.title, url: f.url, id: f.postingId })}>
                <Logo name={f.company} size={36} />
                <span className={styles.fitText}>
                  <strong>{f.company}</strong>
                  <span>{f.title}</span>
                </span>
                <span className={styles.fitMeta}>
                  {f.analysis.keyword_analysis.missing_keywords.length} missing keywords
                </span>
                <ScoreRing score={f.analysis.fit_score} size={48} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty">
          <strong>No fit checks yet</strong>
          Hit Check fit on any posting and the result lands here.
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const [tab, setTab] = useState("mine");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, []);
  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Résumé</h1>
        <p>Upload it once. Every bullet gets checked, any posting can be scored, and weak lines get rewritten.</p>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        <MyResume />
      ) : tab === "fits" ? (
        <FitChecks />
      ) : (
        <div style={{ maxWidth: 680 }}>
          <Checklist list={CHECKLISTS.find((c) => c.id === tab)!} />
        </div>
      )}
    </div>
  );
}
