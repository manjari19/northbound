"use client";

import { useEffect, useState } from "react";
import { useStored } from "./store";

export type Posting = {
  id: string;
  company: string;
  title: string;
  locations: string[];
  url: string;
  source: string;
  category: "Software" | "Data & ML" | "Product" | "Hardware" | "Quant" | "Other";
  terms: string[];
  posted: string | null;
  first_seen: string;
  pay?: string | null;
  regions?: Region[];
};

export const REGIONS = ["Canada", "US", "Remote"] as const;
export type Region = (typeof REGIONS)[number];

/** Region filter shared by the home board and the Postings page, remembered per browser. */
export function useRegions() {
  return useStored<Region[]>("regions", [...REGIONS]);
}

/** Rough hourly rate from strings like "$63/hr", "$45-52/hr", "$95k/yr". Null when unknown. */
export function hourly(pay?: string | null): number | null {
  if (!pay) return null;
  const m = pay.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!m) return null;
  let n = parseFloat(m[1]) * (m[2] ? 1000 : 1);
  if (/yr|year|annual|k\b/i.test(pay) || n > 400) n = n / 2080;
  else if (/mo|month/i.test(pay)) n = n / 173;
  return n >= 10 && n <= 400 ? n : null;
}

export function inRegions(p: Posting, regions: Region[]): boolean {
  const mine = p.regions?.length ? p.regions : (["Canada"] as Region[]); // older data files were Canada-only
  return mine.some((r) => regions.includes(r));
}

export type Feed = { updated_at: string; count: number; postings: Posting[] };

export const STATUSES = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "oa", label: "Online assessment" },
  { id: "interview", label: "Interviewing" },
  { id: "offer", label: "Offer" },
  { id: "rejected", label: "Rejected" },
] as const;

export type Status = (typeof STATUSES)[number]["id"];

export type Application = {
  id: string;
  postingId?: string;
  company: string;
  title: string;
  location: string;
  url: string;
  status: Status;
  appliedOn?: string;
  notes: string;
  updatedAt: string;
  fitScore?: number;
};

let feedPromise: Promise<Feed> | null = null;
let fetchedAt = 0;
const REFRESH_MS = 5 * 60 * 1000;

async function loadFeed(): Promise<Feed> {
  // In `npm run dev`, prefer the file your 5-minute local scraper writes
  if (process.env.NODE_ENV === "development") {
    const local = await fetch("/data/postings.local.json", { cache: "no-cache" }).catch(() => null);
    if (local?.ok) return local.json();
  }
  // In production the scraper commits fresh data to GitHub every 30 minutes, so read it from there
  // instead of rebuilding the site. Falls back to the copy bundled at build time.
  const remote = process.env.NEXT_PUBLIC_DATA_URL;
  let r = remote ? await fetch(remote, { cache: "no-cache" }).catch(() => null) : null;
  if (!r || !r.ok) r = await fetch("/data/postings.json", { cache: "no-cache" });
  if (!r.ok) throw new Error(`Couldn't load postings (HTTP ${r.status}). Run the scraper once to create them.`);
  return r.json();
}

function normalizeFeed(f: Feed): Feed {
  for (const p of f.postings) p.terms = [...new Set(p.terms.map(normTerm))].sort((a, b) => termOrder(a) - termOrder(b));
  return f;
}

export function useFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const pull = (force = false) => {
      if (force || !feedPromise || Date.now() - fetchedAt > REFRESH_MS) {
        fetchedAt = Date.now();
        feedPromise = loadFeed().then(normalizeFeed);
      }
      feedPromise
        .then((f) => alive && (setFeed(f), setError(null)))
        .catch((e) => {
          feedPromise = null;
          if (alive) setError(String(e.message || e));
        });
    };
    pull();
    // Keep an open tab current without a reload
    const timer = window.setInterval(() => document.visibilityState === "visible" && pull(true), REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && pull();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return { feed, error };
}

export function useApps() {
  return useStored<Application[]>("apps", []);
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Whole days between a YYYY-MM-DD date and today, in local time. */
export function daysAgo(date: string | null | undefined): number | null {
  if (!date) return null;
  const [y, m, d] = date.split("-").map(Number);
  const then = new Date(y, m - 1, d).getTime();
  const now = new Date(new Date().toDateString()).getTime();
  return Math.max(0, Math.round((now - then) / 86_400_000));
}

export function ageLabel(p: Posting): string {
  const n = daysAgo(p.posted ?? p.first_seen);
  if (n == null) return "";
  if (n === 0) return "Today";
  if (n === 1) return "1d";
  return `${n}d`;
}

// Canadian co-op terms. Spring is the same as Winter (Jan-Apr).
const MONTHS: Record<string, string> = { Winter: "Jan-Apr", Summer: "May-Aug", Fall: "Sep-Dec" };
const SEASON_ORDER: Record<string, number> = { Winter: 1, Summer: 2, Fall: 3 };

export function normTerm(t: string): string {
  const [season, year] = t.split(" ");
  return `${season === "Spring" ? "Winter" : season === "Autumn" ? "Fall" : season} ${year}`;
}

export function termOrder(t: string): number {
  const [season, year] = normTerm(t).split(" ");
  return Number(year) * 10 + (SEASON_ORDER[season] ?? 0);
}

/** "Winter 2027" -> "Winter 2027 (Jan-Apr)" */
export function termLabel(t: string): string {
  const n = normTerm(t);
  const m = MONTHS[n.split(" ")[0]];
  return m ? `${n} (${m})` : n;
}

/** "New" means the scraper found it today, the same rule the alert emails use. */
export function isNew(p: Posting): boolean {
  return daysAgo(p.first_seen) === 0;
}

export function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function city(p: { locations: string[] }): string {
  const first = (p.locations[0] || "Canada").replace(/,\s*Canada$/i, "");
  return p.locations.length > 1 ? `${first} +${p.locations.length - 1}` : first;
}

export function statusLabel(s: Status) {
  return STATUSES.find((x) => x.id === s)?.label ?? s;
}

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function appFromPosting(p: Posting, status: Status = "saved"): Application {
  return {
    id: newId(),
    postingId: p.id,
    company: p.company,
    title: p.title,
    location: city(p),
    url: p.url,
    status,
    appliedOn: status === "applied" ? today() : undefined,
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}
