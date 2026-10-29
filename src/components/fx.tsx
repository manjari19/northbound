"use client";

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------ company monogram */

const HUES = [12, 28, 42, 160, 190, 205, 222, 250, 275, 300, 330, 350];

export function Logo({ name, size = 32 }: { name: string; size?: number }) {
  const clean = name.replace(/\(.*?\)/g, "").replace(/[^A-Za-z0-9 &]/g, " ").trim();
  const words = clean.split(/\s+/).filter((w) => !/^(the|of|and|inc|ltd|llc|corp)$/i.test(w));
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return (
    <span
      className="logo"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(140deg, hsl(${hue} 60% 46%), hsl(${(hue + 30) % 360} 55% 30%))`,
      }}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------ count-up number */

export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown.toLocaleString()}</>;
}

/* ------------------------------------------------------------ live clock */

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!now) return <span>Loading current time…</span>;
  return (
    <time dateTime={now.toISOString()} style={{ fontVariantNumeric: "tabular-nums" }}>
      {now.toLocaleString("en-CA", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      })}
    </time>
  );
}

/* ------------------------------------------------------------ next sweep countdown */

const SWEEP_MS = 30 * 60 * 1000;

/** "Next sweep in 23:41". GitHub Actions runs the scraper every 30 minutes. */
export function NextSweep({ updatedAt }: { updatedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return null;
  const last = new Date(updatedAt).getTime();
  const ago = Math.max(0, Math.round((now - last) / 60000));
  const left = last + SWEEP_MS - now;
  const pct = Math.min(1, Math.max(0, 1 - left / SWEEP_MS));
  const mm = Math.floor(Math.max(0, left) / 60000);
  const ss = Math.floor((Math.max(0, left) % 60000) / 1000);
  return (
    <div className="sweep" role="status">
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(190,210,255,.15)" strokeWidth="2.5" />
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--aurora)" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={50.3} strokeDashoffset={50.3 * (1 - pct)} transform="rotate(-90 10 10)" />
      </svg>
      {left > 0 ? (
        <span>
          Next sweep in{" "}
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {mm}:{String(ss).padStart(2, "0")}
          </strong>
        </span>
      ) : left > -20 * 60 * 1000 ? (
        <span>Sweeping job boards now…</span>
      ) : (
        <span>Next sweep is running a little late. GitHub Actions will catch up.</span>
      )}
      <span className="sweep-sep" aria-hidden="true" />
      <span className="muted">last sweep {ago === 0 ? "just now" : `${ago} min ago`}</span>
    </div>
  );
}

/* ------------------------------------------------------------ confetti */

const COLORS = ["#6ee7c5", "#a6f4de", "#a99bff", "#ffd98a", "#eef0f6", "#9cc4ff", "#ff9bd2"];

/** A small celebratory burst from a point on screen. Skipped for reduced motion. */
export function confetti(x: number, y: number, count = 70) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "70" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const v = 6 + Math.random() * 7;
    return {
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    };
  });
  const start = performance.now();
  const frame = (t: number) => {
    const age = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.28;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (age < 1800) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------ toast */

let pushToast: ((msg: string) => void) | null = null;

export function toast(msg: string) {
  pushToast?.(msg);
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  const [key, setKey] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      setKey((k) => k + 1);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2200);
    };
    return () => {
      pushToast = null;
      clearTimeout(t);
    };
  }, []);
  return msg ? (
    <div key={key} className="toast" role="status">
      {msg}
    </div>
  ) : null;
}
