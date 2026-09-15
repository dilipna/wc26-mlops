"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GITHUB_URL } from "@/lib/site";
import {
  DATAWRAPPER_VERSION_URL,
  FORECASTER,
  fmtUtc,
  OUTCOME_COLOR,
  OUTCOME_LABEL,
  pelePage,
  signed,
  STAGE_LABEL,
  type PeleMatch,
} from "@/lib/pele/data";
import { rps, type Triple } from "@/lib/pele/stats";
import { Card, CardTitle, ChartTooltipBox, Dot, Eyebrow, Muted, Segmented } from "./ui";

type Filter = "all" | "group" | "knockout" | "live" | "leak";
type Sort = "date" | "disagree" | "upset" | "ours_better" | "pele_better";

// Total-variation distance between two W/D/L forecasts, in probability points.
const disagreement = (a: Triple, b: Triple) => (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 2;
// How surprising the result was to PELE (probability it gave the outcome).
const surprise = (m: PeleMatch) => 1 - m.pele[m.outcome];

function WdlBar({ label, color, p, outcome, score }: { label: string; color: string; p: Triple; outcome: number; score: number }) {
  return (
    <div className="grid grid-cols-[92px_1fr_62px] items-center gap-3 sm:grid-cols-[110px_1fr_70px]">
      <span className="flex items-center gap-2 truncate text-[13px] text-foreground/80">
        <Dot color={color} /> {label}
      </span>
      <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-md" role="img" aria-label={`${label}: home ${Math.round(p[0] * 100)}%, draw ${Math.round(p[1] * 100)}%, away ${Math.round(p[2] * 100)}%`}>
        {p.map((v, i) => (
          <div
            key={i}
            className={`font-mono flex items-center justify-center text-[10px] ${i === outcome ? "text-background font-semibold" : "text-background/80"}`}
            style={{ width: `${v * 100}%`, background: OUTCOME_COLOR[i], opacity: i === outcome ? 1 : 0.45, minWidth: v > 0 ? 2 : 0 }}
            title={`${OUTCOME_LABEL[i]}: ${(v * 100).toFixed(1)}%${i === outcome ? " (happened)" : ""}`}
          >
            {v >= 0.12 ? `${Math.round(v * 100)}%` : ""}
          </div>
        ))}
      </div>
      <span className="font-mono text-right text-[12px] text-foreground/70">{score.toFixed(3)}</span>
    </div>
  );
}

function Trajectory({ m }: { m: PeleMatch }) {
  const h = m.history;
  const deadline = new Date(h.deadline).getTime();
  const data = h.versions.map((v) => ({
    t: new Date(v.t).getTime(),
    v: v.v,
    home: v.p[0] * 100,
    draw: v.p[1] * 100,
    away: v.p[2] * 100,
    after: new Date(v.t).getTime() >= deadline,
  }));
  const minT = data.length ? data[0].t : deadline;
  const maxT = Math.max(data.length ? data[data.length - 1].t : deadline, deadline);
  const selected = h.versions.find((v) => v.v === h.selected_version);
  const oldPick = h.versions.find((v) => v.v === h.label_rule_version);
  const fmtDay = (ms: number) => new Date(ms).toISOString().slice(5, 10);

  return (
    <div className="min-w-0">
      <div className="mb-1 text-[13px] font-semibold text-foreground">PELE&apos;s forecast for this fixture, version by version</div>
      <Muted className="mb-2">
        {h.versions.length} published version{h.versions.length === 1 ? "" : "s"} listed this match. Vertical line: the deadline used (
        {h.deadline_rule === "kickoff" ? "exact kickoff" : "15:00 UTC on the local match date, earlier than any 2026 kickoff"}). Only versions before it can
        count.
      </Muted>
      <div className="h-[220px] w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
            <CartesianGrid stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={[minT, maxT]} tickFormatter={fmtDay} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "var(--secondary)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: "var(--muted)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof data)[number];
                return (
                  <ChartTooltipBox title={`v${r.v} · ${fmtUtc(new Date(r.t).toISOString())}`}>
                    <div>
                      <Dot color={OUTCOME_COLOR[0]} /> {m.home} win {r.home.toFixed(1)}%
                    </div>
                    <div>
                      <Dot color={OUTCOME_COLOR[1]} dashed /> Draw {r.draw.toFixed(1)}%
                    </div>
                    <div>
                      <Dot color={OUTCOME_COLOR[2]} /> {m.away} win {r.away.toFixed(1)}%
                    </div>
                    <div className="mt-1 text-foreground/50">
                      {r.v === h.selected_version ? "← version used in the benchmark" : r.after ? "published after the deadline: excluded" : "earlier pre-deadline version"}
                    </div>
                  </ChartTooltipBox>
                );
              }}
            />
            <ReferenceLine x={deadline} stroke="var(--foreground)" strokeWidth={1.5} label={{ value: "deadline", fill: "var(--secondary)", fontSize: 10, position: "insideTopRight" }} />
            {selected && <ReferenceLine x={new Date(selected.t).getTime()} stroke="var(--accent)" strokeDasharray="3 3" />}
            <Line dataKey="home" stroke={OUTCOME_COLOR[0]} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: OUTCOME_COLOR[0] }} isAnimationActive={false} />
            <Line dataKey="draw" stroke={OUTCOME_COLOR[1]} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line dataKey="away" stroke={OUTCOME_COLOR[2]} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: OUTCOME_COLOR[2] }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-foreground/60">
        <span>
          <Dot color={OUTCOME_COLOR[0]} /> {m.home} win
        </span>
        <span>
          <Dot color={OUTCOME_COLOR[1]} dashed /> Draw
        </span>
        <span>
          <Dot color={OUTCOME_COLOR[2]} /> {m.away} win
        </span>
        <span>
          <Dot color="var(--accent)" dashed /> version used
        </span>
      </div>
      {h.label_rule_leak && oldPick && selected && (
        <div className="mt-3 rounded-lg border border-accent/40 p-3 text-[12px] leading-relaxed text-foreground/75">
          <span className="font-semibold text-foreground">This is the leak the audit caught.</span> PELE dates matches in US Eastern time, and this late Pacific
          kickoff carries the next day&apos;s label ({h.label_date}). The original rule (15:00 UTC on PELE&apos;s label) picked v{oldPick.v}, published{" "}
          {fmtUtc(oldPick.t)}, after the match had been played. The fixed rule anchors on the earlier local date and uses v{selected.v} ({fmtUtc(selected.t)}).
        </div>
      )}
    </div>
  );
}

export default function MatchExplorer() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("disagree");
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string>("");

  const keyOf = (m: PeleMatch) => `${m.date}|${m.home}|${m.away}`;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = pelePage.matches.filter((m) => {
      if (filter === "group" && m.stage !== "group") return false;
      if (filter === "knockout" && m.stage === "group") return false;
      if (filter === "live" && !m.live) return false;
      if (filter === "leak" && !m.history.label_rule_leak) return false;
      return !q || m.home.toLowerCase().includes(q) || m.away.toLowerCase().includes(q);
    });
    const d = (m: PeleMatch) => rps(m.ours, m.outcome) - rps(m.pele, m.outcome);
    const by: Record<Sort, (a: PeleMatch, b: PeleMatch) => number> = {
      date: (a, b) => a.date.localeCompare(b.date),
      disagree: (a, b) => disagreement(b.ours, b.pele) - disagreement(a.ours, a.pele),
      upset: (a, b) => surprise(b) - surprise(a),
      ours_better: (a, b) => d(a) - d(b),
      pele_better: (a, b) => d(b) - d(a),
    };
    return [...rows].sort(by[sort]);
  }, [filter, sort, query]);

  const selected = list.find((m) => keyOf(m) === selectedKey) ?? list[0];

  return (
    <Card>
      <Eyebrow>Every match, with receipts</Eyebrow>
      <CardTitle>Match explorer</CardTitle>
      <Muted className="mb-5 max-w-3xl">
        Pick a match to see all three forecasts against what happened, the per-match score, and the provenance of each number: PELE&apos;s exact Datawrapper version
        (open the CSV yourself) and, for live matches, the git commit that published our forecast before kickoff.
      </Muted>

      <div className="mb-4 grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap gap-4">
          <Segmented
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All 102" },
              { value: "group", label: "Group" },
              { value: "knockout", label: "Knockout" },
              { value: "live", label: "Live-verified" },
              { value: "leak", label: "Leak case" },
            ]}
          />
          <Segmented
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: "disagree", label: "Biggest disagreement" },
              { value: "upset", label: "Biggest upset" },
              { value: "ours_better", label: "We beat PELE most" },
              { value: "pele_better", label: "PELE beat us most" },
              { value: "date", label: "Date" },
            ]}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">Search team</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Norway"
            className="rounded-md border border-foreground/15 bg-transparent px-3 py-1.5 text-[13px] text-foreground placeholder:text-foreground/30 focus:border-accent/60 focus:outline-none"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <div className="max-h-[520px] min-w-0 overflow-y-auto rounded-xl border border-foreground/10" role="listbox" aria-label="Matches">
          {list.length === 0 && <div className="p-4 text-[13px] text-foreground/50">No matches for this filter.</div>}
          {list.map((m) => {
            const active = selected && keyOf(m) === keyOf(selected);
            const diff = rps(m.ours, m.outcome) - rps(m.pele, m.outcome);
            return (
              <button
                key={keyOf(m)}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setSelectedKey(keyOf(m))}
                className={`flex w-full items-center justify-between gap-3 border-b border-foreground/5 px-3 py-2.5 text-left transition-colors ${
                  active ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-foreground">
                    {m.home} <span className="font-mono text-foreground/60">{m.score}</span> {m.away}
                  </span>
                  <span className="font-mono block text-[10px] uppercase tracking-[0.08em] text-foreground/40">
                    {m.date} · {m.stage === "group" ? "Group" : m.stage}
                    {m.live ? " · live" : ""}
                    {m.history.label_rule_leak ? " · leak case" : ""}
                  </span>
                </span>
                <span className="font-mono shrink-0 text-[11px] text-foreground/60" title="Our RPS minus PELE's on this match (negative = we did better)">
                  {signed(diff, 3)}
                </span>
              </button>
            );
          })}
        </div>

        {selected && (
          <div className="min-w-0 space-y-5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">
                {STAGE_LABEL[selected.stage]} · {selected.date}
                {selected.host ? " · co-host match" : ""}
              </div>
              <div className="font-display mt-1 text-2xl font-extrabold text-foreground">
                {selected.home} <span className="font-mono text-accent">{selected.score}</span> {selected.away}
              </div>
              <div className="mt-1 text-[12px] text-foreground/50">
                Result: {OUTCOME_LABEL[selected.outcome]}
                {selected.stage !== "group" ? " (recorded score incl. extra time; a shootout counts as a draw)" : ""}
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="font-mono grid grid-cols-[92px_1fr_62px] gap-3 text-[10px] uppercase tracking-[0.12em] text-foreground/40 sm:grid-cols-[110px_1fr_70px]">
                <span>Forecaster</span>
                <span className="flex gap-3">
                  {OUTCOME_LABEL.map((l, i) => (
                    <span key={l} className="flex items-center gap-1">
                      <Dot color={OUTCOME_COLOR[i]} dashed={i === 1} /> {l}
                    </span>
                  ))}
                </span>
                <span className="text-right">RPS</span>
              </div>
              <WdlBar label="Ours (replay)" color={FORECASTER.ours.color} p={selected.ours} outcome={selected.outcome} score={rps(selected.ours, selected.outcome)} />
              <WdlBar label="PELE" color={FORECASTER.pele.color} p={selected.pele} outcome={selected.outcome} score={rps(selected.pele, selected.outcome)} />
              {selected.live && (
                <>
                  <WdlBar label="Ours (live)" color={FORECASTER.ours.color} p={selected.live.ours} outcome={selected.outcome} score={rps(selected.live.ours, selected.outcome)} />
                  <WdlBar label="Bookmakers" color={FORECASTER.market.color} p={selected.live.market} outcome={selected.outcome} score={rps(selected.live.market, selected.outcome)} />
                </>
              )}
              <div className="text-[11px] text-foreground/40">Full-opacity segment = what happened. RPS: lower is better (0 = perfect).</div>
            </div>

            <div className="grid gap-3 text-[12px] leading-relaxed text-foreground/65 sm:grid-cols-2">
              <div className="rounded-lg border border-foreground/10 p-3">
                <div className="font-mono mb-1 text-[10px] uppercase tracking-[0.12em] text-foreground/40">PELE provenance</div>
                Version{" "}
                <a className="text-accent hover:underline" href={DATAWRAPPER_VERSION_URL(selected.history.selected_version)} target="_blank" rel="noreferrer">
                  v{selected.history.selected_version} (CSV)
                </a>
                , published {fmtUtc(selected.history.versions.find((v) => v.v === selected.history.selected_version)?.t ?? selected.history.deadline)}. Deadline{" "}
                {fmtUtc(selected.history.deadline)}.
              </div>
              <div className="rounded-lg border border-foreground/10 p-3">
                <div className="font-mono mb-1 text-[10px] uppercase tracking-[0.12em] text-foreground/40">Our provenance</div>
                {selected.live ? (
                  <>
                    Live forecast committed{" "}
                    <a className="text-accent hover:underline" href={`${GITHUB_URL}/blob/${selected.live.commit}/dashboard/data/upcoming_matches.json`} target="_blank" rel="noreferrer">
                      {selected.live.commit.slice(0, 7)}
                    </a>{" "}
                    at {fmtUtc(new Date(selected.live.committed_at).toISOString())}, kickoff {fmtUtc(new Date(selected.live.kickoff).toISOString())}.
                  </>
                ) : (
                  <>No public pre-kickoff commit for this match (our first public forecast commit was on 2026-07-01, US Eastern), so only the leakage-safe replay is scored.</>
                )}
              </div>
            </div>

            <Trajectory m={selected} />
          </div>
        )}
      </div>
    </Card>
  );
}
