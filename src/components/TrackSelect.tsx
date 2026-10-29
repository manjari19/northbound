"use client";

import { confetti, toast } from "@/components/fx";
import { appFromPosting, statusLabel, STATUSES, today, useApps, type Posting, type Status } from "@/lib/postings";

/** Little celebrations for moving an application forward. */
export function celebrate(status: Status, company: string, el?: Element | null) {
  const r = el?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : innerWidth / 2;
  const y = r ? r.top + r.height / 2 : innerHeight / 2;
  if (status === "offer") {
    confetti(x, y, 120);
    toast(`An offer from ${company}! 🎉`);
  } else if (status === "interview") {
    confetti(x, y, 40);
    toast(`Interview with ${company}. You've got this.`);
  } else if (status === "oa") toast(`Online assessment for ${company}. Go get it.`);
  else if (status === "applied") toast(`Applied to ${company}. One more out the door.`);
  else if (status === "saved") toast(`Saved ${company} to your tracker.`);
  else if (status === "rejected") toast(`Their loss. On to the next one.`);
}

export default function TrackSelect({ posting }: { posting: Posting }) {
  const [apps, setApps] = useApps();
  const app = apps.find((a) => a.postingId === posting.id);

  function change(value: string, el: HTMLSelectElement) {
    if (value === "") {
      setApps((prev) => prev.filter((a) => a.postingId !== posting.id));
      toast(`Stopped tracking ${posting.company}.`);
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
    celebrate(status, posting.company, el);
  }

  return (
    <select
      className="select status-select"
      value={app?.status ?? ""}
      onChange={(e) => change(e.target.value, e.target)}
      aria-label={`Tracking status for ${posting.company} ${posting.title}`}
      data-tracked={app ? app.status : undefined}
      title={app ? statusLabel(app.status) : "Not tracked"}
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
