"use client";

import { motion } from "framer-motion";
import Flag from "./Flag";
import StatsStrip from "./StatsStrip";
import type { GradedMatch, ProofTrackerData } from "@/lib/data";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Same deterministic-UTC approach as UpcomingMatches -- avoids a
// server/client hydration mismatch from locale-dependent formatting.
function formatUTC(iso: string): string {
  const d = new Date(iso);
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hh}:${mm} UTC`;
}

function outcomeTeam(outcome: string, home: string, away: string): string {
  if (outcome === "home_win") return home;
  if (outcome === "away_win") return away;
  return "Draw";
}

function GradedCard({ match, delay }: { match: GradedMatch; delay: number }) {
  const modelPick = outcomeTeam(match.model_predicted_outcome, match.home_team, match.away_team);
  const modelConfidence = match.model[match.model_predicted_outcome] * 100;
  const bookmakerPick = match.bookmaker_predicted_outcome
    ? outcomeTeam(match.bookmaker_predicted_outcome, match.home_team, match.away_team)
    : null;
  const bookmakerConfidence =
    match.bookmaker && match.bookmaker_predicted_outcome
      ? match.bookmaker[match.bookmaker_predicted_outcome] * 100
      : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl p-5"
    >
      <div className="flex items-center justify-between text-xs text-white/40 mb-3">
        <span>Predicted {formatUTC(match.logged_at)}</span>
        <span className={match.model_correct ? "text-emerald-400" : "text-rose-400"}>
          {match.model_correct ? "✓ Correct" : "✗ Missed"}
        </span>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flag team={match.home_team} className="text-2xl" />
          <span className="font-semibold text-white">{match.home_team}</span>
        </div>
        <span className="font-display text-lg text-white">
          {match.home_score} - {match.away_score}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{match.away_team}</span>
          <Flag team={match.away_team} className="text-2xl" />
        </div>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-widest text-cyan-400/80">Our AI said</span>
          <span className="text-white/80">
            {modelPick} <span className="text-cyan-300">{modelConfidence.toFixed(0)}%</span>
          </span>
        </div>
        {bookmakerPick && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-widest text-fuchsia-400/80">World expected</span>
            <span className="text-white/60">
              {bookmakerPick} <span className="text-fuchsia-300">{bookmakerConfidence!.toFixed(0)}%</span>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CalibrationChart({ calibration }: { calibration: ProofTrackerData["calibration"] }) {
  const graded = calibration.filter((b) => b.n > 0);
  if (graded.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-white/40">
        Calibration -- when our AI says X%, does it happen X% of the time?
      </div>
      <div className="grid grid-cols-5 gap-3">
        {calibration.map((bucket, i) => (
          <div key={bucket.bucket_label} className="text-center">
            <div className="flex h-24 items-end justify-center gap-1">
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: `${bucket.predicted_mid * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.08 }}
                className="w-3.5 rounded-t-sm bg-white/25"
                title={`Predicted ~${(bucket.predicted_mid * 100).toFixed(0)}%`}
              />
              <motion.div
                initial={{ height: 0 }}
                whileInView={{ height: bucket.actual_rate !== null ? `${bucket.actual_rate * 100}%` : "0%" }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: i * 0.08 + 0.1 }}
                className="w-3.5 rounded-t-sm bg-gradient-to-t from-cyan-500 to-cyan-300"
                title={bucket.actual_rate !== null ? `Actual ${(bucket.actual_rate * 100).toFixed(0)}%` : "No data yet"}
              />
            </div>
            <div className="mt-2 text-[11px] text-white/40">{bucket.bucket_label}</div>
            <div className="text-[11px] text-white/30">n={bucket.n}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[11px] text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white/30" /> Predicted confidence
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-cyan-400" /> Actually correct
        </span>
      </div>
    </div>
  );
}

export default function ProofTracker({ data }: { data: ProofTrackerData }) {
  const { graded_matches, summary } = data;

  if (summary.n_graded === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-white/50">
        No completed knockout matches graded yet -- every pre-kickoff prediction is already logged, so the first
        finished match will land here automatically on the next daily run.
      </div>
    );
  }

  const stats = [
    { label: "Matches graded", value: String(summary.n_graded) },
    { label: "Our AI accuracy", value: `${(summary.model_accuracy! * 100).toFixed(0)}%` },
    { label: "Our AI avg. Brier", value: summary.model_avg_brier!.toFixed(3) },
    {
      label: "Bookmaker accuracy",
      value: summary.bookmaker_accuracy !== null ? `${(summary.bookmaker_accuracy * 100).toFixed(0)}%` : "n/a",
    },
  ];

  return (
    <div className="space-y-8">
      <StatsStrip stats={stats} />
      <div className="grid gap-5 sm:grid-cols-2">
        {graded_matches.map((m, i) => (
          <GradedCard key={`${m.home_team}-${m.away_team}-${m.commence_time}`} match={m} delay={(i % 4) * 0.08} />
        ))}
      </div>
      <CalibrationChart calibration={data.calibration} />
    </div>
  );
}
