"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { FORECASTER, pelePage, signed } from "@/lib/pele/data";
import { mean, rps } from "@/lib/pele/stats";
import { Card, CardTitle, Eyebrow, Muted, Stat, Verdict } from "./ui";

type Key = keyof typeof FORECASTER;

// Horizontal RPS bars on a shared zero-based scale. Lower is better; the
// best bar is called out in text, not by color alone.
function RpsBars({ entries }: { entries: { key: Key; rps: number }[] }) {
  const max = Math.max(...entries.map((e) => e.rps));
  const best = Math.min(...entries.map((e) => e.rps));
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e, i) => (
        <div key={e.key} className="grid grid-cols-[minmax(0,120px)_1fr_auto] items-center gap-3" title={`${FORECASTER[e.key].name}: RPS ${e.rps.toFixed(4)}`}>
          <span className="truncate text-[13px] text-foreground/75">{FORECASTER[e.key].name}</span>
          <div className="h-[10px] overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(e.rps / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: FORECASTER[e.key].color }}
            />
          </div>
          <span className="font-mono text-sm text-foreground">
            {e.rps.toFixed(4)}
            {e.rps === best && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-foreground/50">best</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function PythonTest({ label, t }: { label: string; t: { mean_diff: number; ci95: [number, number]; p_value: number; n: number } }) {
  return (
    <div className="font-mono mt-4 space-y-1 text-[11px] leading-relaxed text-foreground/55">
      <div>
        {label}: ΔRPS {signed(t.mean_diff, 4)} · 95% CI [{signed(t.ci95[0], 4)}, {signed(t.ci95[1], 4)}] · p = {t.p_value.toFixed(2)}
      </div>
      <Verdict significant={t.p_value < 0.05}>{t.p_value < 0.05 ? "significant at 5%" : `not distinguishable at n = ${t.n}`}</Verdict>
    </div>
  );
}

export default function Overview() {
  const { matches, headline } = pelePage;

  // Recomputed in the browser from per-match probabilities -- the same numbers
  // the Python benchmark reports, shown as a live consistency check.
  const scores = useMemo(() => {
    const live = matches.filter((m) => m.live);
    return {
      liveN: live.length,
      live: {
        ours: mean(live.map((m) => rps(m.live!.ours, m.outcome))),
        pele: mean(live.map((m) => rps(m.live!.pele, m.outcome))),
        market: mean(live.map((m) => rps(m.live!.market, m.outcome))),
      },
      replayN: matches.length,
      replay: {
        ours: mean(matches.map((m) => rps(m.ours, m.outcome))),
        pele: mean(matches.map((m) => rps(m.pele, m.outcome))),
      },
    };
  }, [matches]);

  const power = headline.replay.all.ours_vs_pele.rps.matches_for_80pct_power ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat value={pelePage.sources.pele_data.charts["3bTOr"]?.versions ?? "—"} label="PELE forecast-table versions recovered" sub="each with its publish timestamp" />
          <Stat value={scores.replayN} label="matches scored head-to-head" sub={`${scores.liveN} verified pre-kickoff by both`} />
          <Stat value={`~${power.toLocaleString()}`} label="matches needed to separate the models" sub={`≈ ${Math.round(power / 104)} World Cups at 80% power`} />
          <Stat value={pelePage.leak_cases} label="post-kickoff PELE forecast caught" sub="by audit, then excluded" />
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <Eyebrow>Live · zero hindsight</Eyebrow>
          <CardTitle>{scores.liveN} knockout matches</CardTitle>
          <Muted className="mb-5">
            Every forecast public before kickoff: ours as a git commit, PELE as a timestamped Datawrapper version, bookmakers from the same snapshot as ours.
            Ranked Probability Score, lower is better.
          </Muted>
          <RpsBars
            entries={[
              { key: "ours", rps: scores.live.ours },
              { key: "pele", rps: scores.live.pele },
              { key: "market", rps: scores.live.market },
            ]}
          />
          <PythonTest label="Ours − PELE" t={headline.live.ours_vs_pele.rps} />
        </Card>

        <Card>
          <Eyebrow>Full tournament · leakage-safe replay</Eyebrow>
          <CardTitle>{scores.replayN} matches, groups to final</CardTitle>
          <Muted className="mb-5">
            PELE&apos;s real pre-kickoff numbers vs our model re-run with training data frozen at the opening match. On the live matches the replay is within{" "}
            {(headline.live.replay_fidelity_mean_abs_diff * 100).toFixed(1)} probability points of what we actually published.
          </Muted>
          <RpsBars
            entries={[
              { key: "ours", rps: scores.replay.ours },
              { key: "pele", rps: scores.replay.pele },
            ]}
          />
          <div className="font-mono mt-4 grid grid-cols-1 gap-1 text-[11px] text-foreground/50 sm:grid-cols-2">
            <span>
              Group (n={headline.replay.group.n}): {headline.replay.group.metrics.replay.rps.toFixed(3)} vs {headline.replay.group.metrics.pele.rps.toFixed(3)}, p ={" "}
              {headline.replay.group.ours_vs_pele.rps.p_value.toFixed(2)}
            </span>
            <span>
              Knockout (n={headline.replay.knockout.n}): {headline.replay.knockout.metrics.replay.rps.toFixed(3)} vs{" "}
              {headline.replay.knockout.metrics.pele.rps.toFixed(3)}, p = {headline.replay.knockout.ours_vs_pele.rps.p_value.toFixed(2)}
            </span>
          </div>
          <PythonTest label="Ours − PELE" t={headline.replay.all.ours_vs_pele.rps} />
        </Card>
      </div>
    </div>
  );
}
