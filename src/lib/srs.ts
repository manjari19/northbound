"use client";

import { today } from "./postings";
import { ALL_PROBLEMS } from "./prep-data";
import { useStored } from "./store";

/** Spaced repetition for LeetCode: solve once, then revisit at growing gaps so the pattern sticks. */
export type Card = { interval: number; due: string; reviews: number };

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function useLeetCode() {
  const [done, setDone] = useStored<string[]>("lc.done", []);
  const [srs, setSrs] = useStored<Record<string, Card>>("lc.srs", {});
  const [log, setLog] = useStored<Record<string, number>>("lc.log", {});
  const [goal, setGoal] = useStored<number>("lc.goal", 2);
  const [revisit, setRevisit] = useStored<string[]>("lc.review", []);
  const t = today();

  const bump = () => setLog((prev) => ({ ...prev, [t]: (prev[t] ?? 0) + 1 }));

  /** First solve: schedule the first review three days out. */
  function solve(slug: string) {
    if (done.includes(slug)) return;
    setDone((prev) => [...prev, slug]);
    setSrs((prev) => ({ ...prev, [slug]: { interval: 3, due: addDays(t, 3), reviews: 0 } }));
    bump();
  }

  function unsolve(slug: string) {
    setDone((prev) => prev.filter((s) => s !== slug));
    setSrs((prev) => {
      const next = { ...prev };
      delete next[slug];
      return next;
    });
  }

  /** After a review: struggled resets to tomorrow, got it doubles the gap, easy stretches it further. */
  function review(slug: string, how: "struggled" | "good" | "easy") {
    setSrs((prev) => {
      const cur = prev[slug] ?? { interval: 3, due: t, reviews: 0 };
      const interval = how === "struggled" ? 1 : how === "good" ? Math.max(3, Math.round(cur.interval * 2)) : Math.max(7, Math.round(cur.interval * 3));
      return { ...prev, [slug]: { interval: Math.min(interval, 90), due: addDays(t, Math.min(interval, 90)), reviews: cur.reviews + 1 } };
    });
    if (how !== "struggled") setRevisit((prev) => prev.filter((s) => s !== slug));
    bump();
  }

  const due = ALL_PROBLEMS.filter((p) => done.includes(p.slug) && ((srs[p.slug] && srs[p.slug].due <= t) || revisit.includes(p.slug)));
  const doneToday = log[t] ?? 0;
  const fresh = ALL_PROBLEMS.filter((p) => !done.includes(p.slug)).slice(0, Math.max(1, goal - doneToday));

  // Streak: consecutive days (ending today or yesterday) with at least one solve or review
  let streak = 0;
  for (let d = log[t] ? t : addDays(t, -1); log[d]; d = addDays(d, -1)) streak++;
  let best = 0;
  let run = 0;
  Object.keys(log)
    .sort()
    .forEach((d, i, arr) => {
      run = i > 0 && addDays(arr[i - 1], 1) === d ? run + 1 : 1;
      best = Math.max(best, run);
    });

  // Last 28 days for the heatmap
  const days = Array.from({ length: 28 }, (_, i) => {
    const d = addDays(t, i - 27);
    return { d, n: log[d] ?? 0 };
  });

  return { done, srs, revisit, setRevisit, goal, setGoal, solve, unsolve, review, due, fresh, doneToday, streak, best, days };
}
