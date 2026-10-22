"use client";

import Link from "next/link";
import Board from "@/components/Board";
import Pipeline from "@/components/Pipeline";
import { daysAgo, relativeTime, useApps, useFeed } from "@/lib/postings";
import { ALL_PROBLEMS, ALL_QUESTIONS } from "@/lib/prep-data";
import { useStored } from "@/lib/store";
import styles from "./home.module.css";

const RELEVANT = new Set(["Software", "Data & ML", "Product"]);

export default function Home() {
  const { feed, error } = useFeed();
  const [apps] = useApps();
  const [done] = useStored<string[]>("lc.done", []);
  const [storyMap] = useStored<Record<string, string>>("storyMap", {});

  const relevant = feed?.postings.filter((p) => RELEVANT.has(p.category)) ?? [];
  const fresh = relevant.filter((p) => (daysAgo(p.posted ?? p.first_seen) ?? 99) <= 1).length;
  const nextProblem = ALL_PROBLEMS.find((p) => !done.includes(p.slug));
  const answered = ALL_QUESTIONS.filter((q) => storyMap[q.id]).length;
  const inFlight = apps.filter((a) => ["applied", "oa", "interview"].includes(a.status)).length;

  return (
    <>
      <section className={`wrap ${styles.hero}`}>
        <h1 className={styles.title}>
          Apply the day
          <br />
          it posts.
        </h1>
        <p className="lede">
          Every Canadian internship and co-op posting worth a look, refreshed every two hours, next to my tracker,
          résumé checks and interview plan.
        </p>
        <p className={styles.status} aria-live="polite">
          {feed ? (
            <>
              Board updated {relativeTime(feed.updated_at)}. {relevant.length} open software, data and product roles,{" "}
              <strong>{fresh} posted in the last day</strong>.
            </>
          ) : error ? (
            <span className={styles.error}>{error}</span>
          ) : (
            "Loading the board…"
          )}
        </p>
      </section>

      <section className="wrap" aria-labelledby="departures">
        <div className="section-head">
          <h2 id="departures">Latest departures</h2>
          <Link className="btn" href="/postings/">
            All postings
          </Link>
        </div>
        {feed ? (
          <Board postings={relevant.slice(0, 8)} apps={apps} />
        ) : (
          <div className={styles.boardPlaceholder} aria-hidden="true" />
        )}
      </section>

      <section className={`wrap ${styles.lower}`}>
        <div className={styles.block}>
          <div className="section-head">
            <h2>Where things stand</h2>
            <Link className="btn ghost" href="/tracker/">
              Open tracker
            </Link>
          </div>
          {apps.length ? (
            <>
              <p className={styles.big}>
                {inFlight} application{inFlight === 1 ? "" : "s"} in motion
              </p>
              <Pipeline apps={apps} />
            </>
          ) : (
            <div className="empty">
              <strong>Nothing tracked yet</strong>
              Hit Track on any posting and it lands here with a status you can move along.
            </div>
          )}
        </div>

        <div className={styles.block}>
          <div className="section-head">
            <h2>Up next</h2>
          </div>
          <ul className={styles.next}>
            <li>
              <span className="muted small">LeetCode, {done.length} of {ALL_PROBLEMS.length} done</span>
              {nextProblem ? (
                <a href={`https://leetcode.com/problems/${nextProblem.slug}/`} target="_blank" rel="noreferrer">
                  {nextProblem.name}
                  <span className="muted"> ({nextProblem.topic.toLowerCase()})</span>
                </a>
              ) : (
                <span>Roadmap finished. Time for company-tagged problems.</span>
              )}
            </li>
            <li>
              <span className="muted small">Behavioral, {answered} of {ALL_QUESTIONS.length} questions have a story</span>
              <Link href="/prep/?tab=behavioral">Write a story for the next question</Link>
            </li>
            <li>
              <span className="muted small">Résumé</span>
              <Link href="/review/">Check your bullets before the next application</Link>
            </li>
          </ul>
        </div>
      </section>
    </>
  );
}
