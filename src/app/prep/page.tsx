"use client";

import { useEffect, useState } from "react";
import { newId } from "@/lib/postings";
import { ALL_PROBLEMS, ALL_QUESTIONS, BEHAVIORAL, RESOURCES, ROADMAP } from "@/lib/prep-data";
import { useStored } from "@/lib/store";
import styles from "./prep.module.css";

type Story = { id: string; title: string; situation: string; task: string; action: string; result: string };

function LeetCode() {
  const [done, setDone] = useStored<string[]>("lc.done", []);
  const [revisit, setRevisit] = useStored<string[]>("lc.review", []);
  const [onlyRevisit, setOnlyRevisit] = useState(false);
  const toggle = (list: string[], set: (v: string[]) => void, slug: string) =>
    set(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
  const firstOpen = ROADMAP.findIndex((t) => t.problems.some((p) => !done.includes(p.slug)));

  return (
    <>
      <div className={styles.overview}>
        <div>
          <h2>
            {done.length} of {ALL_PROBLEMS.length} solved
          </h2>
          <p className="muted">
            Work top to bottom, since each topic builds on the last. At five a week, the whole list takes about four
            months.
          </p>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={onlyRevisit} onChange={(e) => setOnlyRevisit(e.target.checked)} />
          Only show my revisit list ({revisit.length})
        </label>
      </div>
      <div className="bar" style={{ margin: "4px 0 24px" }}>
        <span style={{ width: `${(done.length / ALL_PROBLEMS.length) * 100}%`, background: "var(--teal)" }} />
      </div>

      <ol className={styles.topics}>
        {ROADMAP.map((t, i) => {
          const problems = onlyRevisit ? t.problems.filter((p) => revisit.includes(p.slug)) : t.problems;
          if (!problems.length) return null;
          const n = t.problems.filter((p) => done.includes(p.slug)).length;
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
                  {problems.map((p) => (
                    <li key={p.slug} className={done.includes(p.slug) ? styles.solved : undefined}>
                      <input
                        type="checkbox"
                        checked={done.includes(p.slug)}
                        onChange={() => toggle(done, setDone, p.slug)}
                        aria-label={`Mark ${p.name} solved`}
                      />
                      <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer">
                        {p.name}
                      </a>
                      <span className={`${styles.diff} ${styles[p.diff]}`}>{p.diff}</span>
                      {p.premium ? <span className="muted small">Premium, free on NeetCode</span> : null}
                      <button
                        className={styles.star}
                        aria-pressed={revisit.includes(p.slug)}
                        onClick={() => toggle(revisit, setRevisit, p.slug)}
                        title="Add to revisit list"
                      >
                        {revisit.includes(p.slug) ? "Revisit" : "Mark to revisit"}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function StoryEditor({ story, onChange, onDelete }: { story: Story; onChange: (s: Story) => void; onDelete: () => void }) {
  const field = (k: keyof Story, label: string, hint: string) => (
    <label className="field">
      <span>{label}</span>
      <textarea className="textarea" style={{ minHeight: 70 }} value={story[k]} placeholder={hint} onChange={(e) => onChange({ ...story, [k]: e.target.value })} />
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

function Behavioral() {
  const [stories, setStories] = useStored<Story[]>("stories", []);
  const [map, setMap] = useStored<Record<string, string>>("storyMap", {});
  const [practiced, setPracticed] = useStored<string[]>("practiced", []);
  const covered = ALL_QUESTIONS.filter((q) => map[q.id]).length;

  return (
    <div className={styles.behavioral}>
      <section>
        <div className="section-head">
          <h2>Your stories</h2>
          <button
            className="btn primary"
            onClick={() => setStories((s) => [...s, { id: newId(), title: "", situation: "", task: "", action: "", result: "" }])}
          >
            Add a story
          </button>
        </div>
        <p className="muted" style={{ marginTop: -8 }}>
          Five or six solid stories cover almost every question. Hackathons, club work, a hard group project and your
          co-op are all fair game.
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
            Add one, then match it to the questions it answers.
          </div>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Questions</h2>
          <span className="muted small">
            {covered} of {ALL_QUESTIONS.length} have a story, {practiced.length} practiced out loud
          </span>
        </div>
        {BEHAVIORAL.map((theme) => (
          <div key={theme.theme} className={styles.theme}>
            <h3>{theme.theme}</h3>
            <ul>
              {theme.questions.map((q) => (
                <li key={q.id} className={styles.question}>
                  <p className={styles.q}>{q.q}</p>
                  <p className={styles.look}>{q.look}</p>
                  <div className={styles.qControls}>
                    <select
                      className="select"
                      value={map[q.id] ?? ""}
                      onChange={(e) => setMap((m) => ({ ...m, [q.id]: e.target.value }))}
                      aria-label={`Story for: ${q.q}`}
                      disabled={!stories.length}
                    >
                      <option value="">{stories.length ? "Pick a story" : "Add a story first"}</option>
                      {stories.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title || "Untitled story"}
                        </option>
                      ))}
                    </select>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={practiced.includes(q.id)}
                        onChange={(e) =>
                          setPracticed((p) => (e.target.checked ? [...p, q.id] : p.filter((x) => x !== q.id)))
                        }
                      />
                      Practiced out loud
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function Resources() {
  return (
    <ul className={styles.resources}>
      {RESOURCES.map((r) => (
        <li key={r.url}>
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.name}
          </a>
          <span className="muted">{r.note}</span>
        </li>
      ))}
    </ul>
  );
}

const TABS = [
  { id: "leetcode", name: "LeetCode roadmap" },
  { id: "behavioral", name: "Behavioral" },
  { id: "resources", name: "Resources" },
];

export default function PrepPage() {
  const [tab, setTab] = useState("leetcode");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, []);
  const choose = (id: string) => {
    setTab(id);
    window.history.replaceState(null, "", id === "leetcode" ? "/prep/" : `/prep/?tab=${id}`);
  };

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Interview prep</h1>
        <p>A problem roadmap in the order to learn it, and a place to build the stories you&apos;ll tell.</p>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => choose(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      {tab === "leetcode" ? <LeetCode /> : tab === "behavioral" ? <Behavioral /> : <Resources />}
    </div>
  );
}
