"use client";

import { useMemo, useState } from "react";
import Checklist from "@/components/Checklist";
import { CHECKLISTS } from "@/lib/prep-data";
import { reviewAll } from "@/lib/review";
import { useStored } from "@/lib/store";
import styles from "./review.module.css";

const SAMPLE = `• Built a web application using React and AWS.
• Responsible for various backend tasks; worked with the team on APIs
• Reduced shelter-bed lookup time by 80% for 12 partner shelters by building an NFC check-in flow with Next.js, Supabase and Twilio`;

type Suggestion = { rewrite: string; why: string };

function Grade({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone = pct >= 85 ? "offer" : pct >= 60 ? "applied" : "rejected";
  return <span className={`pill ${tone}`}>{pct}%</span>;
}

export default function ReviewPage() {
  const [tab, setTab] = useState("bullets");
  const [draft, setDraft] = useStored<string>("review.draft", "");
  const [role, setRole] = useState("");
  const [ai, setAi] = useState<Suggestion[] | null>(null);
  const [aiState, setAiState] = useState<"idle" | "loading" | "error">("idle");
  const [aiMsg, setAiMsg] = useState("");

  const results = useMemo(() => reviewAll(draft), [draft]);
  const avg = results.length ? results.reduce((s, r) => s + r.score, 0) / results.length : 0;

  async function askAi() {
    setAiState("loading");
    setAi(null);
    setAiMsg("");
    try {
      const res = await fetch("/.netlify/functions/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bullets: results.map((r) => r.text), role }),
      });
      if (res.status === 404 || res.status === 501) {
        setAiState("error");
        setAiMsg("AI rewrites aren't set up yet. Add ANTHROPIC_API_KEY in your Netlify environment variables and redeploy.");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setAi(data.suggestions);
      setAiState("idle");
    } catch (e) {
      setAiState("error");
      setAiMsg(e instanceof Error ? e.message : "Something went wrong reaching the AI rewrite function.");
    }
  }

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Résumé</h1>
        <p>Paste bullets to check them line by line, then work through the profile checklists.</p>
      </header>

      <div className="tabs" role="tablist">
        {[{ id: "bullets", name: "Bullet checker" }, ...CHECKLISTS].map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.name}
          </button>
        ))}
      </div>

      {tab === "bullets" ? (
        <div className={styles.layout}>
          <div className={styles.input}>
            <label className="field">
              <span>Bullets, one per line</span>
              <textarea
                className="textarea"
                rows={12}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setAi(null);
                }}
                placeholder="• Built…"
              />
            </label>
            <div className={styles.inputActions}>
              {!draft ? (
                <button className="btn" onClick={() => setDraft(SAMPLE)}>
                  Try an example
                </button>
              ) : (
                <button className="btn ghost" onClick={() => setDraft("")}>
                  Clear
                </button>
              )}
            </div>
            <div className={styles.formula}>
              <h3>The formula</h3>
              <p>What you built, the problem it solved, the result as a number, and the tools you used.</p>
              <p className={styles.example}>
                Cut monthly report prep from 6 hours to 20 minutes for a 9-person team by automating data pulls with
                Python, pandas and GitHub Actions
              </p>
            </div>
          </div>

          <div className={styles.output} aria-live="polite">
            {results.length ? (
              <>
                <div className={styles.summary}>
                  <h2>
                    {results.length} bullet{results.length === 1 ? "" : "s"}, averaging {Math.round(avg * 100)}%
                  </h2>
                  <div className={styles.aiRow}>
                    <input
                      className="input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="Target role (optional), e.g. Backend co-op at Clio"
                      aria-label="Target role for AI rewrites"
                    />
                    <button className="btn primary" onClick={askAi} disabled={aiState === "loading"}>
                      {aiState === "loading" ? "Rewriting…" : "Suggest rewrites"}
                    </button>
                  </div>
                  {aiState === "error" ? <p className={styles.aiError}>{aiMsg}</p> : null}
                </div>
                <ol className={styles.results}>
                  {results.map((r, i) => (
                    <li key={i} className={styles.result}>
                      <div className={styles.resultHead}>
                        <p className={styles.bullet}>{r.text}</p>
                        <Grade score={r.score} />
                      </div>
                      <ul className={styles.checks}>
                        {r.checks
                          .filter((c) => !c.ok)
                          .map((c) => (
                            <li key={c.id}>
                              <span className={styles.label}>{c.label}</span>
                              <span>{c.fix}</span>
                            </li>
                          ))}
                      </ul>
                      {r.checks.every((c) => c.ok) ? <p className={styles.pass}>Passes every check.</p> : null}
                      {ai?.[i] ? (
                        <div className={styles.rewrite}>
                          <span className={styles.label}>Suggested rewrite</span>
                          <p>{ai[i].rewrite}</p>
                          <p className="muted small">{ai[i].why}</p>
                          <button className="btn" onClick={() => navigator.clipboard?.writeText(ai[i].rewrite)}>
                            Copy
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className="empty">
                <strong>Nothing to check yet</strong>
                Paste a few bullets on the left. Lines under five words are skipped.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 680 }}>
          <Checklist list={CHECKLISTS.find((c) => c.id === tab)!} />
        </div>
      )}
    </div>
  );
}
