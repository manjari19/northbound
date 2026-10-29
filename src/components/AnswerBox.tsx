"use client";

import { useEffect, useState } from "react";
import { useDictation } from "./useDictation";
import styles from "./prep-kit.module.css";

/** Answer field with a talk-it-out mic button and a soft two-minute timer. */
export default function AnswerBox({
  value,
  onChange,
  onSubmit,
  busy,
  submitLabel = "Send answer",
  placeholder = "Type your answer, or press the mic and say it out loud.",
  timer = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  busy: boolean;
  submitLabel?: string;
  placeholder?: string;
  timer?: boolean;
}) {
  const dict = useDictation((t) => onChange((value ? value + " " : "") + t));
  const [secs, setSecs] = useState(0);
  const running = value.length > 0 || dict.listening;

  useEffect(() => {
    if (!timer || !running || busy) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [timer, running, busy]);

  useEffect(() => {
    if (!value) setSecs(0);
  }, [value]);

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const over = secs > 150;

  return (
    <div className={styles.answer}>
      <textarea
        className="textarea"
        rows={5}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && value.trim() && !busy) onSubmit();
        }}
        aria-label="Your answer"
      />
      <div className={styles.answerBar}>
        {dict.supported ? (
          <button className={`${styles.mic} ${dict.listening ? styles.live : ""}`} onClick={dict.toggle} aria-pressed={dict.listening} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            {dict.listening ? "Listening… tap to stop" : "Say it out loud"}
          </button>
        ) : null}
        {timer ? (
          <span className={`${styles.timer} ${over ? styles.over : ""}`} title="Aim for about two minutes">
            {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")} {over ? "wrap it up" : ""}
          </span>
        ) : null}
        <span className="muted small">{words} words</span>
        <button className="btn white" onClick={onSubmit} disabled={!value.trim() || busy} type="button">
          {busy ? "Thinking…" : submitLabel}
        </button>
      </div>
      {dict.error ? <p className={styles.err}>{dict.error}</p> : null}
    </div>
  );
}
