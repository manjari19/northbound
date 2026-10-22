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
};

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
};

let feedPromise: Promise<Feed> | null = null;

export function useFeed() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    feedPromise ??= fetch("/data/postings.json", { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load postings (HTTP ${r.status}). Run the scraper once to create them.`);
      return r.json();
    });
    feedPromise.then(setFeed).catch((e) => {
      feedPromise = null;
      setError(String(e.message || e));
    });
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
