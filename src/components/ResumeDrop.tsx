"use client";

import { useRef, useState } from "react";
import { toast } from "@/components/fx";
import { fileToBase64, readResumePdf, useResume } from "@/lib/radar";
import styles from "./radar.module.css";

/** Upload the résumé PDF once. It's kept in this browser and reused for every fit check and mock interview. */
export default function ResumeDrop({ compact = false }: { compact?: boolean }) {
  const [resume, setResume] = useResume();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function take(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setErr("That's not a PDF. Export your résumé as PDF and drop it here.");
      return;
    }
    if (file.size > 3_000_000) {
      setErr("That PDF is over 3 MB. A one-page résumé should be well under 1 MB.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const base64 = await fileToBase64(file);
      const { text, bullets } = await readResumePdf(base64);
      setResume({ name: file.name, base64, text, bullets, uploadedAt: new Date().toISOString() });
      toast(`Résumé saved. Found ${bullets.length} bullet${bullets.length === 1 ? "" : "s"}.`);
    } catch {
      setErr("Couldn't read that PDF. If it's a scan or an image, export it again from Google Docs or LaTeX.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`${styles.drop} ${over ? styles.over : ""} ${compact ? styles.compact : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files[0]);
      }}
    >
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => take(e.target.files?.[0])} />
      <span className={styles.dropIcon} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Zm0 0v5h5M12 18v-6m-3 3 3-3 3 3" />
        </svg>
      </span>
      {resume ? (
        <div className={styles.dropText}>
          <strong>{resume.name}</strong>
          <span className="muted small">
            {resume.bullets.length} bullets, saved {new Date(resume.uploadedAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
          </span>
        </div>
      ) : (
        <div className={styles.dropText}>
          <strong>{busy ? "Reading your résumé…" : "Drop your résumé PDF here"}</strong>
          <span className="muted small">It stays in this browser. Only fit checks and mock interviews send it to ResumeRadar.</span>
        </div>
      )}
      <button className={`btn ${resume ? "" : "white"}`} onClick={() => input.current?.click()} disabled={busy}>
        {resume ? "Replace" : "Choose PDF"}
      </button>
      {err ? (
        <p className={styles.dropErr} role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
