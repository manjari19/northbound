"use client";

import { appFromPosting, STATUSES, today, useApps, type Posting, type Status } from "@/lib/postings";

export default function TrackSelect({ posting }: { posting: Posting }) {
  const [apps, setApps] = useApps();
  const app = apps.find((a) => a.postingId === posting.id);

  function change(value: string) {
    if (value === "") {
      setApps((prev) => prev.filter((a) => a.postingId !== posting.id));
      return;
    }
    const status = value as Status;
    setApps((prev) => {
      const existing = prev.find((a) => a.postingId === posting.id);
      if (!existing) return [appFromPosting(posting, status), ...prev];
      return prev.map((a) =>
        a.postingId === posting.id
          ? { ...a, status, appliedOn: a.appliedOn ?? (status !== "saved" ? today() : undefined), updatedAt: new Date().toISOString() }
          : a,
      );
    });
  }

  return (
    <select
      className="select"
      value={app?.status ?? ""}
      onChange={(e) => change(e.target.value)}
      aria-label={`Tracking status for ${posting.company} ${posting.title}`}
      data-tracked={app ? app.status : undefined}
      style={{ minWidth: 150 }}
    >
      <option value="">Not tracked</option>
      {STATUSES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
