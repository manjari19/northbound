"use client";

import { useEffect, useState } from "react";
import { ageLabel, city, daysAgo, type Application, type Posting } from "@/lib/postings";
import styles from "./Board.module.css";

// Short labels so the status column never wraps
const SHORT: Record<string, string> = { saved: "Saved", applied: "Applied", oa: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected" };

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Split-flap reveal: letters shuffle, then settle left to right. Runs once on load. */
function Flap({ text, delay }: { text: string; delay: number }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now() + delay;
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      const settled = Math.max(0, Math.floor(t / 18));
      if (settled >= text.length) {
        setShown(text);
        return;
      }
      let out = text.slice(0, settled);
      for (let i = settled; i < text.length; i++) {
        out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      setShown(out);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, delay]);
  return (
    <span aria-hidden="true" className={styles.flap}>
      {shown}
    </span>
  );
}

function statusFor(p: Posting, app?: Application) {
  if (app) return { text: SHORT[app.status], kind: app.status === "rejected" ? "closed" : "mine" };
  const age = daysAgo(p.posted ?? p.first_seen) ?? 99;
  if (age <= 1) return { text: "Boarding", kind: "boarding" };
  return { text: "Open", kind: "open" };
}

export default function Board({ postings, apps, animate = true }: { postings: Posting[]; apps: Application[]; animate?: boolean }) {
  const byPosting = new Map(apps.filter((a) => a.postingId).map((a) => [a.postingId!, a]));
  return (
    <div className={styles.board}>
      <div className={`${styles.row} ${styles.head}`} aria-hidden="true">
        <span>Posted</span>
        <span>Company</span>
        <span>Role</span>
        <span>City</span>
        <span className={styles.statusCol}>Status</span>
      </div>
      <ol className={styles.list}>
        {postings.map((p, i) => {
          const s = statusFor(p, byPosting.get(p.id));
          const label = `${p.company}, ${p.title}, ${city(p)}, posted ${ageLabel(p)}, ${s.text}`;
          return (
            <li key={p.id}>
              <a className={styles.row} href={p.url} target="_blank" rel="noreferrer" aria-label={label}>
                <span className={styles.age}>{ageLabel(p)}</span>
                <span className={styles.company}>
                  {animate ? <Flap text={p.company} delay={i * 90} /> : p.company}
                </span>
                <span className={styles.role}>{p.title}</span>
                <span className={styles.city}>{city(p)}</span>
                <span className={`${styles.statusCol} ${styles[s.kind]}`}>{s.text}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
