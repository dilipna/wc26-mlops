"use client";

import { motion } from "framer-motion";
import Flag from "./Flag";
import type { UpcomingMatch } from "@/lib/data";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Deterministic UTC formatting -- avoids a server/client hydration
// mismatch that toLocaleDateString/toLocaleTimeString cause when the
// server and browser don't share a locale or timezone.
function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day} · ${hh}:${mm} UTC`;
}

function ProbabilityBar({
  homeLabel,
  awayLabel,
  homePct,
  awayPct,
  drawPct,
  delay,
}: {
  homeLabel: string;
  awayLabel: string;
  homePct: number;
  awayPct: number;
  drawPct: number;
  delay: number;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-white/50 mb-1">
        <span>{(homePct * 100).toFixed(0)}%</span>
        {drawPct > 0 && <span>draw {(drawPct * 100).toFixed(0)}%</span>}
        <span>{(awayPct * 100).toFixed(0)}%</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${homePct * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
        />
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${drawPct * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-white/20"
        />
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${awayPct * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: delay + 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-gradient-to-r from-sky-500 to-sky-400"
        />
      </div>
      <div className="flex justify-between text-[11px] text-white/40 mt-1">
        <span>{homeLabel}</span>
        <span>{awayLabel}</span>
      </div>
    </div>
  );
}

export default function UpcomingMatches({ matches }: { matches: UpcomingMatch[] }) {
  const sorted = [...matches].sort((a, b) => a.commence_time.localeCompare(b.commence_time));

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {sorted.map((m, i) => {
        const bookHome = m.bookmaker[m.home_team] ?? 0;
        const bookAway = m.bookmaker[m.away_team] ?? 0;
        const bookDraw = m.bookmaker["Draw"] ?? 0;

        return (
          <motion.div
            key={`${m.home_team}-${m.away_team}-${m.commence_time}`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card rounded-2xl p-5 hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center justify-between text-xs text-white/40 mb-3">
              <span>{formatKickoff(m.commence_time)}</span>
              <span className="uppercase tracking-widest">Round of 32</span>
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flag team={m.home_team} className="text-2xl" />
                <span className="font-semibold text-white">{m.home_team}</span>
              </div>
              <span className="font-display text-white/30">VS</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{m.away_team}</span>
                <Flag team={m.away_team} className="text-2xl" />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-emerald-400/80 mb-1">
                  Our model
                </div>
                <ProbabilityBar
                  homeLabel="Model"
                  awayLabel=""
                  homePct={m.model.home_win}
                  awayPct={m.model.away_win}
                  drawPct={m.model.draw}
                  delay={0.1}
                />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-widest text-sky-400/80 mb-1">
                  Bookmaker odds
                </div>
                <ProbabilityBar
                  homeLabel="Bookmaker"
                  awayLabel=""
                  homePct={bookHome}
                  awayPct={bookAway}
                  drawPct={bookDraw}
                  delay={0.2}
                />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
