"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo, confetti } from "@/components/fx";
import FitResult from "@/components/FitResult";
import ResumeDrop from "@/components/ResumeDrop";
import { useApps } from "@/lib/postings";
import { analyse, fetchJobDescription, fitKey, RadarError, useFits, useJDs, useResume } from "@/lib/radar";
import styles from "./radar.module.css";

export type FitTarget = { id?: string; postingId?: string; company: string; title: string; url?: string };

/** Open the fit drawer from anywhere: openFit({ company, title, url, id }) */
export function openFit(target: FitTarget) {
  window.dispatchEvent(new CustomEvent("nb:fit", { detail: target }));
}

export default function FitDrawer() {
  const [target, setTarget] = useState<FitTarget | null>(null);
  const [resume] = useResume();
  const [fits, setFits] = useFits();
  const [jds, setJds] = useJDs();
  const [, setApps] = useApps();
  const [jd, setJd] = useState("");
  const [fetching, setFetching] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const key = target ? fitKey(target) : "";
  const record = key ? fits[key] : undefined;

  useEffect(() => {
    const onOpen = (e: Event) => setTarget((e as CustomEvent<FitTarget>).detail);
    window.addEventListener("nb:fit", onOpen);
    return () => window.removeEventListener("nb:fit", onOpen);
  }, []);

  // Load the saved or fetched job description when a posting opens
  useEffect(() => {
    if (!target) return;
    setState("idle");
    setErr("");
    const saved = jds[fitKey(target)];
    setJd(saved ?? "");
    document.body.style.overflow = "hidden";
    setTimeout(() => panel.current?.focus(), 30);
    if (!saved && target.url) {
      setFetching(true);
      fetchJobDescription(target.url)
        .then((text) => {
          if (text) {
            setJd(text);
            setJds((prev) => ({ ...prev, [fitKey(target)]: text }));
          }
        })
        .finally(() => setFetching(false));
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTarget(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!target) return null;

  async function check(btn: HTMLButtonElement) {
    if (!resume || !target) return;
    if (jd.trim().length < 200) {
      setState("error");
      setErr("Paste the full job description first (responsibilities and requirements). A title alone isn't enough to score.");
      return;
    }
    setState("loading");
    setErr("");
    setJds((prev) => ({ ...prev, [key]: jd }));
    try {
      const analysis = await analyse(resume.base64, jd);
      setFits((prev) => ({
        ...prev,
        [key]: { key, postingId: target.postingId || target.id, company: target.company, title: target.title, url: target.url, jd, analysis, checkedAt: new Date().toISOString() },
      }));
      // Remember the score on the tracked application too
      setApps((prev) => prev.map((a) => (fitKey(a) === key || a.postingId === (target.postingId || target.id) ? { ...a, fitScore: analysis.fit_score } : a)));
      setState("idle");
      if (analysis.fit_score >= 85) {
        const r = btn.getBoundingClientRect();
        confetti(r.left + r.width / 2, r.top, 60);
      }
    } catch (e) {
      setState("error");
      setErr(e instanceof RadarError ? e.message : "The fit check failed. Try again in a moment.");
    }
  }

  return (
    <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && setTarget(null)}>
      <div ref={panel} className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Fit check for ${target.company}`} tabIndex={-1}>
        <header className={styles.drawerHead}>
          <Logo name={target.company} size={40} />
          <div className={styles.drawerTitle}>
            <strong>{target.company}</strong>
            <span>{target.title}</span>
          </div>
          <button className={styles.close} onClick={() => setTarget(null)} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.drawerBody}>
          {!resume ? <ResumeDrop compact /> : null}

          <label className="field">
            <span>
              Job description{" "}
              {fetching ? <em className={styles.fetching}>fetching from the job board…</em> : null}
            </span>
            <textarea
              className="textarea"
              rows={record ? 4 : 9}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={
                fetching
                  ? "Fetching…"
                  : "Paste the full posting here: responsibilities, requirements and nice-to-haves. Some boards (Workday, Amazon) don't let other sites read them, so those need a quick copy and paste."
              }
            />
          </label>
          <div className={styles.row}>
            {target.url ? (
              <a className="btn ghost" href={target.url} target="_blank" rel="noreferrer">
                Open posting
              </a>
            ) : null}
            <button className="btn white" onClick={(e) => check(e.currentTarget)} disabled={!resume || state === "loading"}>
              {state === "loading" ? "Checking fit…" : record ? "Check again" : "Check my fit"}
            </button>
          </div>
          {state === "loading" ? (
            <div className={styles.loading} aria-live="polite">
              <span className={styles.radar} aria-hidden="true" />
              ResumeRadar is reading your résumé against the posting. This takes 20 to 30 seconds.
            </div>
          ) : null}
          {state === "error" ? (
            <p className={styles.err} role="alert">
              {err}
            </p>
          ) : null}

          {record && state !== "loading" ? (
            <>
              <FitResult analysis={record.analysis} resume={resume} jd={record.jd} company={target.company} role={target.title} />
              <Link className={styles.practiceLink} href={`/prep/?tab=interviews&key=${encodeURIComponent(key)}`} onClick={() => setTarget(null)}>
                Practice an interview for this job
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
