"use client";

import { useState } from "react";
import { confetti, toast } from "@/components/fx";
import { HINTS } from "@/lib/hints";
import { ALL_PROBLEMS, ROADMAP, type Problem } from "@/lib/prep-data";
import { useLeetCode } from "@/lib/srs";
import styles from "./prep.module.css";

export function dueLabel(due?: string) {
  if (!due) return "";
  const [y, m, d] = due.split("-").map(Number);
  const diff = Math.round((new Date(y, m - 1, d).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  if (diff <= 0) return "review due";
  if (diff === 1) return "review tomorrow";
  return `review in ${diff}d`;
}

export function ProblemRow({ p, children }: { p: Problem; children?: React.ReactNode }) {
  const [hint, setHint] = useState(false);
  return (
    <>
      <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer" className={styles.pname}>
        {p.name}
      </a>
      <span className={`${styles.diff} ${styles[p.diff]}`}>{p.diff}</span>
      {p.premium ? <span className="muted small">Premium, free on NeetCode</span> : null}
      <button className={styles.hintBtn} onClick={() => setHint((h) => !h)} aria-expanded={hint}>
        {hint ? "Hide hint" : "Hint"}
      </button>
      {children}
      {hint ? <p className={styles.hint}>{HINTS[p.slug]}</p> : null}
    </>
  );
}

export default function LeetCode() {
  const lc = useLeetCode();
  const [onlyRevisit, setOnlyRevisit] = useState(false);
  const firstOpen = ROADMAP.findIndex((t) => t.problems.some((p) => !lc.done.includes(p.slug)));

  function toggle(slug: string, el: Element) {
    if (lc.done.includes(slug)) {
      lc.unsolve(slug);
      return;
    }
    lc.solve(slug);
    const topic = ROADMAP.find((t) => t.problems.some((p) => p.slug === slug))!;
    const nowDone = new Set([...lc.done, slug]);
    const r = el.getBoundingClientRect();
    if (nowDone.size === ALL_PROBLEMS.length) {
      confetti(r.left, r.top, 160);
      toast("Whole roadmap done. Absolute menace.");
    } else if (topic.problems.every((p) => nowDone.has(p.slug))) {
      confetti(r.left, r.top, 70);
      toast(`${topic.topic}: done. First review in 3 days.`);
    } else toast("Solved. First review in 3 days.");
  }

  return (
    <>
      <div className={styles.overview}>
        <div>
          <h2>
            {lc.done.length} of {ALL_PROBLEMS.length} solved
          </h2>
          <p className="muted">
            Work top to bottom, since each topic builds on the last. Solved problems come back for review at growing gaps
            (3 days, then about a week, then two) so the patterns stick.
          </p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyRevisit} onChange={(e) => setOnlyRevisit(e.target.checked)} />
          Only my revisit list ({lc.revisit.length})
        </label>
      </div>
      <div className="bar" style={{ margin: "4px 0 24px" }}>
        <span style={{ width: `${(lc.done.length / ALL_PROBLEMS.length) * 100}%`, background: "var(--aurora)" }} />
      </div>

      <ol className={styles.topics}>
        {ROADMAP.map((t, i) => {
          const problems = onlyRevisit ? t.problems.filter((p) => lc.revisit.includes(p.slug)) : t.problems;
          if (!problems.length) return null;
          const n = t.problems.filter((p) => lc.done.includes(p.slug)).length;
          return (
            <li key={t.topic}>
              <details className={styles.topic} open={onlyRevisit || i === firstOpen}>
                <summary>
                  <span className={styles.step}>{i + 1}</span>
                  <span className={styles.topicName}>{t.topic}</span>
                  <span className={n === t.problems.length ? "pill offer" : "pill"}>
                    {n}/{t.problems.length}
                  </span>
                </summary>
                <p className={styles.why}>{t.why}</p>
                <ul className={styles.problems}>
                  {problems.map((p) => {
                    const solved = lc.done.includes(p.slug);
                    return (
                      <li key={p.slug} className={solved ? styles.solved : undefined}>
                        <input type="checkbox" checked={solved} onChange={(e) => toggle(p.slug, e.target)} aria-label={`Mark ${p.name} solved`} />
                        <ProblemRow p={p}>
                          {solved && lc.srs[p.slug] ? <span className={styles.due}>{dueLabel(lc.srs[p.slug].due)}</span> : null}
                          <button
                            className={styles.star}
                            aria-pressed={lc.revisit.includes(p.slug)}
                            onClick={() => lc.setRevisit((prev) => (prev.includes(p.slug) ? prev.filter((s) => s !== p.slug) : [...prev, p.slug]))}
                          >
                            {lc.revisit.includes(p.slug) ? "Revisit" : "Mark to revisit"}
                          </button>
                        </ProblemRow>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}
