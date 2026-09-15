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
  // One row per decile, joined by bin lower edge (a forecaster with no
  // probabilities in a decile simply has no point there). Bins with n < 10
  // are flagged low-confidence and drawn hollow.
  const edges = Array.from(new Set([...data.replay.bins, ...data.pele.bins].map((b) => b.lo))).sort((a, b) => a - b);
  const find = (bins: typeof data.replay.bins, lo: number) => bins.find((b) => Math.abs(b.lo - lo) < 1e-9);
  const rows = edges.map((lo) => {
    const o = find(data.replay.bins, lo);
    const p = find(data.pele.bins, lo);
    return {
      bin: `${Math.round(lo * 100)}–${Math.round(lo * 100 + 10)}%`,
      mid: lo * 100 + 5,
      ours: o ? o.observed_frequency * 100 : null,
      ours_x: o ? o.mean_predicted * 100 : null,
      ours_n: o?.n ?? 0,
      ours_low: o?.low_confidence ?? false,
      pele: p ? p.observed_frequency * 100 : null,
      pele_x: p ? p.mean_predicted * 100 : null,
      pele_n: p?.n ?? 0,
      pele_low: p?.low_confidence ?? false,
    };
  });
  const dot = (color: string, lowKey: "ours_low" | "pele_low") =>
    function DotShape(props: { cx?: number; cy?: number; payload?: (typeof rows)[number] }) {
      const { cx, cy, payload } = props;
      if (cx == null || cy == null || !payload) return <g />;
      const low = payload[lowKey];
      return <circle cx={cx} cy={cy} r={4} strokeWidth={2} stroke={low ? color : "var(--card)"} fill={low ? "var(--card)" : color} />;
    };
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
                        {([
                          ["Ours", COLORS.ours, r.ours_x, r.ours, r.ours_n, r.ours_low],
                          ["PELE", COLORS.pele, r.pele_x, r.pele, r.pele_n, r.pele_low],
                        ] as const).map(([name, color, said, happened, n, low]) => (
                          <div key={name}>
                            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: color }} />
                            {said == null || happened == null
                              ? `${name}: no forecasts in this range`
                              : `${name}: said ${said.toFixed(0)}%, happened ${happened.toFixed(0)}% (n=${n}${low ? ", low confidence" : ""})`}
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              ) : null
            }
          />
          <Line dataKey="mid" stroke="var(--muted)" strokeDasharray="4 4" strokeWidth={1} dot={false} activeDot={false} name="Perfect calibration" isAnimationActive={false} />
          <Line dataKey="ours" stroke={COLORS.ours} strokeWidth={2} connectNulls dot={dot(COLORS.ours, "ours_low")} name={NAMES.ours} />
          <Line dataKey="pele" stroke={COLORS.pele} strokeWidth={2} connectNulls dot={dot(COLORS.pele, "pele_low")} name={NAMES.pele} />
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
        Each cell is the probability that forecaster gave to what actually happened (recorded score incl. extra time; a shootout counts as a draw); bold = highest.
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
  const dx = replay.diagnostics;
  const allTest = replay.all.ours_vs_pele.rps;
  const byTeam = Object.fromEntries(ratings.largest_disagreements.map((d) => [d.team, d]));
  const norway = byTeam["Norway"];
  const hostTest = dx.host_matches_ours_vs_pele.rps;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. The two tracks, side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
          <div className="font-mono mb-1 text-[10px] uppercase tracking-[0.16em] text-accent">Live · zero hindsight</div>
          <h3 className="font-display mb-1 text-xl font-extrabold text-foreground">{live.n} knockout matches</h3>
          <p className="mb-5 text-[13px] text-foreground/50">
            Every forecast public before kickoff from all three. Ranked Probability Score over 3 outcomes; lower is better.
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
              Group stage (n={replay.group.n}): ours {replay.group.metrics.replay.rps.toFixed(3)} · PELE {replay.group.metrics.pele.rps.toFixed(3)} · p ={" "}
              {replay.group.ours_vs_pele.rps.p_value.toFixed(2)}
            </div>
            <div>
              Knockouts (n={replay.knockout.n}): ours {replay.knockout.metrics.replay.rps.toFixed(3)} · PELE{" "}
              {replay.knockout.metrics.pele.rps.toFixed(3)} · p = {replay.knockout.ours_vs_pele.rps.p_value.toFixed(2)}
            </div>
          </div>
          <div className="mt-3">
            <TestLine test={replay.all.ours_vs_pele.rps} a="Ours" b="PELE" />
          </div>
        </motion.div>
      </div>

      {/* 2. What the numbers do and don't support -- every figure is read from the JSON */}
      <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="font-mono text-[clamp(26px,4vw,36px)] font-semibold text-foreground">~{power?.toLocaleString()}</div>
            <div className="mt-1 text-[13px] text-foreground/55">
              {`matches needed to detect the full-tournament gap (ΔRPS ${signed(allTest.mean_diff, 4)}) with 80% power, about ${
                power ? Math.round(power / 104) : "?"
              } World Cups of 104 matches. The 95% CI [${signed(allTest.ci95[0], 4)}, ${signed(allTest.ci95[1], 4)}] only rules out ours being more than ${Math.abs(
                allTest.ci95[0],
              ).toFixed(3)} better or ${allTest.ci95[1].toFixed(3)} worse.`}
            </div>
          </div>
          <div>
            <div className="font-mono text-[clamp(26px,4vw,36px)] font-semibold text-foreground">
              {replay.calibration.pele.ece.toFixed(3)} <span className="text-foreground/35">vs</span> {replay.calibration.replay.ece.toFixed(3)}
            </div>
            <div className="mt-1 text-[13px] text-foreground/55">
              {`decile calibration error (ECE), PELE vs ours. Bootstrap 95% CI of the difference: [${signed(
                dx.ece_decile_diff_ours_minus_pele.ci95[0],
              )}, ${signed(dx.ece_decile_diff_ours_minus_pele.ci95[1])}], so no reliable calibration gap. Draws: ${(dx.draw_rate.observed * 100).toFixed(
                1,
              )}% actual vs ${(dx.draw_rate.mean_predicted_ours * 100).toFixed(1)}% predicted by ours, ${(dx.draw_rate.mean_predicted_pele * 100).toFixed(
                1,
              )}% by PELE.`}
            </div>
          </div>
          <div>
            <div className="font-mono text-[clamp(26px,4vw,36px)] font-semibold text-foreground">
              {signed(replay.all.combo_vs_ours.log_loss.mean_diff, 3)}
            </div>
            <div className="mt-1 text-[13px] text-foreground/55">
              {`log loss from a 50/50 average of ours and PELE, vs ours alone (p = ${replay.all.combo_vs_ours.log_loss.p_value.toFixed(
                2,
              )}; on RPS p = ${replay.all.combo_vs_ours.rps.p_value.toFixed(2)}). The blend is not better than PELE alone (log loss ${signed(
                replay.all.combo_vs_pele.log_loss.mean_diff,
                3,
              )}, p = ${replay.all.combo_vs_pele.log_loss.p_value.toFixed(2)}). Per-match RPS correlates at ${dx.per_match_rps_correlation.toFixed(
                2,
              )}: the two mostly miss the same matches.`}
            </div>
          </div>
        </div>
      </motion.div>

      {/* 3. Calibration + ratings */}
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div {...fade} className="glass-card min-w-0 rounded-2xl p-6">
          <h3 className="font-display mb-1 text-lg font-extrabold text-foreground">Reliability: when they said X%, how often did it happen?</h3>
          <p className="mb-4 text-[13px] text-foreground/50">
            {`All ${replay.all.n * 3} outcome probabilities (3 per match, so n counts probabilities, not matches), in deciles. Dashed = perfect calibration. Hollow points have n < 10 (low confidence); hover for n.`}
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
          <h3 className="font-display mb-1 text-lg font-extrabold text-foreground">Where the ratings disagreed, and how far each team got</h3>
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
          {norway && byTeam["Japan"] && byTeam["Iran"] && (
            <p className="mt-3 text-[12px] leading-relaxed text-foreground/50">
              {`Ranks differ more than ratings do. Norway is ${norway.pele_rating.toFixed(0)} in PELE and ${norway.our_elo.toFixed(
                0,
              )} in our Elo, nearly the same number, yet #${norway.pele_rank} vs #${norway.our_rank}, because our Elo spreads other teams wider (Japan ${byTeam[
                "Japan"
              ].our_elo.toFixed(0)} vs PELE ${byTeam["Japan"].pele_rating.toFixed(0)}; Iran ${byTeam["Iran"].our_elo.toFixed(0)} vs ${byTeam[
                "Iran"
              ].pele_rating.toFixed(0)}). The scales aren't comparable point for point, so compare ranks.`}
            </p>
          )}
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
          <span className="text-foreground">Tested one PELE idea on our model:</span>{" "}
          {`scoring the ${abl.n_host_matches} co-host matches as home games instead of neutral moved our RPS by ${signed(
            abl.hfa_vs_neutral.rps.mean_diff,
            4,
          )} (p = ${abl.hfa_vs_neutral.rps.p_value.toFixed(2)}): no improvement. On those ${abl.n_host_matches} matches PELE scored ${abl.metrics.pele.rps.toFixed(
            3,
          )} to our ${abl.metrics.replay.rps.toFixed(3)} (p = ${hostTest.p_value.toFixed(2)}), too few matches to conclude anything.`}
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
        Method: PELE numbers are the last version of Silver Bulletin&apos;s forecast table published before kickoff (exact kickoff where known; otherwise 15:00 UTC on the match&apos;s local date, which is earlier than any 2026 kickoff), recovered from Datawrapper&apos;s
        immutable version history ({`${data.sources.pele_data.charts["3bTOr"]?.versions} versions`}) with each version&apos;s publish timestamp. Scored with the
        Ranked Probability Score (ordinal: calling a win a draw costs less than calling it a loss), plus Brier and log loss; paired bootstrap CIs and
        sign-flip randomization tests. PELE methodology:{" "}
        <a className="text-accent hover:underline" href={data.sources.pele_methodology} target="_blank" rel="noreferrer">
          natesilver.net/p/pele-methodology
        </a>
        . One-page summary with the test behind every p-value:{" "}
        <a className="text-accent hover:underline" href={`${GITHUB_URL}/blob/main/docs/pele-benchmark-summary.md`} target="_blank" rel="noreferrer">
          docs/pele-benchmark-summary.md
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
