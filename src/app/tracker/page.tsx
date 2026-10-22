"use client";

import { useRef, useState } from "react";
import Pipeline from "@/components/Pipeline";
import { daysAgo, newId, STATUSES, today, useApps, type Application, type Status } from "@/lib/postings";
import { exportBackup, importBackup } from "@/lib/store";
import styles from "./tracker.module.css";

const GROUP_ORDER: Status[] = ["interview", "oa", "offer", "applied", "saved", "rejected"];

function AppRow({ app }: { app: Application }) {
  const [, setApps] = useApps();
  const [open, setOpen] = useState(false);
  const update = (patch: Partial<Application>) =>
    setApps((prev) => prev.map((a) => (a.id === app.id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)));

  const quiet = daysAgo(app.updatedAt.slice(0, 10)) ?? 0;
  const stale = app.status === "applied" && quiet >= 21;

  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <div className={styles.company}>
          {app.url ? (
            <a href={app.url} target="_blank" rel="noreferrer">
              {app.company}
            </a>
          ) : (
            app.company
          )}
        </div>
        <div>{app.title}</div>
        <div className={styles.meta}>
          {app.location ? <span>{app.location}</span> : null}
          {app.appliedOn && app.status !== "saved" ? <span>Applied {app.appliedOn}</span> : null}
          {stale ? <span className={styles.stale}>No change in {quiet} days. Follow up or let it go.</span> : null}
        </div>
        {app.notes && !open ? <p className={styles.notePreview}>{app.notes}</p> : null}
      </div>
      <div className={styles.controls}>
        <select
          className="select"
          value={app.status}
          aria-label={`Status for ${app.company}`}
          onChange={(e) => {
            const status = e.target.value as Status;
            update({ status, appliedOn: app.appliedOn ?? (status !== "saved" ? today() : undefined) });
          }}
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <button className="btn ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Done" : app.notes ? "Edit notes" : "Add notes"}
        </button>
        <button
          className="btn ghost danger"
          onClick={() => {
            if (confirm(`Remove ${app.company} from your tracker?`)) setApps((prev) => prev.filter((a) => a.id !== app.id));
          }}
        >
          Remove
        </button>
      </div>
      {open ? (
        <textarea
          className={`textarea ${styles.notes}`}
          value={app.notes}
          placeholder="Recruiter name, interview date, what they asked, follow-up plan…"
          onChange={(e) => update({ notes: e.target.value })}
          aria-label={`Notes for ${app.company}`}
          autoFocus
        />
      ) : null}
    </li>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [, setApps] = useApps();
  const [f, setF] = useState({ company: "", title: "", location: "", url: "", status: "applied" as Status, appliedOn: today() });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.company.trim() || !f.title.trim()) return;
        setApps((prev) => [
          { id: newId(), ...f, appliedOn: f.status === "saved" ? undefined : f.appliedOn, notes: "", updatedAt: new Date().toISOString() },
          ...prev,
        ]);
        onDone();
      }}
    >
      <label className="field">
        <span>Company</span>
        <input className="input" required value={f.company} onChange={set("company")} />
      </label>
      <label className="field">
        <span>Role</span>
        <input className="input" required value={f.title} onChange={set("title")} />
      </label>
      <label className="field">
        <span>Location</span>
        <input className="input" value={f.location} onChange={set("location")} placeholder="Burnaby, BC" />
      </label>
      <label className="field">
        <span>Posting link</span>
        <input className="input" type="url" value={f.url} onChange={set("url")} placeholder="https://" />
      </label>
      <label className="field">
        <span>Status</span>
        <select className="select" value={f.status} onChange={set("status")} style={{ width: "100%" }}>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Applied on</span>
        <input className="input" type="date" value={f.appliedOn} onChange={set("appliedOn")} disabled={f.status === "saved"} />
      </label>
      <div className={styles.formActions}>
        <button className="btn primary" type="submit">
          Add application
        </button>
        <button className="btn ghost" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function TrackerPage() {
  const [apps] = useApps();
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function download() {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `northbound-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMsg("Backup downloaded.");
  }

  async function restore(file: File) {
    try {
      const n = importBackup(await file.text());
      setMsg(`Restored ${n} sections from ${file.name}.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That file couldn't be read.");
    }
  }

  return (
    <div className="wrap">
      <header className="page-head">
        <h1>Tracker</h1>
        <p>Everything lives in this browser. Download a backup now and then, or to move it to another device.</p>
      </header>

      <div className={styles.toolbar}>
        <button className="btn primary" onClick={() => setAdding(true)} disabled={adding}>
          Add application
        </button>
        <button className="btn" onClick={download}>
          Download backup
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Restore backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0]) restore(e.target.files[0]);
            e.target.value = "";
          }}
        />
        {msg ? (
          <span className="muted small" role="status">
            {msg}
          </span>
        ) : null}
      </div>

      {adding ? <AddForm onDone={() => setAdding(false)} /> : null}

      {apps.length ? (
        <>
          <div className={styles.pipeline}>
            <Pipeline apps={apps} />
          </div>
          {GROUP_ORDER.map((status) => {
            const group = apps.filter((a) => a.status === status);
            if (!group.length) return null;
            const label = STATUSES.find((s) => s.id === status)!.label;
            return (
              <details key={status} className={styles.group} open={status !== "rejected"}>
                <summary>
                  <h2>{label}</h2>
                  <span className={`pill ${status}`}>{group.length}</span>
                </summary>
                <ul className={styles.list}>
                  {group.map((a) => (
                    <AppRow key={a.id} app={a} />
                  ))}
                </ul>
              </details>
            );
          })}
        </>
      ) : !adding ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <strong>No applications yet</strong>
          Track postings from the Postings page, or add one by hand for roles from myExperience or a referral.
        </div>
      ) : null}
    </div>
  );
}
