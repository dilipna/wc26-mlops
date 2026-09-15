"use client";

import { pelePage, signed } from "@/lib/pele/data";
import { Card, CardTitle, Eyebrow, Muted } from "./ui";

export default function Audit() {
  const { headline, accounting, method_differences, fixtures_without_pre_kickoff_pele, leak_cases } = pelePage;
  const dx = headline.diagnostics;
  const leak = pelePage.matches.find((m) => m.history.label_rule_leak);
  const oldV = leak?.history.versions.find((v) => v.v === leak.history.label_rule_version);
  const newV = leak?.history.versions.find((v) => v.v === leak.history.selected_version);
  const nextDayLabels = pelePage.matches.filter((m) => m.history.label_date > m.date).length;

  const withdrawn = [
    {
      claim: "PELE is better calibrated than our model",
      why: `Decile ECE is ${dx.ece_decile_diff_ours_minus_pele.point >= 0 ? "higher" : "lower"} for ours by ${Math.abs(dx.ece_decile_diff_ours_minus_pele.point).toFixed(3)}, but the bootstrap 95% CI of that difference, [${signed(dx.ece_decile_diff_ours_minus_pele.ci95[0])}, ${signed(dx.ece_decile_diff_ours_minus_pele.ci95[1])}], includes 0.`,
    },
    {
      claim: "Our model is too timid on favorites",
      why: `We gave favorites ${(dx.favorites.ours.mean_predicted * 100).toFixed(1)}% on average and they won ${(dx.favorites.ours.observed * 100).toFixed(1)}%, but the 95% CI of that gap is [${signed(dx.favorites.ours.gap.ci95[0] * 100, 1)}, ${signed(dx.favorites.ours.gap.ci95[1] * 100, 1)}] points, which includes 0.`,
    },
    {
      claim: "Blending helps because the models make different mistakes",
      why: `Per-match RPS correlates at ${dx.per_match_rps_correlation.toFixed(2)}, so they mostly miss the same matches. The 50/50 blend beats ours only on log loss (p = ${headline.combo_vs_ours.log_loss.p_value.toFixed(3)}; RPS p = ${headline.combo_vs_ours.rps.p_value.toFixed(2)}) and does not beat PELE (log loss p = ${headline.combo_vs_pele.log_loss.p_value.toFixed(2)}).`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Eyebrow>Found in audit, fixed</Eyebrow>
          <CardTitle>The leakage bug</CardTitle>
          <Muted>
            For matches without a known kickoff time, the first version of the benchmark took PELE&apos;s last forecast published before 15:00 UTC on PELE&apos;s own
            date label. PELE labels matches by US Eastern date, so a late Pacific kickoff carries the next day&apos;s label.
            {leak && oldV && newV && (
              <>
                {" "}
                For {leak.home}–{leak.away} (played {leak.date} local time), that rule picked v{oldV.v}, published {oldV.t.slice(0, 16).replace("T", " ")} UTC, after
                the match. The fix anchors the deadline on the earlier of PELE&apos;s label and the local match date, which picks v{newV.v}.
              </>
            )}{" "}
            {nextDayLabels} matches carried a next-day label; {leak_cases} actually received a post-match version under the old rule (the others had no newer
            version in between). The fix made
            PELE&apos;s full-tournament RPS worse (0.1479 → 0.1492): the bug had favored the benchmark, not our model. A regression test pins it.
          </Muted>
        </Card>

        <Card>
          <Eyebrow>Nothing silently dropped</Eyebrow>
          <CardTitle>Match accounting</CardTitle>
          <ul className="space-y-2 text-[13px] leading-relaxed text-foreground/65">
            <li>
              <span className="font-mono text-foreground">{accounting.world_cup_results}</span> World Cup results;{" "}
              <span className="font-mono text-foreground">{accounting.pele_fixtures}</span> fixtures forecast by PELE. The third-place match (
              {accounting.results_without_pele_fixture.join(", ")}) has no PELE forecast.
            </li>
            <li>
              <span className="font-mono text-foreground">{accounting.scored_replay}</span> scored on the replay track. Excluded:{" "}
              {fixtures_without_pre_kickoff_pele.map((p) => p.join("–")).join(", ")}, where PELE published only an &ldquo;advance&rdquo; probability, never
              win/draw/loss.
            </li>
            <li>
              <span className="font-mono text-foreground">{accounting.scored_live}</span> on the live track. {accounting.knockout_excluded_from_live.length} early
              knockout matches are excluded because our pipeline had not yet committed a forecast before kickoff.
            </li>
            <li>Team-name mismatches: 0. The parser raises on any unknown team code instead of dropping the row.</li>
          </ul>
        </Card>
      </div>

      <Card>
        <Eyebrow>Tested, then withdrawn</Eyebrow>
        <CardTitle>Three claims that did not survive significance testing</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[13px]">
            <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40">
              <tr className="border-b border-foreground/10">
                <th className="w-[34%] py-2 pr-4 font-normal">Withdrawn claim</th>
                <th className="py-2 font-normal">Why the data doesn&apos;t support it</th>
              </tr>
            </thead>
            <tbody>
              {withdrawn.map((w) => (
                <tr key={w.claim} className="border-b border-foreground/5 align-top">
                  <td className="py-2.5 pr-4 text-foreground">{w.claim}</td>
                  <td className="py-2.5 text-foreground/65">{w.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <Eyebrow>Different machines</Eyebrow>
        <CardTitle>What PELE models that our model does not</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/40">
              <tr className="border-b border-foreground/10">
                <th className="w-[150px] py-2 pr-4 font-normal">Aspect</th>
                <th className="py-2 pr-4 font-normal">PELE (per its published methodology)</th>
                <th className="py-2 font-normal">Our model</th>
              </tr>
            </thead>
            <tbody>
              {method_differences.map((row) => (
                <tr key={row.aspect} className="border-b border-foreground/5 align-top">
                  <td className="py-2.5 pr-4 text-foreground">{row.aspect}</td>
                  <td className="py-2.5 pr-4 text-foreground/65">{row.pele}</td>
                  <td className="py-2.5 text-foreground/65">{row.ours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Muted className="mt-4">
          One PELE idea was tested directly on our model: scoring the {headline.ablation_host_advantage.n_host_matches} co-host matches as home games instead of
          neutral changed our RPS by {signed(headline.ablation_host_advantage.hfa_vs_neutral.rps.mean_diff, 4)} (p ={" "}
          {headline.ablation_host_advantage.hfa_vs_neutral.rps.p_value.toFixed(2)}): no improvement.
        </Muted>
      </Card>
    </div>
  );
}
