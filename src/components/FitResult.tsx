"use client";

import { useState } from "react";
import { toast } from "@/components/fx";
import { coachTailor, rankBulletsForJob, RadarError, type Analysis, type Tailoring, type Resume } from "@/lib/radar";
import styles from "./radar.module.css";

const LEVEL_COLOR: Record<string, string> = {
  Excellent: "var(--aurora)",
  Strong: "var(--aurora)",
  Moderate: "var(--violet)",
  Weak: "var(--star)",
  Poor: "var(--red)",
};

export function ScoreRing({ score, size = 96, label }: { score: number; size?: number; label?: string }) {
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "var(--aurora)" : score >= 50 ? "var(--violet)" : score >= 30 ? "var(--star)" : "var(--red)";
  return (
    <div className={styles.ring} style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(190,210,255,.1)" strokeWidth="7" fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={styles.ringArc}
        />
      </svg>
      <span className={styles.ringNum} style={{ fontSize: size * 0.3 }}>
        {Math.round(score)}
      </span>
      {label ? <span className="sr-only">{label}</span> : null}
    </div>
  );
}

/** Everything ResumeRadar says about one résumé vs one job, plus tailoring. */
export default function FitResult({
  analysis,
  resume,
  jd,
  company,
  role,
}: {
  analysis: Analysis;
  resume: Resume | null;
  jd: string;
  company: string;
  role: string;
}) {
  const [tab, setTab] = useState<"fit" | "tailor">("fit");
  const [tailor, setTailor] = useState<Tailoring | null>(null);
  const [tState, setTState] = useState<"idle" | "loading" | "error">("idle");
  const [tErr, setTErr] = useState("");
  const kw = analysis.keyword_analysis;
  const ranked = resume ? rankBulletsForJob(resume.bullets, [...kw.matched_keywords, ...kw.missing_keywords]).filter((r) => r.hits.length) : [];

  async function runTailor() {
    if (!resume) return;
    setTState("loading");
    setTErr("");
    try {
      const { tailoring } = await coachTailor(resume.text, jd, company, role);
      setTailor(tailoring);
      setTState("idle");
    } catch (e) {
      setTState("error");
      setTErr(e instanceof RadarError ? e.message : "Tailoring failed. Try again.");
    }
  }

  const copy = (t: string) => {
    navigator.clipboard?.writeText(t);
    toast("Copied.");
  };

  return (
    <div className={styles.result}>
      <div className={styles.scoreHead}>
        <ScoreRing score={analysis.fit_score} label={`Fit score ${analysis.fit_score} out of 100`} />
        <div>
          <span className={styles.level} style={{ color: LEVEL_COLOR[analysis.match_level] }}>
            {analysis.match_level} fit
          </span>
          <p className={styles.summary}>{analysis.summary}</p>
          {analysis.scoring_rationale ? <p className="muted small">{analysis.scoring_rationale}</p> : null}
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ marginBottom: 18 }}>
        <button role="tab" aria-selected={tab === "fit"} onClick={() => setTab("fit")}>
          Fit breakdown
        </button>
        <button role="tab" aria-selected={tab === "tailor"} onClick={() => setTab("tailor")}>
          Tailor my résumé
        </button>
      </div>

      {tab === "fit" ? (
        <div className={styles.grid2}>
          <section>
            <h4 className={styles.h4}>Keywords</h4>
            <div className={styles.kws}>
              {kw.matched_keywords.map((k) => (
                <span key={`m-${k}`} className={`${styles.kw} ${styles.kwHit}`}>
                  {k}
                </span>
              ))}
              {kw.missing_keywords.map((k) => (
                <span key={`x-${k}`} className={`${styles.kw} ${styles.kwMiss}`} title="Missing from your résumé">
                  {k}
                </span>
              ))}
            </div>
            <p className="muted small" style={{ marginTop: 8 }}>
              Green is on your résumé. Red is in the posting but not on your résumé.
            </p>
          </section>
          <section>
            <h4 className={styles.h4}>Strengths</h4>
            <ul className={styles.points}>
              {analysis.strengths.map((s, i) => (
                <li key={i}>
                  <strong>{s.category}</strong>
                  <span>{s.evidence}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className={styles.h4}>Gaps</h4>
            <ul className={`${styles.points} ${styles.gaps}`}>
              {analysis.weaknesses.map((s, i) => (
                <li key={i}>
                  <strong>{s.category}</strong>
                  <span>{s.gap}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h4 className={styles.h4}>What to change</h4>
            <ul className={styles.points}>
              {analysis.suggestions.map((s, i) => (
                <li key={i}>
                  <strong>
                    <span className={`${styles.prio} ${styles[s.priority]}`}>{s.priority}</span> {s.recommendation}
                  </strong>
                  <span>{s.reason}</span>
                </li>
              ))}
            </ul>
          </section>
          {analysis.suggested_project ? (
            <section className={styles.project}>
              <h4 className={styles.h4}>Close the biggest gap in {analysis.suggested_project.estimated_time || "1-3 days"}</h4>
              <strong>{analysis.suggested_project.title}</strong>
              <p>{analysis.suggested_project.description}</p>
              <div className={styles.kws}>
                {analysis.suggested_project.technologies.map((t) => (
                  <span key={t} className={styles.kw}>
                    {t}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className={styles.tailor}>
          {ranked.length ? (
            <section>
              <h4 className={styles.h4}>Lead with these bullets</h4>
              <p className="muted small">Your bullets that already hit this posting&apos;s keywords, most first.</p>
              <ol className={styles.ranked}>
                {ranked.slice(0, 5).map((r) => (
                  <li key={r.bullet}>
                    <span>{r.bullet}</span>
                    <span className={styles.kws}>
                      {r.hits.map((h) => (
                        <span key={h} className={`${styles.kw} ${styles.kwHit}`}>
                          {h}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {!tailor ? (
            <div className={styles.aiBox}>
              <div>
                <strong>Full tailoring plan</strong>
                <p className="muted small">Which projects to lead with, keywords you can honestly add, and bullets rewritten toward this job.</p>
              </div>
              <button className="btn white" onClick={runTailor} disabled={tState === "loading" || !resume}>
                {tState === "loading" ? "Tailoring…" : "Tailor for this job"}
              </button>
              {tState === "error" ? (
                <p className={styles.err} role="alert">
                  {tErr}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <section>
                <h4 className={styles.h4}>Lead with</h4>
                <ul className={styles.points}>
                  {tailor.lead_with.map((x, i) => (
                    <li key={i}>
                      <strong>{x.item}</strong>
                      <span>{x.reason}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {tailor.add_keywords.length ? (
                <section>
                  <h4 className={styles.h4}>Keywords you can honestly add</h4>
                  <ul className={styles.points}>
                    {tailor.add_keywords.map((x, i) => (
                      <li key={i}>
                        <strong>{x.keyword}</strong>
                        <span>{x.where}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <section>
                <h4 className={styles.h4}>Bullets, rewritten for this job</h4>
                <ul className={styles.edits}>
                  {tailor.bullet_edits.map((x, i) => (
                    <li key={i}>
                      <span className={styles.before}>{x.original}</span>
                      <span className={styles.after}>{x.rewrite}</span>
                      <button className="btn ghost" onClick={() => copy(x.rewrite)}>
                        Copy
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              {tailor.cut_or_shrink.length ? (
                <section>
                  <h4 className={styles.h4}>Give less space to</h4>
                  <ul className={`${styles.points} ${styles.gaps}`}>
                    {tailor.cut_or_shrink.map((x, i) => (
                      <li key={i}>
                        <strong>{x.item}</strong>
                        <span>{x.reason}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
