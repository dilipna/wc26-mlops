"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FORECASTER, pelePage } from "@/lib/pele/data";
import { blend, fitGrid, METRIC_LABEL, reliability, temper, type Bin, type MetricKey, type Triple } from "@/lib/pele/stats";
import { Card, CardTitle, ChartTooltipBox, Dot, Eyebrow, Muted, Segmented, Slider, Stat } from "./ui";

type Mode = "blend" | "temperature";

const W_GRID = Array.from({ length: 21 }, (_, i) => Math.round(i * 5) / 100); // 0.00 .. 1.00
const T_GRID = Array.from({ length: 21 }, (_, i) => Math.round((0.5 + i * 0.05) * 100) / 100); // 0.50 .. 1.50

function ReliabilityChart({ series, nBins }: { series: { key: string; name: string; color: string; bins: Bin[] }[]; nBins: number }) {
  const rows = Array.from({ length: nBins }, (_, i) => {
    const lo = i / nBins;
    const row: Record<string, number | string | null | boolean> = { bin: `${Math.round(lo * 100)}–${Math.round((lo + 1 / nBins) * 100)}%`, ideal: (lo + 0.5 / nBins) * 100 };
    for (const s of series) {
      const b = s.bins.find((x) => Math.abs(x.lo - lo) < 1e-9);
      row[s.key] = b ? b.observed * 100 : null;
      row[`${s.key}_pred`] = b ? b.meanPredicted * 100 : null;
      row[`${s.key}_n`] = b ? b.n : 0;
      row[`${s.key}_low`] = b ? b.lowConfidence : false;
    }
    return row;
  });

  const dot = (key: string, color: string) =>
    function DotShape(props: { cx?: number; cy?: number; payload?: Record<string, unknown> }) {
      const { cx, cy, payload } = props;
      if (cx == null || cy == null || !payload || payload[key] == null) return <g />;
      const low = Boolean(payload[`${key}_low`]);
      return <circle cx={cx} cy={cy} r={4} strokeWidth={2} stroke={low ? color : "var(--card)"} fill={low ? "var(--card)" : color} />;
    };

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="var(--card-border)" vertical={false} />
          <XAxis dataKey="bin" tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} interval={nBins > 5 ? 1 : 0} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--muted)" }}
            content={({ active, label, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, unknown>;
              return (
                <ChartTooltipBox title={`Predicted ${label}`}>
                  {series.map((s) => (
                    <div key={s.key}>
                      <Dot color={s.color} />{" "}
                      {row[s.key] == null
                        ? `${s.name}: no probabilities in this bin`
                        : `${s.name}: said ${(row[`${s.key}_pred`] as number).toFixed(0)}%, happened ${(row[s.key] as number).toFixed(0)}% (n=${row[`${s.key}_n`]}${row[`${s.key}_low`] ? ", low confidence" : ""})`}
                    </div>
                  ))}
                </ChartTooltipBox>
              );
            }}
          />
          <Line dataKey="ideal" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} name="Perfect calibration" />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2} connectNulls dot={dot(s.key, s.color)} isAnimationActive={false} name={s.name} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ModelLab() {
  const matches = pelePage.matches;
  const outcomes = useMemo(() => matches.map((m) => m.outcome), [matches]);
  const [mode, setMode] = useState<Mode>("blend");
  const [metric, setMetric] = useState<MetricKey>("rps");
  const [w, setW] = useState(0.5);
  const [T, setT] = useState(1);
  const [nBins, setNBins] = useState<"5" | "10">("10");

  const grid = mode === "blend" ? W_GRID : T_GRID;
  const identity = mode === "blend" ? 1 : 1; // w = 1 is "ours alone"; T = 1 is "ours unchanged"
  const transform = useMemo(
    () => (i: number, v: number): Triple => (mode === "blend" ? blend(matches[i].ours, matches[i].pele, v) : temper(matches[i].ours, v)),
    [mode, matches],
  );

  const fit = useMemo(() => fitGrid(grid, identity, transform, outcomes, metric), [grid, identity, transform, outcomes, metric]);
  const peleScore = useMemo(() => {
    const f = fitGrid([0], 0, (i) => matches[i].pele, outcomes, metric);
    return f.inSample[0];
  }, [matches, outcomes, metric]);

  const current = mode === "blend" ? w : T;
  const currentIdx = grid.findIndex((g) => Math.abs(g - current) < 1e-9);
  const currentScore = fit.inSample[currentIdx];

  const bins = Number(nBins);
  const relOurs = useMemo(() => reliability(matches.map((m) => m.ours), outcomes, bins), [matches, outcomes, bins]);
  const relPele = useMemo(() => reliability(matches.map((m) => m.pele), outcomes, bins), [matches, outcomes, bins]);
  const relAdj = useMemo(() => reliability(matches.map((_, i) => transform(i, current)), outcomes, bins), [matches, outcomes, bins, transform, current]);

  const curve = grid.map((g, k) => ({ x: g, score: fit.inSample[k] }));
  const chosenCounts = grid.map((g) => ({ x: g, n: fit.loo.chosen.filter((c) => Math.abs(c - g) < 1e-9).length })).filter((c) => c.n > 0);
  const xLabel = mode === "blend" ? "weight on our model (w)" : "temperature (T)";
  const fmtX = (v: number) => (mode === "blend" ? v.toFixed(2) : v.toFixed(2));

  return (
    <Card>
      <Eyebrow>Machine learning on the forecasts themselves</Eyebrow>
      <CardTitle>Model lab: can we fix our model with PELE, honestly?</CardTitle>
      <Muted className="mb-5 max-w-3xl">
        Two standard post-processing tools, fit live on the 102 replay matches. <strong className="text-foreground/80">Forecast blending</strong> mixes our
        probabilities with PELE&apos;s (w·ours + (1−w)·PELE). <strong className="text-foreground/80">Temperature scaling</strong> sharpens or flattens ours
        (pᵢ^(1/T), renormalized). Tuning a knob on the same matches you score is optimistic, so every fit is also scored with{" "}
        <strong className="text-foreground/80">leave-one-out cross-validation</strong>: for each match, the knob is chosen on the other 101 and applied to the one
        held out.
      </Muted>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Segmented label="Tool" value={mode} onChange={setMode} options={[{ value: "blend", label: "Blend with PELE" }, { value: "temperature", label: "Temperature" }]} />
        <Segmented label="Fit & score on" value={metric} onChange={setMetric} options={(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))} />
        <div className="lg:col-span-2">
          {mode === "blend" ? (
            <Slider label="w · weight on our model" value={w} min={0} max={1} step={0.05} onChange={setW} format={(v) => `${v.toFixed(2)} (${Math.round(v * 100)}% ours / ${Math.round((1 - v) * 100)}% PELE)`} />
          ) : (
            <Slider label="T · temperature" value={T} min={0.5} max={1.5} step={0.05} onChange={setT} format={(v) => `${v.toFixed(2)} ${v < 1 ? "(sharper)" : v > 1 ? "(flatter)" : "(unchanged)"}`} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 border-y border-foreground/10 py-5 md:grid-cols-5">
        <Stat value={fit.identityScore.toFixed(4)} label={`our model alone (${METRIC_LABEL[metric]})`} />
        <Stat value={peleScore.toFixed(4)} label="PELE alone" />
        <Stat value={currentScore !== undefined ? currentScore.toFixed(4) : "—"} label={`at ${mode === "blend" ? "w" : "T"} = ${fmtX(current)}`} sub="in-sample" />
        <Stat value={fit.bestInSample.score.toFixed(4)} label={`best in-sample (${mode === "blend" ? "w" : "T"} = ${fmtX(fit.bestInSample.value)})`} sub="optimistic" />
        <Stat
          value={fit.loo.score.toFixed(4)}
          label="leave-one-out CV score"
          sub={`${fit.loo.score < fit.identityScore ? "beats" : "does not beat"} ours alone; ${fit.loo.score < peleScore ? "beats" : "does not beat"} PELE`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-[13px] font-semibold text-foreground">Mean {METRIC_LABEL[metric]} across the {xLabel}</div>
          <Muted className="mb-2">
            Lower is better. Solid line: your setting. Dashed: in-sample optimum. The LOO folds chose{" "}
            {chosenCounts.map((c) => `${fmtX(c.x)} (${c.n}×)`).join(", ")}, so the optimum is {chosenCounts.length === 1 ? "stable" : "not perfectly stable"} across folds.
          </Muted>
          <div className="h-[240px] w-full">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 8, right: 12, bottom: 4, left: -4 }}>
                <CartesianGrid stroke="var(--card-border)" vertical={false} />
                <XAxis dataKey="x" type="number" domain={[grid[0], grid[grid.length - 1]]} tickFormatter={fmtX} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toFixed(3)} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                <Tooltip
                  cursor={{ stroke: "var(--muted)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox title={`${mode === "blend" ? "w" : "T"} = ${fmtX((payload[0].payload as { x: number }).x)}`}>
                        mean {METRIC_LABEL[metric]} {(payload[0].payload as { score: number }).score.toFixed(4)}
                      </ChartTooltipBox>
                    ) : null
                  }
                />
                <ReferenceLine x={fit.bestInSample.value} stroke="var(--secondary)" strokeDasharray="4 4" />
                <ReferenceLine x={current} stroke="var(--foreground)" strokeWidth={1.5} />
                <Line dataKey="score" stroke={FORECASTER.adjusted.color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: FORECASTER.adjusted.color }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-foreground">Reliability, recomputed for your setting</span>
            <Segmented label="Bins" value={nBins} onChange={setNBins} options={[{ value: "5", label: "5" }, { value: "10", label: "10" }]} />
          </div>
          <Muted className="mb-2">
            All 306 outcome probabilities (3 per match; n counts probabilities, not matches). Hollow points: n &lt; 10, low confidence. Hover for n.
          </Muted>
          <ReliabilityChart
            nBins={bins}
            series={[
              { key: "ours", name: FORECASTER.ours.name, color: FORECASTER.ours.color, bins: relOurs.bins },
              { key: "pele", name: FORECASTER.pele.name, color: FORECASTER.pele.color, bins: relPele.bins },
              { key: "adj", name: `Adjusted (${mode === "blend" ? "w" : "T"} = ${fmtX(current)})`, color: FORECASTER.adjusted.color, bins: relAdj.bins },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-foreground/60">
            <span>
              <Dot color={FORECASTER.ours.color} /> Ours · ECE {relOurs.ece.toFixed(3)}
            </span>
            <span>
              <Dot color={FORECASTER.pele.color} /> PELE · ECE {relPele.ece.toFixed(3)}
            </span>
            <span>
              <Dot color={FORECASTER.adjusted.color} /> Adjusted · ECE {relAdj.ece.toFixed(3)}
            </span>
            <span>
              <Dot color="var(--muted)" dashed /> Perfect calibration
            </span>
          </div>
        </div>
      </div>

      <Muted className="mt-5 max-w-4xl">
        Read this honestly: LOO removes the optimism of picking the knob on the scored match, but all 102 matches come from one tournament, so the folds are not
        independent. Treat any improvement here as a hypothesis to test on another tournament, not a result. ECE uses equal-width bins and moves with the bin
        count; that is why the bin selector is exposed.
      </Muted>
    </Card>
  );
}
