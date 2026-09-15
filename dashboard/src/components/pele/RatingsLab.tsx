"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { FORECASTER, pelePage, STAGE_LABEL, type TeamRating } from "@/lib/pele/data";
import { spearman } from "@/lib/pele/stats";
import { Card, CardTitle, ChartTooltipBox, Dot, Eyebrow, Muted } from "./ui";

// Competition rank: 1 + number of teams rated strictly higher (ties share a rank).
function ranks(values: number[]): number[] {
  return values.map((v) => 1 + values.filter((x) => x > v).length);
}

export default function RatingsLab() {
  const teams = pelePage.ratings;
  const [team, setTeam] = useState("Norway");

  const enriched = useMemo(() => {
    const pr = ranks(teams.map((t) => t.pele));
    const er = ranks(teams.map((t) => t.elo));
    return teams.map((t, i) => ({ ...t, peleRank: pr[i], eloRank: er[i], gap: pr[i] - er[i] }));
  }, [teams]);
  const rho = useMemo(() => spearman(teams.map((t) => t.pele), teams.map((t) => t.elo)), [teams]);
  const current = enriched.find((t) => t.team === team) ?? enriched[0];
  const disagreements = [...enriched].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 8);

  const path = useMemo(() => {
    const toMs = (d: string) => new Date(`${d}T12:00:00Z`).getTime();
    const pts = new Map<number, { t: number; ours?: number; pele?: number }>();
    for (const p of current.elo_path) pts.set(toMs(p.t), { ...(pts.get(toMs(p.t)) ?? { t: toMs(p.t) }), ours: p.d });
    for (const p of current.pele_path) pts.set(toMs(p.t), { ...(pts.get(toMs(p.t)) ?? { t: toMs(p.t) }), pele: p.d });
    return [...pts.values()].sort((a, b) => a.t - b.t);
  }, [current]);

  const fmtDay = (ms: number) => new Date(ms).toISOString().slice(5, 10);

  return (
    <Card>
      <Eyebrow>Two rating systems, 48 teams</Eyebrow>
      <CardTitle>Ratings: where PELE and our Elo disagree</CardTitle>
      <Muted className="mb-5 max-w-3xl">
        Pre-tournament strength of every team: PELE&apos;s last published rating before the opening match vs our Elo on the same day. Spearman rank correlation
        (tie-averaged) is <span className="font-mono text-foreground">{rho.toFixed(3)}</span>, so they mostly agree. The two scales are not interchangeable point
        for point: our Elo spreads teams wider. Compare ranks, and click a team to see how each system moved during the tournament.
      </Muted>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 text-[13px] font-semibold text-foreground">PELE rating vs our Elo (one dot per team)</div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 8, right: 12, bottom: 16, left: -4 }}>
                <CartesianGrid stroke="var(--card-border)" />
                <XAxis
                  type="number"
                  dataKey="elo"
                  name="Our Elo"
                  domain={["dataMin - 20", "dataMax + 20"]}
                  tick={{ fill: "var(--secondary)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "our Elo", position: "insideBottom", offset: -8, fill: "var(--secondary)", fontSize: 10 }}
                />
                <YAxis
                  type="number"
                  dataKey="pele"
                  name="PELE"
                  domain={["dataMin - 20", "dataMax + 20"]}
                  tick={{ fill: "var(--secondary)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "var(--muted)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const t = payload[0].payload as (typeof enriched)[number];
                    return (
                      <ChartTooltipBox title={t.team}>
                        <div>PELE {t.pele.toFixed(0)} (#{t.peleRank})</div>
                        <div>Our Elo {t.elo.toFixed(0)} (#{t.eloRank})</div>
                        <div>Reached: {STAGE_LABEL[t.finish]}</div>
                        <div className="mt-1 text-foreground/50">click to trace</div>
                      </ChartTooltipBox>
                    );
                  }}
                />
                <Scatter
                  data={enriched}
                  isAnimationActive={false}
                  onClick={(d) => {
                    const p = (d as unknown as { payload?: TeamRating }).payload;
                    if (p?.team) setTeam(p.team);
                  }}
                  shape={(props: unknown) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: TeamRating };
                    const active = payload.team === current.team;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={active ? 7 : 4.5}
                        fill={active ? "var(--accent)" : "rgba(255,255,255,0.55)"}
                        stroke="var(--card)"
                        strokeWidth={2}
                        style={{ cursor: "pointer" }}
                      />
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <label className="mt-2 flex items-center gap-2 text-[12px] text-foreground/60">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">Team</span>
            <select
              value={current.team}
              onChange={(e) => setTeam(e.target.value)}
              className="rounded-md border border-foreground/15 bg-[var(--card)] px-2 py-1 text-[13px] text-foreground focus:border-accent/60 focus:outline-none"
            >
              {[...teams].sort((a, b) => a.team.localeCompare(b.team)).map((t) => (
                <option key={t.team} value={t.team}>
                  {t.team}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="min-w-0">
          <div className="mb-1 text-[13px] font-semibold text-foreground">
            {current.team}: rating change since the opening match
          </div>
          <Muted className="mb-2">
            PELE {current.pele.toFixed(0)} (#{current.peleRank}) · our Elo {current.elo.toFixed(0)} (#{current.eloRank}) · reached {STAGE_LABEL[current.finish]}.
            Both series are plotted as change from their own starting value, so one axis is fair to both.
          </Muted>
          <div className="h-[260px] w-full">
            <ResponsiveContainer>
              <LineChart data={path} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
                <CartesianGrid stroke="var(--card-border)" vertical={false} />
                <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={fmtDay} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  cursor={{ stroke: "var(--muted)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const r = payload[0].payload as (typeof path)[number];
                    return (
                      <ChartTooltipBox title={new Date(r.t).toISOString().slice(0, 10)}>
                        {r.ours !== undefined && (
                          <div>
                            <Dot color={FORECASTER.ours.color} /> Our Elo {r.ours > 0 ? "+" : ""}
                            {r.ours.toFixed(1)}
                          </div>
                        )}
                        {r.pele !== undefined && (
                          <div>
                            <Dot color={FORECASTER.pele.color} /> PELE {r.pele > 0 ? "+" : ""}
                            {r.pele.toFixed(1)}
                          </div>
                        )}
                      </ChartTooltipBox>
                    );
                  }}
                />
                <Line type="stepAfter" dataKey="ours" stroke={FORECASTER.ours.color} strokeWidth={2} connectNulls dot={{ r: 3, strokeWidth: 0, fill: FORECASTER.ours.color }} isAnimationActive={false} name="Our Elo" />
                <Line type="stepAfter" dataKey="pele" stroke={FORECASTER.pele.color} strokeWidth={2} connectNulls dot={false} isAnimationActive={false} name="PELE" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-foreground/60">
            <span>
              <Dot color={FORECASTER.ours.color} /> Our Elo (updates after each match)
            </span>
            <span>
              <Dot color={FORECASTER.pele.color} /> PELE (each published ratings version)
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40">
            <tr className="border-b border-foreground/10">
              <th className="py-2 pr-3 font-normal">Largest rank disagreements</th>
              <th className="py-2 pr-3 text-right font-normal">PELE</th>
              <th className="py-2 pr-3 text-right font-normal">PELE #</th>
              <th className="py-2 pr-3 text-right font-normal">Our Elo</th>
              <th className="py-2 pr-3 text-right font-normal">Our #</th>
              <th className="py-2 font-normal">Reached</th>
            </tr>
          </thead>
          <tbody>
            {disagreements.map((t) => (
              <tr
                key={t.team}
                onClick={() => setTeam(t.team)}
                className={`cursor-pointer border-b border-foreground/5 transition-colors hover:bg-foreground/[0.03] ${t.team === current.team ? "text-foreground" : "text-foreground/75"}`}
              >
                <td className="py-2 pr-3">{t.team}</td>
                <td className="font-mono py-2 pr-3 text-right">{t.pele.toFixed(0)}</td>
                <td className="font-mono py-2 pr-3 text-right">{t.peleRank}</td>
                <td className="font-mono py-2 pr-3 text-right">{t.elo.toFixed(0)}</td>
                <td className="font-mono py-2 pr-3 text-right">{t.eloRank}</td>
                <td className="font-mono py-2 text-foreground/60">{STAGE_LABEL[t.finish]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
