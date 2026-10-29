"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CountUp, Logo, NextSweep } from "@/components/fx";
import Compass from "@/components/Compass";
import StarField from "@/components/GlyphField";
import { Arrow } from "@/components/Nav";
import Pipeline from "@/components/Pipeline";
import {
  ageLabel,
  city,
  hourly,
  isNew,
  inRegions,
  statusLabel,
  useApps,
  useFeed,
  useRegions,
  type Posting,
} from "@/lib/postings";
import { ALL_PROBLEMS, ALL_QUESTIONS } from "@/lib/prep-data";
import { useStored } from "@/lib/store";
import styles from "./home.module.css";

const RELEVANT = new Set(["Software", "Data & ML", "Product"]);

const TOOLS = [
  { id: "postings", label: "Postings", icon: "M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" },
  { id: "tracker", label: "Tracker", icon: "M4 6h16M4 12h10M4 18h6" },
  { id: "resume", label: "Résumé", icon: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M9 13h6M9 17h4" },
  { id: "interviews", label: "Interviews", icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.3A8 8 0 1 1 21 12Z" },
] as const;
type Tool = (typeof TOOLS)[number]["id"];

function Icon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function PostingsPreview({ rows }: { rows: Posting[] }) {
  return (
    <div className={styles.preview}>
      <h3 className={styles.previewTitle}>Every new role, the moment it posts</h3>
      <p className={styles.previewSub}>Pulled from 60+ job boards and community lists every five minutes.</p>
      <div className={styles.table} role="table" aria-label="Newest postings">
        {rows.map((p) => (
          <div key={p.id} className={styles.tr} role="row">
            <span className={styles.tdCompany} role="cell">
              <Logo name={p.company} size={26} />
              <span>{p.company}</span>
            </span>
            <span className={styles.tdRole} role="cell">{p.title}</span>
            <span className={styles.tdCity} role="cell">{city(p)}</span>
            <span className={styles.tdApply} role="cell">
              <a className="btn amber" href={p.url} target="_blank" rel="noreferrer" aria-label={`Apply to ${p.company}, ${p.title}`}>
                Apply <Arrow />
              </a>
            </span>
            <span className={styles.tdAge} role="cell">{ageLabel(p)}</span>
          </div>
        ))}
      </div>
      <Link className={styles.more} href="/postings/">
        See all postings <Arrow />
      </Link>
    </div>
  );
}

function TrackerPreview() {
  const [apps] = useApps();
  const moving = apps.filter((a) => ["applied", "oa", "interview", "offer"].includes(a.status)).slice(0, 4);
  return (
    <div className={styles.preview}>
      <h3 className={styles.previewTitle}>Know exactly where every application stands</h3>
      <p className={styles.previewSub}>Track a posting in one click. Quiet ones get a nudge after three weeks.</p>
      {apps.length ? (
        <>
          <Pipeline apps={apps} />
          <ul className={styles.mini}>
            {moving.map((a) => (
              <li key={a.id}>
                <Logo name={a.company} size={26} />
                <span className={styles.miniText}>
                  <strong>{a.company}</strong>
                  <span className="muted">{a.title}</span>
                </span>
                <span className={`pill ${a.status}`}>{statusLabel(a.status)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="empty">
          <strong>Nothing tracked yet</strong>
          Set a status on any posting and it shows up here.
        </div>
      )}
      <Link className={styles.more} href="/tracker/">
        Open tracker <Arrow />
      </Link>
    </div>
  );
}

const BEFORE = "Built a web application using React and AWS.";
const AFTER =
  "Cut shelter-bed lookup time by 80% for 12 partner shelters by building an NFC check-in flow with Next.js, Supabase and Twilio";

function ResumePreview() {
  const [fixed, setFixed] = useState(false);
  return (
    <div className={styles.preview}>
      <h3 className={styles.previewTitle}>Bullet-by-bullet résumé checks</h3>
      <p className={styles.previewSub}>What you built, the problem, the result as a number, and the stack.</p>
      <div className={styles.beforeAfter}>
        <div className={`${styles.bullet} ${fixed ? styles.dim : ""}`}>
          <span className={styles.tagBad}>Before</span>
          <p>{BEFORE}</p>
          <ul>
            <li>No number</li>
            <li>Doesn&apos;t say what problem it solved</li>
          </ul>
        </div>
        <button className={styles.fixBtn} onClick={() => setFixed((f) => !f)} aria-pressed={fixed}>
          {fixed ? "Undo" : "Fix it"}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <div className={`${styles.bullet} ${styles.after} ${fixed ? styles.on : ""}`} aria-live="polite">
          <span className={styles.tagGood}>After</span>
          <p>{fixed ? AFTER : "Press Fix it to see the rewrite."}</p>
          {fixed ? (
            <ul className={styles.good}>
              <li>Strong verb, a real number, the stack</li>
            </ul>
          ) : null}
        </div>
      </div>
      <Link className={styles.more} href="/review/">
        Check your bullets <Arrow />
      </Link>
    </div>
  );
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className={styles.ring} aria-hidden="true">
      <circle cx="44" cy="44" r={r} stroke="rgba(255,255,255,.08)" strokeWidth="8" fill="none" />
      <circle cx="44" cy="44" r={r} stroke="var(--green)" strokeWidth="8" fill="none" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 44 44)" style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
}

function InterviewsPreview() {
  const [done] = useStored<string[]>("lc.done", []);
  const [storyMap] = useStored<Record<string, string>>("storyMap", {});
  const next = ALL_PROBLEMS.filter((p) => !done.includes(p.slug)).slice(0, 3);
  const answered = ALL_QUESTIONS.filter((q) => storyMap[q.id]).length;
  return (
    <div className={styles.preview}>
      <h3 className={styles.previewTitle}>A plan for LeetCode and behavioral rounds</h3>
      <p className={styles.previewSub}>Problems in the order to learn them, and a bank for your STAR stories.</p>
      <div className={styles.prepGrid}>
        <div className={styles.ringBox}>
          <Ring value={done.length} total={ALL_PROBLEMS.length} />
          <div>
            <strong className={styles.big}>
              {done.length}/{ALL_PROBLEMS.length}
            </strong>
            <span className="muted small">problems solved</span>
            <span className="muted small">
              {answered} of {ALL_QUESTIONS.length} questions have a story
            </span>
          </div>
        </div>
        <ul className={styles.nextList}>
          {next.map((p) => (
            <li key={p.slug}>
              <a href={`https://leetcode.com/problems/${p.slug}/`} target="_blank" rel="noreferrer">
                {p.name}
              </a>
              <span className={`${styles.diff} ${styles[p.diff]}`}>{p.diff}</span>
            </li>
          ))}
        </ul>
      </div>
      <Link className={styles.more} href="/prep/">
        Open the plan <Arrow />
      </Link>
    </div>
  );
}

export default function Home() {
  const { feed, error } = useFeed();
  const [regions] = useRegions();
  const [tool, setTool] = useState<Tool>("postings");

  const relevant = useMemo(
    () => feed?.postings.filter((p) => RELEVANT.has(p.category) && inRegions(p, regions)) ?? [],
    [feed, regions],
  );
  const fresh = relevant.filter(isNew).length;
  const topPay = useMemo(() => {
    const seen = new Set<string>();
    return (feed?.postings ?? [])
      .map((p) => ({ p, h: hourly(p.pay) }))
      .filter((x): x is { p: Posting; h: number } => x.h != null && inRegions(x.p, regions))
      .sort((a, b) => b.h - a.h)
      .filter((x) => (seen.has(x.p.company) ? false : (seen.add(x.p.company), true)))
      .slice(0, 8);
  }, [feed, regions]);

  return (
    <>
      <section className={styles.hero}>
        <StarField />
        <div className={`wrap ${styles.heroInner}`}>
          <h1 className={styles.title}>
            <span className={styles.line}>
              Apply the day
              <Compass />
            </span>
            <span className={styles.line}>it posts.</span>
          </h1>
          <p className={styles.sub}>
            Every internship and co-op worth a look, in Canada and the US, next to a tracker, résumé checks and an
            interview plan.
          </p>
          <Link href="/postings/?fresh=1" className={styles.ticket}>
            <span className={styles.ticketDot} aria-hidden="true" />
            {feed ? (
              <span>
                <strong>
                  <CountUp value={fresh} />
                </strong>{" "}
                new roles found today
              </span>
            ) : (
              <span>Checking for new roles…</span>
            )}
            <Arrow />
          </Link>

          <div className={styles.explore}>
            <div className="segmented" role="tablist" aria-label="Explore the tools">
              <span className={styles.exploreLabel}>Explore</span>
              {TOOLS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tool === t.id} onClick={() => setTool(t.id)}>
                  <Icon d={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`window ${styles.window}`}>
            <div className="window-bar">
              <span>
                <b>northbound</b> / {tool}
              </span>
              <span className="live">live</span>
            </div>
            <div key={tool} className={styles.windowBody} role="tabpanel">
              {tool === "postings" ? (
                feed ? (
                  <PostingsPreview rows={relevant.slice(0, 6)} />
                ) : (
                  <p className="muted">{error ?? "Loading the newest postings…"}</p>
                )
              ) : tool === "tracker" ? (
                <TrackerPreview />
              ) : tool === "resume" ? (
                <ResumePreview />
              ) : (
                <InterviewsPreview />
              )}
            </div>
          </div>

          {feed ? <NextSweep updatedAt={feed.updated_at} /> : null}
        </div>
      </section>

      {topPay.length ? (
        <section className={`wrap ${styles.paySection}`}>
          <h2 className={styles.centerTitle}>Who pays what</h2>
          <p className={styles.centerSub}>Top hourly rates from roles open on your board right now.</p>
          <ol className={styles.payList}>
            {topPay.map(({ p, h }, i) => (
              <li key={p.id} style={{ "--w": `${(h / topPay[0].h) * 100}%`, animationDelay: `${i * 60}ms` } as React.CSSProperties}>
                <span className={styles.rank}>{i + 1}</span>
                <Logo name={p.company} size={36} />
                <span className={styles.payText}>
                  <strong>{p.company}</strong>
                  <span>
                    {p.title}, {city(p)}
                  </span>
                </span>
                <span className={styles.meter} aria-hidden="true">
                  <span />
                </span>
                <span className={styles.payNum}>
                  <strong>${h.toFixed(h % 1 ? 2 : 0)}</strong>
                  <span>/ hr</span>
                </span>
                <a href={p.url} target="_blank" rel="noreferrer" className="btn amber" aria-label={`View ${p.company} role`}>
                  View <Arrow />
                </a>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
