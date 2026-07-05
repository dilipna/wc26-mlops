"use client";

import type { MatchResult } from "@/lib/data";

function TickerRow({ results, copy }: { results: MatchResult[]; copy: number }) {
  return (
    <div className="flex flex-none gap-3.5">
      {results.map((r, i) => (
        <div
          key={`${copy}-${r.date}-${r.home_team}-${r.away_team}-${i}`}
          className="font-mono glass-card flex flex-none items-center gap-3 whitespace-nowrap rounded-[10px] px-5 py-3.5 text-[13px]"
        >
          <span className="text-foreground/70">{r.home_team}</span>
          <span className="font-semibold text-accent">
            {r.home_score}&ndash;{r.away_score}
          </span>
          <span className="text-foreground/70">{r.away_team}</span>
        </div>
      ))}
    </div>
  );
}

export default function ResultsTicker({ results }: { results: MatchResult[] }) {
  const recent = results.slice(0, 16);
  if (recent.length === 0) return null;

  return (
    <div
      className="w-full overflow-hidden"
      style={{ maskImage: "linear-gradient(90deg, transparent, black 6%, black 94%, transparent)" }}
    >
      <div className="flex w-max gap-3.5" style={{ animation: "wc-marquee 42s linear infinite" }}>
        <TickerRow results={recent} copy={0} />
        <TickerRow results={recent} copy={1} />
      </div>
    </div>
  );
}
