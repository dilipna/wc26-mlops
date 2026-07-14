"use client";

import { motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SectionHeading from "./SectionHeading";
import StatsStrip from "./StatsStrip";
import { teamCode } from "@/lib/teamCode";
import { completedSports, type SportConfig } from "@/lib/sports";
import {
  proofLedger,
  results,
  seriesForTeam,
  type LedgerEntry,
  type MatchResult,
  type OutcomeKey,
  type ProofLedger,
} from "@/lib/data";
import { GITHUB_URL } from "@/lib/site";

// Which sport id each prediction ledger covers. A data mapping, not
// component logic -- new sports plug their own ledger in here once their
// pipeline exists. Sports without a ledger still get a minimal card.
const LEDGER_BY_SPORT: Record<string, ProofLedger> = {
  fifa_wc26: proofLedger,
};

function pct(v: number | null | undefined, digits = 0): string {
  return v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits)}%`;
}

function winnerOf(r: MatchResult): string | null {
  const h = Number(r.home_score);
  const a = Number(r.away_score);
  if (h > a) return r.home_team;
  if (a > h) return r.away_team;
  return null; // knockout draws resolve on penalties; the log carries 90'/ET score only
}

// The champion: winner of the last completed match on or before the
// sport's end date. Null until the final has actually been played.
function championFor(sport: SportConfig): string | null {
  if (!sport.end_date) return null;
  const finished = results.filter((r) => r.date <= sport.end_date!);
  if (finished.length === 0) return null;
  const last = finished.reduce((a, b) => (a.date > b.date ? a : b));
  if (last.date !== sport.end_date) return null;
  return winnerOf(last);
}

// WC26 knockout rounds by kickoff timestamp -- used to lay the bracket
// out in columns. Date windows, not team/sport names. The R32 boundary is
// mid-day July 4 UTC: the last R32 match (a July-4 01:30 kickoff) sits
// before it, the first R16 match (July 4 17:00) after.
function roundLabel(commenceTime: string): string {
  const t = commenceTime.slice(0, 13);
  if (t < "2026-07-04T12") return "Round of 32";
  if (t < "2026-07-08T00") return "Round of 16";
  if (t < "2026-07-13T00") return "Quarterfinals";
  if (t < "2026-07-17T00") return "Semifinals";
  return "Final";
}

const ROUND_ORDER = ["Round of 32", "Round of 16", "Quarterfinals", "Semifinals", "Final"];

function pickTeam(pick: OutcomeKey | null, home: string, away: string): string {
  if (pick === "home_win") return home;
  if (pick === "away_win") return away;
  return "Draw";
}

// Bracket color code: accent = we were right when the market was wrong,
// plain = both right, muted = we were wrong.
function bracketTone(e: LedgerEntry): { border: string; text: string } {
  if (!e.grading) return { border: "var(--card-border)", text: "var(--secondary)" };
  if (e.grading.model_correct && e.grading.market_correct === false)
    return { border: "var(--accent)", text: "var(--accent)" };
  if (e.grading.model_correct) return { border: "rgba(255,255,255,0.35)", text: "var(--foreground)" };
  return { border: "var(--card-border)", text: "var(--muted)" };
}

function BracketOverlay({ ledger, signatureId }: { ledger: ProofLedger; signatureId: string | null }) {
  const graded = ledger.entries.filter((e) => e.grading);
  const rounds = ROUND_ORDER.map((label) => ({
    label,
    matches: graded.filter((e) => roundLabel(e.match.commence_time) === label),
  })).filter((r) => r.matches.length > 0);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px] items-start gap-4">
        {rounds.map((round) => (
          <div key={round.label} className="flex-1 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/40">{round.label}</div>
            {round.matches.map((e) => {
              const tone = bracketTone(e);
              const isSignature = e.id === signatureId;
              return (
                <div
                  key={e.id}
                  className="glass-card-alt rounded-xl p-3 text-[13px]"
                  style={{
                    borderColor: tone.border,
                    boxShadow: isSignature ? "0 0 24px color-mix(in srgb, var(--accent) 25%, transparent)" : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground/85">{e.match.home_team}</span>
                    <span className="font-mono text-foreground/60">{e.result!.home_score}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground/85">{e.match.away_team}</span>
                    <span className="font-mono text-foreground/60">{e.result!.away_score}</span>
                  </div>
                  <div className="font-mono mt-1.5 text-[10px]" style={{ color: tone.text }}>
                    we picked {pickTeam(e.prediction.model_pick, e.match.home_team, e.match.away_team)}{" "}
                    {pct(e.prediction.model[e.prediction.model_pick])}
                    {isSignature && " · signature call"}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="font-mono mt-4 flex flex-wrap items-center gap-5 text-[11px] text-foreground/45">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: "var(--accent)" }} /> right when the market was wrong
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: "rgba(255,255,255,0.35)" }} /> both right
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border" style={{ borderColor: "var(--card-border)" }} /> we were wrong
        </span>
      </div>
    </div>
  );
}

function ChampionSparkline({ team }: { team: string }) {
  const rows = seriesForTeam(team).map((r) => ({
    date: r.date.slice(5),
    probability: Number((r.win_probability * 100).toFixed(1)),
  }));
  if (rows.length < 2) return null;

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="date"
            stroke="var(--muted)"
            tick={{ fontSize: 10, fill: "var(--secondary)", fontFamily: "var(--font-plex-mono), monospace" }}
            tickLine={false}
          />
          <YAxis
            stroke="var(--muted)"
            tick={{ fontSize: 10, fill: "var(--secondary)", fontFamily: "var(--font-plex-mono), monospace" }}
            tickLine={false}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
              borderRadius: 12,
              fontFamily: "var(--font-plex-mono), monospace",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--secondary)" }}
          />
          <Line
            type="monotone"
            dataKey="probability"
            name={team}
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function RetroCard({ sport }: { sport: SportConfig }) {
  const ledger: ProofLedger | undefined = LEDGER_BY_SPORT[sport.id];
  const champion = championFor(sport);
  const s = ledger?.summary;
  // Latest graded upset -- same selection rule as ProofLedgerShowcase's
  // SignatureCard and the PDF generator, so all three feature one match.
  const upsets = ledger
    ? ledger.entries.filter((e) => e.grading?.model_correct && e.grading.market_correct === false)
    : [];
  const signature =
    upsets.length > 0
      ? upsets.reduce((a, b) => (a.match.commence_time > b.match.commence_time ? a : b))
      : null;
  const pdfName = sport.end_date ? `${sport.id.toUpperCase()}_Final_Retrospective_${sport.end_date}.pdf` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card space-y-8 rounded-2xl p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-display text-3xl font-extrabold text-foreground">{sport.name}</div>
          <div className="font-mono mt-1 text-xs text-foreground/45">
            {sport.start_date ?? "—"} &rarr; {sport.end_date ?? "—"} &middot; season complete
          </div>
        </div>
        {champion && (
          <div
            className="flex items-center gap-3 rounded-2xl border px-5 py-3"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)", background: "var(--card-alt)" }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-foreground/15 font-mono text-xs text-accent" style={{ background: "var(--card)" }}>
              {teamCode(champion)}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/40">Champion</div>
              <div className="font-display text-xl font-extrabold text-accent">{champion}</div>
            </div>
          </div>
        )}
      </div>

      {s && (
        <StatsStrip
          stats={[
            { label: "Predictions logged", value: String(s.n_entries) },
            { label: "Our accuracy vs the market's", value: `${pct(s.model_accuracy)} vs ${pct(s.market_accuracy)}` },
            { label: "Brier — ours vs market (lower wins)", value: `${s.model_avg_brier ?? "—"} vs ${s.market_avg_brier ?? "—"}` },
            {
              label: "Beat the market when we disagreed",
              value: s.n_disagreements > 0 ? `${s.model_won_disagreements} of ${s.n_disagreements}` : "—",
            },
          ]}
        />
      )}

      {ledger && (
        <div>
          <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.16em] text-foreground/40">
            The bracket, with our calls overlaid
          </div>
          <BracketOverlay ledger={ledger} signatureId={signature?.id ?? null} />
        </div>
      )}

      {champion && (
        <div>
          <div className="font-mono mb-3 text-[11px] uppercase tracking-[0.16em] text-foreground/40">
            {champion}&apos;s title probability, day by day
          </div>
          <ChampionSparkline team={champion} />
        </div>
      )}

      <div className="font-mono flex flex-wrap gap-5 text-xs">
        {ledger && (
          <a
            href={`${GITHUB_URL}/blob/main/data/proof/prediction_ledger.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:text-accent-hover"
          >
            Full prediction ledger
          </a>
        )}
        {pdfName && (
          <a
            href={`${GITHUB_URL}/blob/main/reports/${pdfName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:text-accent-hover"
          >
            PDF retrospective
          </a>
        )}
      </div>
    </motion.div>
  );
}

// Appears automatically once any sport's is_active flips to false in
// sports_config.json -- a permanent portfolio showcase, not an archive.
export default function CompletedShowcase() {
  const completed = completedSports();
  if (completed.length === 0) return null;

  return (
    <section id="completed" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
      <SectionHeading
        eyebrow="Completed"
        title="Seasons We Called"
        subtitle="Finished competitions, kept as a permanent record: every prediction graded, our model head-to-head with the market, and the full audit trail one click away."
      />
      <div className="space-y-8">
        {completed.map((sport) => (
          <RetroCard key={sport.id} sport={sport} />
        ))}
      </div>
    </section>
  );
}
