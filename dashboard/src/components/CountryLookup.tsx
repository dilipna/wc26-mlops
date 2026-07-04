"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Flag from "./Flag";
import { seriesForTeam, type PredictionRow, type TeamStatus } from "@/lib/data";

function Sparkline({ rows }: { rows: PredictionRow[] }) {
  if (rows.length < 2) return null;
  const width = 200;
  const height = 44;
  const pad = 4;
  const max = Math.max(...rows.map((r) => r.win_probability), 0.01);
  const points = rows
    .map((r, i) => {
      const x = pad + (i / (rows.length - 1)) * (width - pad * 2);
      const y = height - pad - (r.win_probability / max) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CountryLookup({ teams }: { teams: TeamStatus[] }) {
  const [selected, setSelected] = useState(teams[0]?.team ?? "");
  const team = teams.find((t) => t.team === selected);
  const series = selected ? seriesForTeam(selected) : [];
  const lastKnown = series.length > 0 ? series[series.length - 1].win_probability : null;

  return (
    <div className="glass-card rounded-2xl p-6 sm:p-8">
      <label className="font-mono mb-2 block text-[11px] uppercase tracking-[0.16em] text-foreground/40">
        Select your country
      </label>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="font-mono w-full rounded-xl border border-foreground/15 bg-transparent px-4 py-3 text-sm text-foreground [&>option]:bg-[#0d0c0a]"
      >
        {teams.map((t) => (
          <option key={t.team} value={t.team}>
            {t.team}
          </option>
        ))}
      </select>

      {team && (
        <motion.div
          key={team.team}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <Flag team={team.team} className="text-4xl" />
            <div>
              <div className="font-display text-2xl font-bold text-foreground">{team.team}</div>
              <span
                className="font-mono mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wide"
                style={{
                  color: team.status === "alive" ? "var(--accent)" : "rgba(242,237,224,0.5)",
                  border: `1px solid ${team.status === "alive" ? "var(--accent)" : "rgba(242,237,224,0.25)"}`,
                }}
              >
                {team.status === "alive" ? "Still Alive" : "Eliminated"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {series.length >= 2 && (
              <div className="w-[160px] shrink-0">
                <Sparkline rows={series} />
              </div>
            )}
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/40">
                {team.status === "alive" ? "P(champion)" : "Last tracked"}
              </div>
              <div className="font-mono text-3xl font-semibold text-foreground">
                {team.current_probability !== null
                  ? `${(team.current_probability * 100).toFixed(1)}%`
                  : lastKnown !== null
                    ? `${(lastKnown * 100).toFixed(1)}%`
                    : "—"}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
