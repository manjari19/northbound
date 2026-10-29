"use client";

import { fitKey, useFits } from "@/lib/radar";

/** "Check fit" button that turns into the score once a fit check exists. */
export default function FitBadge({
  target,
  onClick,
}: {
  target: { id?: string; postingId?: string; company: string; title: string };
  onClick: () => void;
}) {
  const [fits] = useFits();
  const fit = fits[fitKey(target)];
  if (!fit) {
    return (
      <button className="btn ghost fit-btn" onClick={onClick} title="Score your résumé against this posting with ResumeRadar">
        Check fit
      </button>
    );
  }
  const s = fit.analysis.fit_score;
  const tone = s >= 70 ? "good" : s >= 50 ? "mid" : "low";
  return (
    <button className={`fit-score ${tone}`} onClick={onClick} title={`${fit.analysis.match_level} fit. Open the breakdown.`}>
      <span>{Math.round(s)}</span>
      fit
    </button>
  );
}
