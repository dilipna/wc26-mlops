"use client";

import { motion } from "framer-motion";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PairedTest, PeleComparison, PeleMatch, Triple } from "@/lib/data";
import { GITHUB_URL } from "@/lib/site";

// Validated trio (dataviz validate_palette.js, dark, #111111: all checks PASS).
// Color follows the forecaster everywhere in this section.
const COLORS = { ours: "var(--chart-1)", pele: "var(--chart-2)", market: "var(--chart-4)" };
const NAMES = { ours: "Our model", pele: "PELE (Silver Bulletin)", market: "Bookmakers" };

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

function signed(v: number, digits = 3) {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
}

function TestLine({ test, a, b }: { test: PairedTest; a: string; b: string }) {
  const lead = test.mean_diff < 0 ? a : b;
  return (
    <p className="font-mono text-[11px] leading-relaxed text-foreground/50">
      {a} − {b}: ΔRPS {signed(test.mean_diff, 4)} · 95% CI [{signed(test.ci95[0], 4)}, {signed(test.ci95[1], 4)}] · p ={" "}
      {test.p_value.toFixed(2)}
      <br />
      <span className="text-foreground/70">
        {test.p_value < 0.05 ? `${lead} is significantly better.` : `Not distinguishable from noise at n = ${test.n}.`}
      </span>
    </p>
  );
}

// Lower RPS is better, so bars are drawn on a shared, zero-based scale and
// the best (shortest) one is called out in text, never by color alone.
function RpsBars({ entries }: { entries: { key: keyof typeof COLORS; rps: number }[] }) {
  const max = Math.max(...entries.map((e) => e.rps));
  const best = Math.min(...entries.map((e) => e.rps));
  return (
    <div className="flex flex-col gap-3">
      {entries.map((e, i) => (
        <div key={e.key} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-3" title={`${NAMES[e.key]}: RPS ${e.rps.toFixed(4)}`}>
          <span className="truncate text-[13px] text-foreground/75">{NAMES[e.key]}</span>
          <div className="h-[10px] overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${(e.rps / max) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="h-full rounded-full"
              style={{ background: COLORS[e.key] }}
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

function ReliabilityChart({ data }: { data: PeleComparison["replay"]["calibration"] }) {
  // One row per bin index; the two forecasters' bins share edges.
  const rows = data.replay.bins.map((b, i) => ({
    bin: `${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%`,
    ours_x: b.mean_predicted * 100,
    ours: b.observed_frequency * 100,
    ours_n: b.n,
    pele: (data.pele.bins[i]?.observed_frequency ?? NaN) * 100,
    pele_x: (data.pele.bins[i]?.mean_predicted ?? NaN) * 100,
    pele_n: data.pele.bins[i]?.n,
  }));
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--card-border)" vertical={false} />
          <XAxis dataKey="bin" tick={{ fill: "var(--secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "var(--secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ stroke: "var(--muted)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="glass-card rounded-xl px-3 py-2 text-xs">
                  <div className="font-mono mb-1 uppercase tracking-widest text-foreground/50">Predicted {label}</div>
                  {rows
                    .filter((r) => r.bin === label)
                    .map((r) => (
                      <div key={r.bin} className="space-y-0.5 text-foreground/80">
                        <div>
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS.ours }} />
                          Ours: said {r.ours_x.toFixed(0)}%, happened {r.ours.toFixed(0)}% (n={r.ours_n})
                        </div>
                        <div>
                          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS.pele }} />
                          PELE: said {r.pele_x.toFixed(0)}%, happened {r.pele.toFixed(0)}% (n={r.pele_n})
                        </div>
                      </div>
                    ))}
                </div>
              ) : null
            }
          />
          <Line dataKey="ours_x" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1} dot={false} name="Perfect calibration (ours)" isAnimationActive={false} />
          <Line dataKey="ours" stroke={COLORS.ours} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} name={NAMES.ours} />
          <Line dataKey="pele" stroke={COLORS.pele} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} name={NAMES.pele} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function pActual(t: Triple | null | undefined, outcome: number) {
  return t ? `${Math.round(t[outcome] * 100)}%` : "—";
}

function LiveTable({ matches }: { matches: PeleMatch[] }) {
  const rows = matches.filter((m) => m.live?.pele && m.live?.market);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40">
          <tr className="border-b border-foreground/10">
            <th className="py-2 pr-3 font-normal">Round</th>
            <th className="py-2 pr-3 font-normal">Match</th>
            <th className="py-2 pr-3 font-normal">Score</th>
            <th className="py-2 pr-3 text-right font-normal">Ours</th>
            <th className="py-2 pr-3 text-right font-normal">PELE</th>
            <th className="py-2 pr-3 text-right font-normal">Books</th>
            <th className="py-2 font-normal">Receipt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const L = m.live!;
            const probs = { ours: L.ours[m.outcome], pele: L.pele![m.outcome], market: L.market![m.outcome] };
            const top = (Object.keys(probs) as (keyof typeof probs)[]).reduce((a, b) => (probs[a] >= probs[b] ? a : b));
            return (
              <tr key={`${m.date}-${m.home}`} className="border-b border-foreground/5 text-foreground/80">
                <td className="font-mono py-2 pr-3 text-foreground/50">{m.stage}</td>
                <td className="py-2 pr-3">
                  {m.home} v {m.away}
                </td>
                <td className="font-mono py-2 pr-3">{m.score}</td>
                {(["ours", "pele", "market"] as const).map((k) => (
                  <td key={k} className={`font-mono py-2 pr-3 text-right ${k === top ? "font-semibold text-foreground" : "text-foreground/55"}`}>
                    {pActual(k === "ours" ? L.ours : k === "pele" ? L.pele : L.market, m.outcome)}
                  </td>
                ))}
                <td className="font-mono py-2 text-[11px]">
                  <a className="text-accent hover:underline" href={`${GITHUB_URL}/commit/${L.ours_commit}`} target="_blank" rel="noreferrer">
                    ours
                  </a>
                  <span className="text-foreground/30"> · </span>
                  <span className="text-foreground/45" title={`PELE version published ${L.pele_published_at}`}>
                    PELE {L.pele_published_at?.slice(5, 16).replace("T", " ")}Z
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-foreground/40">
        Each cell is the probability that forecaster gave to what actually happened (90-minute-or-extra-time result); bold = highest.
        Both sides were public before kickoff: ours as a git commit, PELE as a timestamped Datawrapper version.
      </p>
    </div>
  );
}

export default function PeleBenchmark({ data }: { data: PeleComparison | null }) {
  if (!data) return null;
  const { live, replay, ratings, ablation_host_advantage: abl } = data;
  const power = replay.all.ours_vs_pele.rps.matches_for_80pct_power;
  const pctPts = (live.replay_fidelity_mean_abs_diff * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. The two tracks, side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
          <div className="font-mono mb-1 text-[10px] uppercase tracking-[0.16em] text-accent">Live · zero hindsight</div>
          <h3 className="font-display mb-1 text-xl font-extrabold text-foreground">{live.n} knockout matches</h3>
          <p className="mb-5 text-[13px] text-foreground/50">
            Every forecast published before kickoff by all three. Ranked Probability Score, lower is better.
          </p>
          <RpsBars
            entries={[
              { key: "ours", rps: live.metrics.ours.rps },
              { key: "pele", rps: live.metrics.pele.rps },
              { key: "market", rps: live.metrics.market.rps },
            ]}
          />
          <div className="mt-5 space-y-2">
            <TestLine test={live.ours_vs_pele.rps} a="Ours" b="PELE" />
          </div>
        </motion.div>

        <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
          <div className="font-mono mb-1 text-[10px] uppercase tracking-[0.16em] text-accent">Full tournament · leakage-safe replay</div>
          <h3 className="font-display mb-1 text-xl font-extrabold text-foreground">{replay.all.n} matches, groups to final</h3>
          <p className="mb-5 text-[13px] text-foreground/50">
            PELE&apos;s real pre-kickoff numbers vs our model re-run with data frozen at the opening match (it reproduces our live calls to within{" "}
            {pctPts} pts).
          </p>
          <RpsBars
            entries={[
              { key: "ours", rps: replay.all.metrics.replay.rps },
              { key: "pele", rps: replay.all.metrics.pele.rps },
            ]}
          />
          <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-[11px] text-foreground/55">
            <div>
              Group stage (n={replay.group.n}): ours {replay.group.metrics.replay.rps.toFixed(3)} · PELE {replay.group.metrics.pele.rps.toFixed(3)}
            </div>
            <div>
              Knockouts (n={replay.knockout.n}): ours {replay.knockout.metrics.replay.rps.toFixed(3)} · PELE{" "}
              {replay.knockout.metrics.pele.rps.toFixed(3)}
            </div>
          </div>
          <div className="mt-3">
            <TestLine test={replay.all.ours_vs_pele.rps} a="Ours" b="PELE" />
          </div>
        </motion.div>
      </div>

      {/* 2. The honest verdict */}
      <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="font-mono text-[clamp(26px,4vw,36px)] font-semibold text-foreground">~{power?.toLocaleString()}</div>
            <div className="mt-1 text-[13px] text-foreground/55">
              {`matches needed to tell the two apart with 80% power — about ${power ? Math.round(power / 104) : "?"} World Cups. `}One tournament can&apos;t crown
              a better model; it can only rule out a big gap.
            </div>
          </div>
          <div>
            <div className="font-mono text-[clamp(26px,4vw,36px)] font-semibold text-foreground">
              {replay.calibration.pele.ece.toFixed(3)} <span className="text-foreground/35">vs</span> {replay.calibration.replay.ece.toFixed(3)}
            </div>
            <div className="mt-1 text-[13px] text-foreground/55">
              calibration error, PELE vs ours. Both get the draw rate right; ours is too timid on favorites (gave them 59% on average, they
              won 65%) — a likely source of PELE&apos;s edge.
            </div>
          </div>
          <div>
            <div className="font-mono text-[clamp(26px,4vw,36px)] font-semibold text-foreground">
              {signed(replay.all.combo_vs_ours.log_loss.mean_diff, 3)}
            </div>
            <div className="mt-1 text-[13px] text-foreground/55">
              log loss from simply averaging our forecast with PELE&apos;s (p = {replay.all.combo_vs_ours.log_loss.p_value.toFixed(2)} vs ours alone) — the
              models make different mistakes, so the blend helps.
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3. Calibration + ratings */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
          <h3 className="font-display mb-1 text-lg font-extrabold text-foreground">Reliability: when they said X%, how often did it happen?</h3>
          <p className="mb-4 text-[13px] text-foreground/50">
            All {replay.all.n * 3} outcome probabilities across {replay.all.n} matches, binned. Dashed = perfect calibration.
          </p>
          <ReliabilityChart data={replay.calibration} />
          <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-foreground/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.ours }} /> {NAMES.ours} (ECE {replay.calibration.replay.ece.toFixed(3)})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS.pele }} /> {NAMES.pele} (ECE {replay.calibration.pele.ece.toFixed(3)})
            </span>
          </div>
        </motion.div>

        <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
          <h3 className="font-display mb-1 text-lg font-extrabold text-foreground">Where the ratings disagreed — and who was right</h3>
          <p className="mb-4 text-[13px] text-foreground/50">
            Pre-tournament rank of all {ratings.n_teams} teams: PELE rating vs our Elo. Spearman ρ ={" "}
            {ratings.spearman_rank_correlation.toFixed(2)} — they mostly agree.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-left text-[13px]">
              <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40">
                <tr className="border-b border-foreground/10">
                  <th className="py-2 pr-3 font-normal">Team</th>
                  <th className="py-2 pr-3 text-right font-normal">PELE #</th>
                  <th className="py-2 pr-3 text-right font-normal">Our #</th>
                  <th className="py-2 font-normal">Reached</th>
                </tr>
              </thead>
              <tbody>
                {ratings.largest_disagreements.slice(0, 7).map((d) => (
                  <tr key={d.team} className="border-b border-foreground/5 text-foreground/80">
                    <td className="py-2 pr-3">{d.team}</td>
                    <td className="font-mono py-2 pr-3 text-right">{d.pele_rank}</td>
                    <td className="font-mono py-2 pr-3 text-right">{d.our_rank}</td>
                    <td className="font-mono py-2 text-foreground/60">{d.finish === "group" ? "Group" : d.finish}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-foreground/50">
            Norway is the tell: results-only Elo had them 19th; PELE&apos;s squad-value component had them 8th. They knocked out Brazil. That is the
            information our model structurally cannot see.
          </p>
        </motion.div>
      </div>

      {/* 4. Method diff + ablation */}
      <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
        <h3 className="font-display mb-4 text-lg font-extrabold text-foreground">What PELE models that we don&apos;t</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40">
              <tr className="border-b border-foreground/10">
                <th className="w-[160px] py-2 pr-4 font-normal">Aspect</th>
                <th className="py-2 pr-4 font-normal">PELE</th>
                <th className="py-2 font-normal">Ours</th>
              </tr>
            </thead>
            <tbody>
              {data.method_differences.map((row) => (
                <tr key={row.aspect} className="border-b border-foreground/5 align-top">
                  <td className="py-2.5 pr-4 text-foreground">{row.aspect}</td>
                  <td className="py-2.5 pr-4 text-foreground/65">{row.pele}</td>
                  <td className="py-2.5 text-foreground/65">{row.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-foreground/55">
          <span className="text-foreground">Tested one idea directly:</span> scoring the {abl.n_host_matches} co-host matches as home games instead of neutral.
          RPS moved {signed(abl.hfa_vs_neutral.rps.mean_diff, 4)} (p = {abl.hfa_vs_neutral.rps.p_value.toFixed(2)}) — no help. Our model&apos;s home
          effect is learned from ordinary home games, not from a host nation at a World Cup; PELE&apos;s venue-specific adjustment is a different
          mechanism, and on those matches it scored {abl.metrics.pele.rps.toFixed(3)} to our {abl.metrics.replay.rps.toFixed(3)}.
        </p>
      </motion.div>

      {/* 5. Receipts */}
      <motion.details {...fade} className="glass-card group rounded-2xl p-6">
        <summary className="font-display cursor-pointer text-lg font-extrabold text-foreground">
          Match-by-match receipts ({live.n} live knockout matches)
        </summary>
        <div className="mt-5">
          <LiveTable matches={data.matches} />
        </div>
      </motion.details>

      <p className="text-[12px] leading-relaxed text-foreground/40">
        Method: PELE numbers are the last version of Silver Bulletin&apos;s forecast table published before kickoff, recovered from Datawrapper&apos;s
        immutable version history ({`${data.sources.pele_data.charts["3bTOr"]?.versions} versions`}) with each version&apos;s publish timestamp. Scored with the
        Ranked Probability Score (ordinal: calling a win a draw costs less than calling it a loss), plus Brier and log loss; paired bootstrap CIs and
        sign-flip randomization tests. PELE methodology:{" "}
        <a className="text-accent hover:underline" href={data.sources.pele_methodology} target="_blank" rel="noreferrer">
          natesilver.net/p/pele-methodology
        </a>
        . Code:{" "}
        <a className="text-accent hover:underline" href={`${GITHUB_URL}/blob/main/scripts/compare_vs_pele.py`} target="_blank" rel="noreferrer">
          scripts/compare_vs_pele.py
        </a>
        .
      </p>
    </div>
  );
}
