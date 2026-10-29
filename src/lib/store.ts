"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store. Every component using the same key stays in sync,
 * and it survives refreshes. Everything is wrapped in try/catch because private
 * windows and blocked storage throw.
 */
const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, unknown>();
const PREFIX = "nb.";

function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw != null) value = JSON.parse(raw) as T;
  } catch {
    /* storage unavailable, use fallback */
  }
  cache.set(key, value);
  return value;
}

function write<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or blocked, keep in memory only */
  }
  listeners.get(key)?.forEach((fn) => fn());
}

export function useStored<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (fn: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(fn);
      const onStorage = (e: StorageEvent) => {
        if (e.key === PREFIX + key) {
          cache.delete(key);
          fn();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.get(key)!.delete(fn);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, fallback);
      write(key, typeof next === "function" ? (next as (p: T) => T)(prev) : next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

/** Everything the site saves, for the backup button. */
export const BACKUP_KEYS = [
  "apps", "lc.done", "lc.review", "lc.srs", "lc.log", "lc.goal", "stories", "storyMap", "practiced", "storyFeedback",
  "checks", "review.draft", "resume", "fits", "jds", "mocks", "radar.user", "interviewNotes", "rewrites",
];

export function exportBackup(): string {
  const data: Record<string, unknown> = { app: "northbound", exported_at: new Date().toISOString() };
  for (const k of BACKUP_KEYS) data[k] = read(k, null);
  return JSON.stringify(data, null, 2);
}

export function importBackup(text: string): number {
  const data = JSON.parse(text);
  if (data?.app !== "northbound") throw new Error("That file isn't a northbound backup.");
  let n = 0;
  for (const k of BACKUP_KEYS) {
    if (data[k] != null) {
      write(k, data[k]);
      n++;
    }
  }
  return n;
}
