"use client";

import { confetti, toast } from "@/components/fx";
import { useApps, statusLabel } from "@/lib/postings";
import { ALL_QUESTIONS } from "@/lib/prep-data";
import { useLeetCode } from "@/lib/srs";
import { useStored } from "@/lib/store";
import { Logo } from "@/components/fx";
import { ProblemRow } from "./LeetCode";
import styles from "./prep.module.css";

type Feedback = { results: Record<string, { score: number }> };

export default function Today({ go }: { go: (tab: string, key?: string) => void }) {
  const lc = useLeetCode();
  const [apps] = useApps();
  const [fb] = useStored<Feedback>("storyFeedback", { results: {} });
  const upcoming = apps.filter((a) => a.status === "interview" || a.status === "oa");
  const nextStory = ALL_QUESTIONS.find((q) => !fb.results?.[q.id]);
  const pct = Math.min(1, lc.doneToday / Math.max(1, lc.goal));
  const r = 30;
  const c = 2 * Math.PI * r;

  function act(fn: () => void, el: Element, msg: string) {
    const before = lc.doneToday;
    fn();
    toast(msg);
    if (before + 1 === lc.goal) {
      const b = el.getBoundingClientRect();
      confetti(b.left + b.width / 2, b.top, 70);
      toast("Daily goal hit. See you tomorrow.");
    }
  }

  return (
    <div className={styles.today}>
      <section className={styles.statRow}>
        <div className={styles.stat}>
          <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
            <circle cx="38" cy="38" r={r} stroke="rgba(190,210,255,.1)" strokeWidth="7" fill="none" />
            <circle cx="38" cy="38" r={r} stroke="var(--aurora)" strokeWidth="7" fill="none" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 38 38)" style={{ transition: "stroke-dashoffset .8s" }} />
          </svg>
          <div>
            <strong className={styles.big}>
              {lc.doneToday}/{lc.goal}
            </strong>
            <span className="muted small">problems today</span>
            <label className={styles.goal}>
              Daily goal
              <select className="select" value={lc.goal} onChange={(e) => lc.setGoal(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className={styles.stat}>
          <span className={styles.starIcon} aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor">
              <path d="m12 2 2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 16.9 6.1 20.2l1.3-6.6L2.5 9l6.6-.8Z" />
            </svg>
          </span>
          <div>
            <strong className={styles.big}>{lc.streak} day{lc.streak === 1 ? "" : "s"}</strong>
            <span className="muted small">current streak, best {lc.best}</span>
          </div>
        </div>
        <div className={`${styles.stat} ${styles.heatWrap}`}>
          <div className={styles.heat} role="img" aria-label="Problems per day over the last four weeks">
            {lc.days.map((d) => (
              <span key={d.d} title={`${d.d}: ${d.n}`} className={styles.cell} data-n={Math.min(d.n, 4)} />
            ))}
          </div>
          <span className="muted small">last 4 weeks</span>
        </div>
      </section>

      <div className={styles.todayCols}>
        <section>
          <h3 className={styles.colTitle}>
            Reviews due <span className="pill">{lc.due.length}</span>
          </h3>
          {lc.due.length ? (
            <ul className={styles.queue}>
              {lc.due.map((p) => (
                <li key={p.slug}>
                  <div className={styles.qTop}>
                    <ProblemRow p={p} />
                  </div>
                  <div className={styles.rate}>
                    <span className="muted small">Solve it again, then:</span>
                    <button className="btn ghost" onClick={(e) => act(() => lc.review(p.slug, "struggled"), e.currentTarget, "Back tomorrow.")}>
                      Struggled
                    </button>
                    <button className="btn" onClick={(e) => act(() => lc.review(p.slug, "good"), e.currentTarget, "Nice. Gap doubled.")}>
                      Got it
                    </button>
                    <button className="btn white" onClick={(e) => act(() => lc.review(p.slug, "easy"), e.currentTarget, "Nailed it. See it in a while.")}>
                      Nailed it
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <strong>Nothing due</strong>
              Solved problems come back here on their review day.
            </div>
          )}
        </section>

        <section>
          <h3 className={styles.colTitle}>Next new problems</h3>
          <ul className={styles.queue}>
            {lc.fresh.map((p) => (
              <li key={p.slug}>
                <div className={styles.qTop}>
                  <ProblemRow p={p} />
                </div>
                <div className={styles.rate}>
                  <span className="muted small">{p.topic}</span>
                  <button className="btn white" onClick={(e) => act(() => lc.solve(p.slug), e.currentTarget, "Solved. First review in 3 days.")}>
                    Solved it
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className={styles.todayCols}>
        <section>
          <h3 className={styles.colTitle}>Coming up</h3>
          {upcoming.length ? (
            <ul className={styles.upcoming}>
              {upcoming.map((a) => (
                <li key={a.id}>
                  <button onClick={() => go("interviews", a.postingId || a.id)}>
                    <Logo name={a.company} size={34} />
                    <span>
                      <strong>{a.company}</strong>
                      <span className="muted small">{a.title}</span>
                    </span>
                    <span className={`pill ${a.status}`}>{statusLabel(a.status)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <strong>No interviews or assessments yet</strong>
              Set an application to Interviewing or Online assessment and its prep room shows up here.
            </div>
          )}
        </section>
        <section>
          <h3 className={styles.colTitle}>Story of the day</h3>
          {nextStory ? (
            <div className={styles.storyDay}>
              <p className={styles.storyQ}>{nextStory.q}</p>
              <p className="muted small">{nextStory.look}</p>
              <button className="btn white" onClick={() => go("stories", nextStory.id)}>
                Practice this one
              </button>
            </div>
          ) : (
            <div className="empty">
              <strong>Every question has feedback</strong>
              Run them again before a big interview.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
