"use client";

import { useMemo, useState } from "react";
import { teamCode } from "@/sports/football/identity";
import type { PredictionRow } from "@/lib/data";

// Seeds the "replay mode" called out for Phase 6 (life after the
// tournament ends, PROJECT_BRAIN.md #12) using real predictions_log.csv
// data already collected -- not simulated. Deliberately admin-only for
// now, not on the public site: the tournament (final July 19) isn't over
// yet, so this can only replay "so far," not the full story with a
// champion highlighted at the end, and the public site was intentionally
// trimmed to stay minimal (see PROJECT_BRAIN.md's recruiter-lens pass).
// Promote a polished version of this to the public site once there's a
// complete tournament to replay.
export default function ReplayScrubber({ predictions }: { predictions: PredictionRow[] }) {
  const seriesVersion = predictions.length ? predictions[predictions.length - 1].model_version : null;
  const series = useMemo(
    () => (seriesVersion ? predictions.filter((r) => r.model_version === seriesVersion) : []),
    [predictions, seriesVersion]
  );
  const dates = useMemo(() => Array.from(new Set(series.map((r) => r.date))).sort(), [series]);
  const [index, setIndex] = useState(dates.length - 1);

  if (dates.length === 0) {
    return <p className="text-xs text-text-secondary">No prediction history logged yet.</p>;
  }

  const selectedDate = dates[Math.min(index, dates.length - 1)];
  const leaderboard = series
    .filter((r) => r.date === selectedDate)
    .sort((a, b) => b.win_probability - a.win_probability)
    .slice(0, 8);

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={dates.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="w-full accent-[var(--series-1)]"
        />
        <span className="w-24 shrink-0 font-mono text-xs text-foreground">{selectedDate}</span>
      </div>
      <p className="mt-1 text-xs text-text-muted">
        Replaying {dates.length} logged day(s) of real predictions (series: {seriesVersion}) -- not the full
        tournament, since it isn&apos;t over yet (final: 2026-07-19).
      </p>
      <div className="mt-4 space-y-2">
        {leaderboard.map((row, i) => (
          <div key={row.team} className="flex items-center justify-between font-mono text-xs">
            <span className="text-text-secondary">
              {i + 1}. {teamCode(row.team)} {row.team}
            </span>
            <span className="tabular-nums text-foreground">{(row.win_probability * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
