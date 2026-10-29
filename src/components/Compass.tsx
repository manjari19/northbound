"use client";

import { useEffect, useRef } from "react";
import styles from "./Compass.module.css";

/** A compass tile whose needle swings toward your cursor, then settles back to north when you stop. */
export default function Compass() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let angle = 0;
    let settle: ReturnType<typeof setTimeout>;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const target = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI + 90;
      // take the short way round so the needle never spins a full circle
      const diff = ((((target - angle) % 360) + 540) % 360) - 180;
      angle += diff;
      el.style.setProperty("--angle", `${angle}deg`);
      clearTimeout(settle);
      settle = setTimeout(() => {
        angle = Math.round(angle / 360) * 360;
        el.style.setProperty("--angle", `${angle}deg`);
      }, 1600);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearTimeout(settle);
    };
  }, []);
  return (
    <span ref={ref} className={styles.tile} aria-hidden="true">
      <svg viewBox="0 0 100 100" className={styles.face}>
        <circle cx="50" cy="50" r="40" className={styles.ring} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="50" y1="13" x2="50" y2={i % 3 ? "17" : "20"} transform={`rotate(${i * 30} 50 50)`} className={styles.tick} />
        ))}
        <text x="50" y="31" className={styles.n}>N</text>
      </svg>
      <svg viewBox="0 0 100 100" className={styles.needle}>
        <path d="M50 22 57 50H43Z" className={styles.north} />
        <path d="M50 78 43 50h14Z" className={styles.south} />
        <circle cx="50" cy="50" r="4" className={styles.pin} />
      </svg>
    </span>
  );
}
