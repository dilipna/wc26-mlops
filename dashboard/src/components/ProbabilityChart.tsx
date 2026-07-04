"use client";

import { motion } from "framer-motion";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PredictionRow } from "@/lib/data";

const LINE_COLORS = ["#C2D588", "#e8e4dc", "#7A5A44", "#a3c9a8", "#c9a86a", "#8a9a6e"];

function buildChartRows(seriesByTeam: Map<string, PredictionRow[]>, teams: string[]) {
  const dateSet = new Set<string>();
  for (const team of teams) {
    for (const row of seriesByTeam.get(team) ?? []) dateSet.add(row.date);
  }
  const dates = Array.from(dateSet).sort();

  return dates.map((date) => {
    const point: Record<string, number | string> = { date };
    for (const team of teams) {
      const row = (seriesByTeam.get(team) ?? []).find((r) => r.date === date);
      if (row) point[team] = Number((row.win_probability * 100).toFixed(2));
    }
    return point;
  });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl px-4 py-3 text-sm">
      <div className="font-mono mb-1 text-xs uppercase tracking-widest text-foreground/50">{label}</div>
      {payload
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 py-0.5">
            <span className="text-foreground/80">{entry.name}</span>
            <span className="font-mono ml-auto font-semibold" style={{ color: entry.color }}>
              {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
    </div>
  );
}

export default function ProbabilityChart({
  seriesByTeam,
  teams,
}: {
  seriesByTeam: Map<string, PredictionRow[]>;
  teams: string[];
}) {
  const rows = buildChartRows(seriesByTeam, teams);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card rounded-2xl p-4 sm:p-6"
    >
      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="rgba(242,237,224,0.08)" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="rgba(242,237,224,0.35)"
              tick={{ fontSize: 12, fill: "rgba(242,237,224,0.5)", fontFamily: "var(--font-plex-mono), monospace" }}
              tickLine={false}
            />
            <YAxis
              stroke="rgba(242,237,224,0.35)"
              tick={{ fontSize: 12, fill: "rgba(242,237,224,0.5)", fontFamily: "var(--font-plex-mono), monospace" }}
              tickLine={false}
              unit="%"
              width={44}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 13, color: "rgba(242,237,224,0.7)", fontFamily: "var(--font-plex-mono), monospace" }}
            />
            {teams.map((team, i) => (
              <Line
                key={team}
                type="monotone"
                dataKey={team}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2.5}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                animationDuration={1200}
                animationEasing="ease-out"
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
