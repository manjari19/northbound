"use client";

import { useEffect, useState } from "react";
import AnswerBox from "@/components/AnswerBox";
import { ScoreRing } from "@/components/FitResult";
import { confetti, toast } from "@/components/fx";
import { newId } from "@/lib/postings";
import { ALL_QUESTIONS, BEHAVIORAL } from "@/lib/prep-data";
import { practiceGenerate, practiceSubmit, RadarError, useResume } from "@/lib/radar";
import { useStored } from "@/lib/store";
import styles from "./prep.module.css";

type Story = { id: string; title: string; situation: string; task: string; action: string; result: string };
type Result = { score: number; feedback: string; tip: string; answer: string; at: string };
type Feedback = { session?: string; results: Record<string, Result> };

const PRACTICE_JD = `Software Engineering Co-op / Intern (behavioral round).
We're looking for students who take ownership, communicate clearly, work well on a team, learn quickly and handle ambiguity.
Answers should use concrete examples (situation, task, action, result) with specific details and measurable outcomes.`;

function StoryEditor({ story, onChange, onDelete }: { story: Story; onChange: (s: Story) => void; onDelete: () => void }) {
  const field = (k: keyof Story, label: string, hint: string) => (
    <label className="field">
      <span>{label}</span>
      <textarea className="textarea" style={{ minHeight: 64 }} value={story[k]} placeholder={hint} onChange={(e) => onChange({ ...story, [k]: e.target.value })} />
    </label>
  );
  return (
    <details className={styles.story} open={!story.situation}>
      <summary>{story.title || "Untitled story"}</summary>
      <div className={styles.storyBody}>
        <label className="field">
          <span>Name it</span>
          <input className="input" value={story.title} placeholder="StormHacks pivot at hour 14" onChange={(e) => onChange({ ...story, title: e.target.value })} />
        </label>
        {field("situation", "Situation", "Where, when, what was going on. Two sentences.")}
        {field("task", "Task", "What you specifically were on the hook for.")}
        {field("action", "Action", "What you did. This is most of the answer. Say I, not we.")}
        {field("result", "Result", "What changed, with a number if you have one, and what you learned.")}
        <button className="btn ghost danger" style={{ justifySelf: "start" }} onClick={() => confirm("Delete this story?") && onDelete()}>
          Delete story
        </button>
      </div>
    </details>
  );
}

export default function Stories({ focus }: { focus?: string }) {
  const [resume] = useResume();
  const [stories, setStories] = useStored<Story[]>("stories", []);
  const [map, setMap] = useStored<Record<string, string>>("storyMap", {});
  const [, setPracticed] = useStored<string[]>("practiced", []);
  const [fb, setFb] = useStored<Feedback>("storyFeedback", { results: {} });
  const [qid, setQid] = useState<string>(focus ?? ALL_QUESTIONS[0].id);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const q = ALL_QUESTIONS.find((x) => x.id === qid)!;
  const story = stories.find((s) => s.id === map[qid]);
  const result = fb.results?.[qid];
  const results = fb.results ?? {};

  useEffect(() => {
    if (focus) setQid(focus);
  }, [focus]);
  useEffect(() => {
    setAnswer("");
    setErr("");
  }, [qid]);

  async function check() {
    if (!resume) return;
    setBusy(true);
    setErr("");
    try {
      let session = fb.session;
      if (!session) {
        session = (await practiceGenerate(resume.base64, PRACTICE_JD, "Behavioral practice", "Software engineering co-op")).sessionId;
      }
      const r = await practiceSubmit(session, { id: qid, type: "behavioral", question: q.q, focus: "" }, answer, PRACTICE_JD);
      setFb((prev) => ({ session, results: { ...(prev.results ?? {}), [qid]: { score: r.score, feedback: r.feedback, tip: r.tip, answer, at: new Date().toISOString() } } }));
      setPracticed((p) => (p.includes(qid) ? p : [...p, qid]));
      if (r.score >= 85) confetti(innerWidth / 2, innerHeight / 3, 60);
      toast(`Scored ${r.score}/100.`);
    } catch (e) {
      // A stale session (deleted in ResumeRadar) gets recreated next time
      if (e instanceof RadarError && /not found/i.test(e.message)) setFb((prev) => ({ ...prev, session: undefined }));
      setErr(e instanceof RadarError ? e.message : "Feedback failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const scored = ALL_QUESTIONS.filter((x) => results[x.id]).length;

  return (
    <div className={styles.storiesGrid}>
      <section className={styles.qPane}>
        <div className="section-head">
          <h2>Questions</h2>
          <span className="muted small">
            {scored} of {ALL_QUESTIONS.length} practiced with feedback
          </span>
        </div>
        {BEHAVIORAL.map((t) => (
          <div key={t.theme} className={styles.theme}>
            <h3>{t.theme}</h3>
            <ul className={styles.qList}>
              {t.questions.map((x) => (
                <li key={x.id}>
                  <button aria-current={qid === x.id ? "true" : undefined} onClick={() => setQid(x.id)}>
                    <span>{x.q}</span>
                    {results[x.id] ? (
                      <span className={`${styles.qScore} ${results[x.id].score >= 75 ? styles.good : results[x.id].score >= 50 ? styles.mid : styles.low}`}>
                        {results[x.id].score}
                      </span>
                    ) : map[x.id] ? (
                      <span className={styles.qDot} title="Has a story" />
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className={styles.practice}>
        <div className={styles.practiceCard}>
          <p className={styles.storyQ}>{q.q}</p>
          <p className="muted">{q.look}</p>
          <label className={styles.pickStory}>
            <span className="muted small">Story for this question</span>
            <select className="select" value={map[qid] ?? ""} onChange={(e) => setMap((m) => ({ ...m, [qid]: e.target.value }))} disabled={!stories.length}>
              <option value="">{stories.length ? "Pick a story" : "Add a story below first"}</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title || "Untitled story"}
                </option>
              ))}
            </select>
          </label>
          {story ? (
            <div className={styles.starCard}>
              {(["situation", "task", "action", "result"] as const).map((k) =>
                story[k] ? (
                  <p key={k}>
                    <strong>{k[0].toUpperCase() + k.slice(1)}:</strong> {story[k]}
                  </p>
                ) : null,
              )}
            </div>
          ) : null}
          <AnswerBox value={answer} onChange={setAnswer} onSubmit={check} busy={busy} submitLabel="Get feedback" placeholder="Answer like you would out loud. Aim for about two minutes." />
          {!resume ? <p className={styles.err}>Upload your résumé on the Résumé page so feedback can use your background.</p> : null}
          {err ? <p className={styles.err}>{err}</p> : null}
          {result && !busy ? (
            <div className={styles.fbCard}>
              <ScoreRing score={result.score} size={56} />
              <div>
                <p>{result.feedback}</p>
                <p className={styles.tipLine}>
                  <strong>Try next time:</strong> {result.tip}
                </p>
                <p className="muted small">Last practiced {new Date(result.at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="section-head" style={{ marginTop: 34 }}>
          <h2>Your stories</h2>
          <button className="btn white" onClick={() => setStories((s) => [...s, { id: newId(), title: "", situation: "", task: "", action: "", result: "" }])}>
            Add a story
          </button>
        </div>
        <p className="muted" style={{ marginTop: -8 }}>
          Five or six solid stories cover almost every question. Hackathons, club work, a hard group project and your co-op
          are all fair game.
        </p>
        {stories.length ? (
          <div className={styles.stories}>
            {stories.map((s) => (
              <StoryEditor
                key={s.id}
                story={s}
                onChange={(next) => setStories((all) => all.map((x) => (x.id === s.id ? next : x)))}
                onDelete={() => setStories((all) => all.filter((x) => x.id !== s.id))}
              />
            ))}
          </div>
        ) : (
          <div className="empty">
            <strong>No stories yet</strong>
            Add one, then pick it for the questions it answers.
          </div>
        )}
      </section>
    </div>
  );
}
