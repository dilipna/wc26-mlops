"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pelePage, signed, type PeleMatch } from "@/lib/pele/data";
import { blend, histogram, METRIC_LABEL, METRICS, pairedComparison, type MetricKey, type Triple } from "@/lib/pele/stats";
import { Card, CardTitle, ChartTooltipBox, Eyebrow, Muted, Segmented, Stat, Verdict } from "./ui";

type Track = "replay" | "live";
type Subset = "all" | "group" | "knockout" | "host";
type Pair = "ours_pele" | "ours_market" | "pele_market" | "blend_ours" | "blend_pele";
type Forecaster = "ours" | "pele" | "market" | "blend";

const PAIRS: Record<Pair, { a: Forecaster; b: Forecaster; label: string; liveOnly?: boolean }> = {
  ours_pele: { a: "ours", b: "pele", label: "Ours vs PELE" },
  ours_market: { a: "ours", b: "market", label: "Ours vs Books", liveOnly: true },
  pele_market: { a: "pele", b: "market", label: "PELE vs Books", liveOnly: true },
  blend_ours: { a: "blend", b: "ours", label: "50/50 blend vs Ours" },
  blend_pele: { a: "blend", b: "pele", label: "50/50 blend vs PELE" },
};

const NAME: Record<Forecaster, string> = { ours: "Ours", pele: "PELE", market: "Books", blend: "Blend" };

function forecastOf(m: PeleMatch, track: Track, who: Forecaster): Triple {
  const src = track === "live" ? m.live! : { ours: m.ours, pele: m.pele, market: null };
  if (who === "blend") return blend(src.ours, src.pele, 0.5);
  if (who === "market") return (src as { market: Triple }).market;
  return src[who];
}

// The Python benchmark's own result for this exact configuration, if it
// computed one -- shown next to the in-browser result as a cross-check.
function pythonReference(track: Track, subset: Subset, pair: Pair, metric: MetricKey) {
  const h = pelePage.headline;
  if (track === "live" && subset === "all") {
    if (pair === "ours_pele") return h.live.ours_vs_pele[metric];
    if (pair === "ours_market") return h.live.ours_vs_market[metric];
    if (pair === "pele_market") return h.live.pele_vs_market[metric];
  }
  if (track === "replay" && pair === "ours_pele" && subset !== "host") return h.replay[subset].ours_vs_pele[metric];
  if (track === "replay" && subset === "all" && pair === "blend_ours") return h.combo_vs_ours[metric];
  if (track === "replay" && subset === "all" && pair === "blend_pele") return h.combo_vs_pele[metric];
  return undefined;
}

export default function StatsLab() {
  const [track, setTrack] = useState<Track>("replay");
  const [subset, setSubset] = useState<Subset>("all");
  const [pair, setPair] = useState<Pair>("ours_pele");
  const [metric, setMetric] = useState<MetricKey>("rps");
  const [nBoot, setNBoot] = useState<"2000" | "10000">("10000");

  const effectivePair: Pair = track === "replay" && PAIRS[pair].liveOnly ? "ours_pele" : pair;
  const effectiveSubset: Subset = track === "live" && (subset === "group" || subset === "host") ? "all" : subset;

  const rows = useMemo(() => {
    const base = track === "live" ? pelePage.matches.filter((m) => m.live) : pelePage.matches;
    return base.filter((m) =>
      effectiveSubset === "all" ? true : effectiveSubset === "group" ? m.stage === "group" : effectiveSubset === "knockout" ? m.stage !== "group" : m.host,
    );
  }, [track, effectiveSubset]);

  const result = useMemo(() => {
    const { a, b } = PAIRS[effectivePair];
    const fn = METRICS[metric];
    const sa = rows.map((m) => fn(forecastOf(m, track, a), m.outcome));
    const sb = rows.map((m) => fn(forecastOf(m, track, b), m.outcome));
    const r = pairedComparison(sa, sb, Number(nBoot), 7);
    return { ...r, meanA: sa.reduce((s, x) => s + x, 0) / sa.length, meanB: sb.reduce((s, x) => s + x, 0) / sb.length };
  }, [rows, effectivePair, metric, nBoot, track]);

  const span = useMemo(() => {
    let m = Math.abs(result.meanDiff);
    for (const arr of [result.bootMeans, result.nullMeans]) for (let i = 0; i < arr.length; i++) m = Math.max(m, Math.abs(arr[i]));
    return m * 1.02 || 0.01;
  }, [result]);
  const bootHist = useMemo(() => histogram(result.bootMeans, 40, -span, span), [result, span]);
  const nullHist = useMemo(() => histogram(result.nullMeans, 40, -span, span), [result, span]);
  const ref = pythonReference(track, effectiveSubset, effectivePair, metric);
  const { a, b } = PAIRS[effectivePair];
  const absM = Math.abs(result.meanDiff);
  const fmt = (v: number) => signed(v, 4);

  return (
    <Card>
      <Eyebrow>Runs in your browser</Eyebrow>
      <CardTitle>Statistics lab: is the gap real, or noise?</CardTitle>
      <Muted className="mb-5 max-w-3xl">
        Pick any comparison. The page scores every match from the raw probabilities, then runs a paired bootstrap ({Number(nBoot).toLocaleString()} resamples) and
        a two-sided sign-flip randomization test on the per-match score differences, live, with a seeded generator so results are reproducible.
      </Muted>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Segmented label="Track" value={track} onChange={setTrack} options={[{ value: "replay", label: "Replay 102" }, { value: "live", label: "Live 21" }]} />
        <Segmented
          label="Matches"
          value={effectiveSubset}
          onChange={setSubset}
          options={[
            { value: "all", label: "All" },
            { value: "group", label: "Group", disabled: track === "live" },
            { value: "knockout", label: "Knockout" },
            { value: "host", label: "Co-host", disabled: track === "live" },
          ]}
        />
        <div className="lg:col-span-2">
          <Segmented
            label="Comparison (A vs B)"
            value={effectivePair}
            onChange={setPair}
            options={(Object.keys(PAIRS) as Pair[]).map((p) => ({ value: p, label: PAIRS[p].label, disabled: track === "replay" && PAIRS[p].liveOnly }))}
          />
        </div>
        <Segmented label="Metric" value={metric} onChange={setMetric} options={(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))} />
      </div>

      <div className="grid grid-cols-2 gap-5 border-y border-foreground/10 py-5 md:grid-cols-5">
        <Stat value={result.n} label="matches" sub={`${NAME[a]} better on ${result.aBetter}, ${NAME[b]} on ${result.bBetter}`} />
        <Stat value={fmt(result.meanDiff)} label={`mean ${METRIC_LABEL[metric]}: ${NAME[a]} − ${NAME[b]}`} sub={`${result.meanA.toFixed(4)} vs ${result.meanB.toFixed(4)} (lower is better)`} />
        <Stat value={`[${signed(result.ci95[0], 3)}, ${signed(result.ci95[1], 3)}]`} label="95% bootstrap CI" sub={result.ci95[0] > 0 || result.ci95[1] < 0 ? "excludes 0" : "includes 0"} />
        <Stat value={result.pValue.toFixed(3)} label="p-value (two-tailed)" sub={<Verdict significant={result.pValue < 0.05}>{result.pValue < 0.05 ? "significant at 5%" : "not significant"}</Verdict>} />
        <Stat
          value={result.matchesFor80Power ? `~${result.matchesFor80Power.toLocaleString()}` : "—"}
          label="matches for 80% power"
          sub={result.matchesFor80Power ? `≈ ${(result.matchesFor80Power / 104).toFixed(1)} World Cups` : "zero observed gap"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-[13px] font-semibold text-foreground">Bootstrap distribution of the mean difference</div>
          <Muted className="mb-2">Resampling matches with replacement. Highlighted bars fall inside the 95% interval; the dashed line is zero (no difference).</Muted>
          <div className="h-[200px] w-full">
            <ResponsiveContainer>
              <BarChart data={bootHist} barCategoryGap={1} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--card-border)" vertical={false} />
                <XAxis dataKey="mid" type="number" domain={[-span, span]} tickFormatter={(v) => Number(v).toFixed(3)} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox title="Bootstrap">
                        {`${(payload[0].payload as { x0: number }).x0.toFixed(4)} to ${(payload[0].payload as { x1: number }).x1.toFixed(4)}: ${(payload[0].payload as { count: number }).count} resamples`}
                      </ChartTooltipBox>
                    ) : null
                  }
                />
                <ReferenceLine x={0} stroke="var(--secondary)" strokeDasharray="4 4" />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {bootHist.map((h) => (
                    <Cell key={h.mid} fill={h.mid >= result.ci95[0] && h.mid <= result.ci95[1] ? "var(--chart-1)" : "rgba(255,255,255,0.18)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1 text-[13px] font-semibold text-foreground">Null distribution (random sign flips)</div>
          <Muted className="mb-2">
            If the two forecasters were interchangeable, each match&apos;s difference is equally likely to be + or −. Highlighted bars are at least as extreme as the
            observed ±{absM.toFixed(4)}; their share is the p-value.
          </Muted>
          <div className="h-[200px] w-full">
            <ResponsiveContainer>
              <BarChart data={nullHist} barCategoryGap={1} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--card-border)" vertical={false} />
                <XAxis dataKey="mid" type="number" domain={[-span, span]} tickFormatter={(v) => Number(v).toFixed(3)} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox title="Null">
                        {`${(payload[0].payload as { x0: number }).x0.toFixed(4)} to ${(payload[0].payload as { x1: number }).x1.toFixed(4)}: ${(payload[0].payload as { count: number }).count} flips`}
                      </ChartTooltipBox>
                    ) : null
                  }
                />
                <ReferenceLine x={result.meanDiff} stroke="var(--foreground)" strokeWidth={2} label={{ value: "observed", fill: "var(--secondary)", fontSize: 10, position: "top" }} />
                <ReferenceLine x={-result.meanDiff} stroke="var(--foreground)" strokeDasharray="3 3" />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {nullHist.map((h) => (
                    <Cell key={h.mid} fill={Math.abs(h.mid) >= absM ? "var(--chart-2)" : "rgba(255,255,255,0.18)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="font-mono mt-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-foreground/45">
        <span>
          {ref
            ? `Python benchmark (scripts/compare_vs_pele.py, Mersenne Twister, seed 7): mean ${signed(ref.mean_diff, 4)}, CI [${signed(ref.ci95[0], 4)}, ${signed(ref.ci95[1], 4)}], p = ${ref.p_value.toFixed(3)}. Means match exactly; CI ends and p differ only by Monte Carlo error.`
            : "The Python benchmark did not pre-compute this exact configuration; the in-browser result is the only one."}
        </span>
        <span className="flex items-center gap-3">
          <Segmented label="Resamples" value={nBoot} onChange={setNBoot} options={[{ value: "2000", label: "2k" }, { value: "10000", label: "10k" }]} />
        </span>
      </div>
    </Card>
  );
}
