"use client";

import { useEffect, useState } from "react";
import { RESOURCES } from "@/lib/prep-data";
import Interviews from "./Interviews";
import LeetCode from "./LeetCode";
import Stories from "./Stories";
import Today from "./Today";
import styles from "./prep.module.css";

const TABS = [
  { id: "today", name: "Today" },
  { id: "interviews", name: "My interviews" },
  { id: "leetcode", name: "LeetCode" },
  { id: "stories", name: "Stories" },
  { id: "resources", name: "Resources" },
];

function Resources() {
  return (
    <ul className={styles.resources}>
      {RESOURCES.map((r) => (
        <li key={r.url}>
          <a href={r.url} target="_blank" rel="noreferrer">
            {r.name}
          </a>
          <span className="muted">{r.note}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrepPage() {
  const [tab, setTab] = useState("today");
  const [focus, setFocus] = useState<string | undefined>();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab");
    if (t === "behavioral") setTab("stories");
    else if (t && TABS.some((x) => x.id === t)) setTab(t);
    if (p.get("key")) setFocus(p.get("key")!);
  }, []);

  const go = (id: string, key?: string) => {
    setTab(id);
    setFocus(key);
    window.history.replaceState(null, "", id === "today" ? "/prep/" : `/prep/?tab=${id}${key ? `&key=${encodeURIComponent(key)}` : ""}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Interview prep</h1>
        <p>A daily LeetCode plan that brings problems back before you forget them, a prep room for every interview, and stories you can practice out loud.</p>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
            {t.name}
          </button>
        ))}
      </div>
      {tab === "today" ? (
        <Today go={go} />
      ) : tab === "interviews" ? (
        <Interviews focus={focus} />
      ) : tab === "leetcode" ? (
        <LeetCode />
      ) : tab === "stories" ? (
        <Stories focus={focus} />
      ) : (
        <Resources />
      )}
    </div>
  );
}
