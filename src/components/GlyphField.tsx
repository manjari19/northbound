"use client";

import { useEffect, useMemo, useRef } from "react";
import styles from "./GlyphField.module.css";

/** A quiet star field with a couple of constellation lines. Stars twinkle and drift a little with the cursor. */
function rand(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export default function StarField() {
  const ref = useRef<HTMLDivElement>(null);
  const stars = useMemo(() => {
    const r = rand(42);
    const out = [];
    while (out.length < 60) {
      const x = r() * 100;
      const y = r() * 100;
      // keep the text column clear so no star sits between letters
      if (x > 18 && x < 82 && y > 14 && y < 92) continue;
      out.push({ x, y });
    }
    return out.map(({ x, y }) => ({
      x,
      y,
      size: r() < 0.12 ? 3 : r() < 0.5 ? 2 : 1.4,
      depth: 0.3 + r() * 0.9,
      delay: -r() * 6,
      dur: 3 + r() * 4,
      warm: r() < 0.15,
    }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", (e.clientX / innerWidth - 0.5).toFixed(3));
        el.style.setProperty("--my", (e.clientY / innerHeight - 0.5).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className={styles.field} aria-hidden="true">
      <div className={styles.aurora} />
      {/* Little Dipper, upper left, so "north" has a north star */}
      <svg className={styles.constellation} viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet">
        <polyline points="20,95 55,80 85,72 112,58 150,62 168,30 128,24 112,58" />
        {[
          [20, 95, 3.6],
          [55, 80, 2],
          [85, 72, 2],
          [112, 58, 2.2],
          [150, 62, 2.2],
          [168, 30, 2.4],
          [128, 24, 2.2],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} className={i === 0 ? styles.polaris : undefined} />
        ))}
      </svg>
      {stars.map((s, i) => (
        <span
          key={i}
          className={`${styles.star} ${s.warm ? styles.warm : ""} ${s.y > 12 && s.y < 94 ? styles.side : ""}`}
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              "--depth": s.depth,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
