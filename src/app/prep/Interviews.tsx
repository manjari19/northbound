"use client";

import { useEffect, useMemo, useState } from "react";
import { openFit } from "@/components/FitDrawer";
import { ScoreRing } from "@/components/FitResult";
import { Logo } from "@/components/fx";
import MockInterview from "@/components/MockInterview";
import { statusLabel, useApps, type Status } from "@/lib/postings";
import { fetchJobDescription, fitKey, useFits, useJDs, useMocks } from "@/lib/radar";
import { useStored } from "@/lib/store";
import styles from "./prep.module.css";

type Room = { key: string; company: string; title: string; url?: string; status?: Status; postingId?: string };

function Probes({ k }: { k: string }) {
  const [fits] = useFits();
  const fit = fits[k];
  if (!fit) return null;
  const a = fit.analysis;
  return (
    <section className={styles.probes}>
      <div className={styles.probeHead}>
        <ScoreRing score={a.fit_score} size={52} />
        <div>
          <strong>Where they&apos;ll probe</strong>
          <p className="muted small">From your fit check. Have a concrete story or an honest plan for each.</p>
        </div>
      </div>
      <ul>
        {a.weaknesses.map((w, i) => (
          <li key={i}>
            <strong>{w.category}</strong>
            <span>{w.gap}</span>
          </li>
        ))}
      </ul>
      {a.keyword_analysis.missing_keywords.length ? (
        <p className="small">
          <span className="muted">Be ready to say how you&apos;d pick up: </span>
          {a.keyword_analysis.missing_keywords.slice(0, 8).join(", ")}
        </p>
      ) : null}
      {a.strengths.length ? (
        <p className="small">
          <span className="muted">Lead with: </span>
          {a.strengths
            .slice(0, 3)
            .map((s) => s.category)
            .join(", ")}
        </p>
      ) : null}
    </section>
  );
}

function RoomView({ room }: { room: Room }) {
  const [jds, setJds] = useJDs();
  const [notes, setNotes] = useStored<Record<string, string>>("interviewNotes", {});
  const [fits] = useFits();
  const [fetching, setFetching] = useState(false);
  const jd = jds[room.key] ?? "";
  const [showJd, setShowJd] = useState(!jd);

  useEffect(() => {
    setShowJd(!jds[room.key]);
    if (!jds[room.key] && room.url) {
      setFetching(true);
      fetchJobDescription(room.url)
        .then((t) => t && setJds((prev) => ({ ...prev, [room.key]: t })))
        .finally(() => setFetching(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.key]);

  return (
    <div className={styles.room}>
      <header className={styles.roomHead}>
        <Logo name={room.company} size={44} />
        <div>
          <h2>{room.company}</h2>
          <span className="muted">{room.title}</span>
        </div>
        {room.status ? <span className={`pill ${room.status}`}>{statusLabel(room.status)}</span> : null}
      </header>

      <section className={styles.jdBox}>
        <button className={styles.jdToggle} onClick={() => setShowJd((s) => !s)} aria-expanded={showJd}>
          Job description {jd ? `(${jd.split(/\s+/).length} words)` : fetching ? "(fetching…)" : "(add it)"}
        </button>
        {showJd ? (
          <textarea
            className="textarea"
            rows={8}
            value={jd}
            onChange={(e) => setJds((prev) => ({ ...prev, [room.key]: e.target.value }))}
            placeholder="Paste the posting. The mock interview and fit check both use it."
          />
        ) : null}
      </section>

      {fits[room.key] ? (
        <Probes k={room.key} />
      ) : (
        <div className={styles.noFit}>
          <span>Run a fit check to see which gaps they&apos;re likely to probe.</span>
          <button className="btn" onClick={() => openFit({ company: room.company, title: room.title, url: room.url, id: room.postingId || room.key })}>
            Check fit
          </button>
        </div>
      )}

      <label className="field">
        <span>Your notes for this one</span>
        <textarea
          className="textarea"
          rows={4}
          value={notes[room.key] ?? ""}
          onChange={(e) => setNotes((prev) => ({ ...prev, [room.key]: e.target.value }))}
          placeholder="Interviewer names, date and time, what the team builds, questions you want to ask them…"
        />
      </label>

      <MockInterview mkey={room.key} company={room.company} role={room.title} jd={jd} />
    </div>
  );
}

export default function Interviews({ focus }: { focus?: string }) {
  const [apps] = useApps();
  const [fits] = useFits();
  const [mocks] = useMocks();

  const rooms = useMemo(() => {
    const out = new Map<string, Room>();
    apps
      .filter((a) => a.status === "interview" || a.status === "oa")
      .forEach((a) => {
        const key = fitKey(a);
        out.set(key, { key, company: a.company, title: a.title, url: a.url, status: a.status, postingId: a.postingId });
      });
    // Anything you've mock-interviewed for, or opened from a fit check
    Object.values(mocks).forEach((m) => !out.has(m.key) && out.set(m.key, { key: m.key, company: m.company, title: m.role }));
    if (focus && !out.has(focus)) {
      const f = fits[focus];
      const a = apps.find((x) => fitKey(x) === focus);
      if (f) out.set(focus, { key: focus, company: f.company, title: f.title, url: f.url, postingId: f.postingId });
      else if (a) out.set(focus, { key: focus, company: a.company, title: a.title, url: a.url, status: a.status, postingId: a.postingId });
    }
    return [...out.values()];
  }, [apps, fits, mocks, focus]);

  const [sel, setSel] = useState<string | null>(focus ?? null);
  useEffect(() => {
    if (focus) setSel(focus);
  }, [focus]);
  const current = rooms.find((r) => r.key === sel) ?? rooms[0];

  if (!rooms.length) {
    return (
      <div className="empty">
        <strong>No interviews to prep yet</strong>
        Set an application to Interviewing or Online assessment in your tracker, or open Check fit on any posting and
        choose Practice an interview.
      </div>
    );
  }

  return (
    <div className={styles.rooms}>
      <nav className={styles.roomList} aria-label="Interviews">
        {rooms.map((r) => (
          <button key={r.key} aria-current={current?.key === r.key ? "true" : undefined} onClick={() => setSel(r.key)}>
            <Logo name={r.company} size={30} />
            <span>
              <strong>{r.company}</strong>
              <span className="muted small">{r.title}</span>
            </span>
            {mocks[r.key]?.overallScore != null ? <span className={styles.mockScore}>{mocks[r.key].overallScore}</span> : null}
          </button>
        ))}
      </nav>
      {current ? <RoomView key={current.key} room={current} /> : null}
    </div>
  );
}
