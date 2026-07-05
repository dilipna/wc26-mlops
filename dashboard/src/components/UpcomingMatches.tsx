"use client";

import { motion } from "framer-motion";
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
  label,
  labelColor,
  homePct,
  awayPct,
  drawPct,
  fillColor,
  delay,
}: {
  label: string;
  labelColor: string;
  homePct: number;
  awayPct: number;
  drawPct: number;
  fillColor: string;
  delay: number;
}) {
  return (
    <div>
      <div className="font-mono mb-1.5 flex justify-between text-[11px]" style={{ color: labelColor }}>
        <span>{label}</span>
        <span>
          {(homePct * 100).toFixed(0)}% &middot; {(awayPct * 100).toFixed(0)}%
        </span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${homePct * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
          style={{ background: fillColor }}
        />
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${drawPct * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-foreground/15"
        />
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${awayPct * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: delay + 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
          style={{ background: fillColor, opacity: 0.4 }}
        />
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
            className="glass-card rounded-2xl p-5"
          >
            <div className="font-mono flex items-center justify-between text-[11px] text-foreground/40 mb-4">
              <span>{formatKickoff(m.commence_time)}</span>
            </div>

            <div className="flex items-baseline justify-between mb-[18px]">
              <span className="font-display text-[19px] font-bold text-foreground">{m.home_team}</span>
              <span className="font-mono text-[11px] text-foreground/35">VS</span>
              <span className="font-display text-[19px] font-bold text-foreground">{m.away_team}</span>
            </div>

            <div className="space-y-2.5">
              <ProbabilityBar
                label="MODEL"
                labelColor="var(--accent)"
                homePct={m.model.home_win}
                awayPct={m.model.away_win}
                drawPct={m.model.draw}
                fillColor="var(--accent)"
                delay={0.1}
              />
              <ProbabilityBar
                label="MARKET"
                labelColor="rgba(242,237,224,0.45)"
                homePct={bookHome}
                awayPct={bookAway}
                drawPct={bookDraw}
                fillColor="rgba(242,237,224,0.5)"
                delay={0.2}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
