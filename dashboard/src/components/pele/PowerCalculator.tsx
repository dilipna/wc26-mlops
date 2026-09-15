"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pelePage } from "@/lib/pele/data";
import { mean, normInv, requiredN, rps } from "@/lib/pele/stats";
import { Card, CardTitle, ChartTooltipBox, Eyebrow, Muted, Segmented, Slider, Stat } from "./ui";

const WORLD_CUP_MATCHES = 104;

export default function PowerCalculator() {
  // SD of the per-match RPS difference (ours - PELE) on the replay track,
  // computed here from the raw probabilities.
  const { sd, observed } = useMemo(() => {
    const d = pelePage.matches.map((m) => rps(m.ours, m.outcome) - rps(m.pele, m.outcome));
    const mu = mean(d);
    return { observed: mu, sd: Math.sqrt(d.reduce((s, x) => s + (x - mu) ** 2, 0) / (d.length - 1)) };
  }, []);

  const [delta, setDelta] = useState(Math.round(Math.abs(observed) * 10000) / 10000);
  const [power, setPower] = useState<"0.8" | "0.9">("0.8");
  const [alpha, setAlpha] = useState<"0.05" | "0.01">("0.05");

  const n = requiredN(sd, delta, Number(alpha), Number(power));
  // Smallest gap one World Cup could detect: solve n = 104 for the gap.
  const detectableInOneCup = ((normInv(1 - Number(alpha) / 2) + normInv(Number(power))) * sd) / Math.sqrt(WORLD_CUP_MATCHES);
  const curve = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const g = 0.002 + i * 0.001;
        return { gap: g, cups: requiredN(sd, g, Number(alpha), Number(power)) / WORLD_CUP_MATCHES };
      }),
    [sd, alpha, power],
  );

  return (
    <Card>
      <Eyebrow>Sample size</Eyebrow>
      <CardTitle>Power calculator: how many World Cups would settle it?</CardTitle>
      <Muted className="mb-5 max-w-3xl">
        Uses the observed standard deviation of the per-match RPS difference (ours − PELE, {pelePage.matches.length} matches, SD ={" "}
        <span className="font-mono text-foreground">{sd.toFixed(4)}</span>) and the normal-approximation sample size for a two-sided paired test: n = ((z₁₋α/₂ +
        z_power) · SD / gap)². Move the gap to ask &ldquo;what if the true difference were bigger?&rdquo;
      </Muted>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <Slider label="True RPS gap to detect" value={delta} min={0.002} max={0.03} step={0.0001} onChange={setDelta} format={(v) => v.toFixed(4)} />
          <div className="font-mono mt-1 text-[10px] text-foreground/40">observed gap: {Math.abs(observed).toFixed(4)}</div>
        </div>
        <Segmented label="Power" value={power} onChange={setPower} options={[{ value: "0.8", label: "80%" }, { value: "0.9", label: "90%" }]} />
        <Segmented label="α (two-sided)" value={alpha} onChange={setAlpha} options={[{ value: "0.05", label: "0.05" }, { value: "0.01", label: "0.01" }]} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-1">
          <Stat value={n.toLocaleString()} label="matches with both forecasts needed" />
          <Stat value={(n / WORLD_CUP_MATCHES).toFixed(1)} label={`World Cups (${WORLD_CUP_MATCHES} matches each)`} sub={`we have ${pelePage.matches.length} matches`} />
        </div>
        <div className="min-w-0">
          <div className="h-[220px] w-full">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
                <CartesianGrid stroke="var(--card-border)" vertical={false} />
                <XAxis dataKey="gap" type="number" domain={[0.002, 0.031]} tickFormatter={(v) => Number(v).toFixed(3)} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis scale="log" domain={[0.1, "auto"]} allowDataOverflow tickFormatter={(v) => `${v}`} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  cursor={{ stroke: "var(--muted)" }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltipBox title={`gap ${(payload[0].payload as { gap: number }).gap.toFixed(3)}`}>
                        {(payload[0].payload as { cups: number }).cups.toFixed(1)} World Cups
                      </ChartTooltipBox>
                    ) : null
                  }
                />
                <ReferenceLine y={1} stroke="var(--secondary)" strokeDasharray="4 4" label={{ value: "one World Cup", fill: "var(--secondary)", fontSize: 10, position: "insideTopRight" }} />
                <Line dataKey="cups" stroke="var(--chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} />
                <ReferenceDot x={delta} y={n / WORLD_CUP_MATCHES} r={5} fill="var(--accent)" stroke="var(--card)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Muted>
            {`World Cups needed (log scale) against the true gap. At ${Math.round(Number(power) * 100)}% power and α = ${alpha}, one ${WORLD_CUP_MATCHES}-match tournament can only detect a gap of about ${detectableInOneCup.toFixed(4)} RPS or more, ${(detectableInOneCup / Math.abs(observed)).toFixed(1)}× the gap we observed.`}
          </Muted>
        </div>
      </div>
    </Card>
  );
}
