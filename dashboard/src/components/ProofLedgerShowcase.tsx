"use client";

import { motion } from "framer-motion";
import StatsStrip from "./StatsStrip";
import { teamCode } from "@/lib/teamCode";
import type { LedgerEntry, OutcomeKey, ProofLedger } from "@/lib/data";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Deterministic UTC formatting, same convention as UpcomingMatches --
// avoids server/client hydration mismatches from locale formatting.
function formatUTC(iso: string, withTime = true): string {
  const d = new Date(iso);
  const date = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (!withTime) return date;
  return `${date}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

function pickTeam(pick: OutcomeKey | null, home: string, away: string): string {
  if (pick === "home_win") return home;
  if (pick === "away_win") return away;
  return "Draw";
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${(v * 100).toFixed(0)}%`;
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

// The signature call: the semifinal where the model disagreed with the
// market and was right. Selected by data (latest graded knockout upset
// with the market on the wrong side), not by a hardcoded fixture -- if a
// bigger call lands later, it takes over automatically.
function signatureEntry(ledger: ProofLedger): LedgerEntry | null {
  const upsets = ledger.entries.filter(
    (e) => e.grading && e.grading.model_correct && e.grading.market_correct === false && e.prediction.disagreement,
  );
  if (upsets.length === 0) return null;
  return upsets.reduce((a, b) => (a.match.commence_time > b.match.commence_time ? a : b));
}

function SignatureCard({ entry }: { entry: LedgerEntry }) {
  const { home_team, away_team } = entry.match;
  const modelPick = pickTeam(entry.prediction.model_pick, home_team, away_team);
  const marketPick = pickTeam(entry.prediction.market_pick, home_team, away_team);
  const modelConf = entry.prediction.model[entry.prediction.model_pick];
  const marketConf = entry.prediction.market?.[entry.prediction.market_pick as OutcomeKey] ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card relative overflow-hidden rounded-2xl p-6 sm:p-8"
      style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(80% 120% at 85% 0%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 60%)" }}
      />
      <div className="font-mono relative mb-6 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em]">
        <span className="text-accent">The signature call</span>
        <span className="text-foreground/40">
          {formatUTC(entry.match.commence_time, false)} &middot; we said {modelPick}, the market said {marketPick}
        </span>
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="glass-card-alt flex h-14 w-14 items-center justify-center rounded-xl font-mono text-sm text-foreground/70">
            {teamCode(home_team)}
          </div>
          <div>
            <div className="font-display text-3xl font-extrabold text-foreground">{home_team}</div>
            <div className="font-mono mt-1 text-xs text-foreground/45">
              model {pct(entry.prediction.model.home_win)} &middot; market {pct(entry.prediction.market?.home_win)}
            </div>
          </div>
        </div>

        <div className="text-center">
          {entry.result ? (
            <div className="font-display text-4xl font-black text-foreground">
              {entry.result.home_score}&ndash;{entry.result.away_score}
            </div>
          ) : (
            <div className="font-mono text-sm text-foreground/40">upcoming</div>
          )}
          <div className="font-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-foreground/35">Final score</div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="font-display text-3xl font-extrabold text-accent">{away_team}</div>
            <div className="font-mono mt-1 text-xs text-foreground/45">
              model {pct(entry.prediction.model.away_win)} &middot; market {pct(entry.prediction.market?.away_win)}
            </div>
          </div>
          <div
            className="flex h-14 w-14 items-center justify-center rounded-xl border font-mono text-sm text-accent"
            style={{ background: "var(--card-alt)", borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)" }}
          >
            {teamCode(away_team)}
          </div>
        </div>
      </div>

      <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
        <div className="glass-card-alt rounded-xl p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent/80">Our model said</div>
          <div className="mt-1.5 text-sm text-foreground/85">
            <span className="font-semibold text-foreground">{modelPick}</span>{" "}
            <span className="font-mono text-accent">{pct(modelConf)}</span> &mdash; graded{" "}
            <span className="font-mono text-accent">✓ correct</span>
          </div>
        </div>
        <div className="glass-card-alt rounded-xl p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">The market said</div>
          <div className="mt-1.5 text-sm text-foreground/85">
            <span className="font-semibold text-foreground">{marketPick}</span>{" "}
            <span className="font-mono text-foreground/60">{pct(marketConf)}</span> &mdash; graded{" "}
            <span className="font-mono" style={{ color: "var(--accent-deep)" }}>✗ wrong</span>
          </div>
        </div>
        <div className="glass-card-alt rounded-xl p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">Proof it wasn&apos;t backdated</div>
          <div className="mt-1.5 text-sm leading-relaxed text-foreground/85">
            {entry.provenance ? (
              <>
                Public on GitHub since{" "}
                <a
                  href={entry.provenance.github_commit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-accent underline decoration-accent/40 underline-offset-2 hover:text-accent-hover"
                >
                  {formatUTC(entry.provenance.committed_at)}
                </a>{" "}
                — commit{" "}
                <a
                  href={entry.provenance.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-accent underline decoration-accent/40 underline-offset-2 hover:text-accent-hover"
                >
                  {shortSha(entry.provenance.first_public_commit)}
                </a>
              </>
            ) : (
              <>Logged pre-kickoff in the append-only store{entry.prediction.logged_at ? ` at ${formatUTC(entry.prediction.logged_at)}` : ""}.</>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const { home_team, away_team } = entry.match;
  const modelPick = pickTeam(entry.prediction.model_pick, home_team, away_team);
  const marketPick = entry.prediction.market_pick ? pickTeam(entry.prediction.market_pick, home_team, away_team) : "—";
  const modelConf = entry.prediction.model[entry.prediction.model_pick];
  const marketConf =
    entry.prediction.market && entry.prediction.market_pick ? entry.prediction.market[entry.prediction.market_pick] : null;

  return (
    <tr className="border-b border-card-border text-sm">
      <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs text-foreground/45">
        {formatUTC(entry.match.commence_time, false)}
      </td>
      <td className="py-3 pr-4 text-foreground/85">
        {home_team} <span className="text-foreground/35">v</span> {away_team}
        {entry.result && (
          <span className="font-mono ml-2 text-xs text-foreground/50">
            {entry.result.home_score}&ndash;{entry.result.away_score}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap py-3 pr-4">
        <span className="text-foreground/85">{modelPick}</span>{" "}
        <span className="font-mono text-xs text-accent">{pct(modelConf)}</span>{" "}
        {entry.grading && (
          <span className="font-mono text-xs" style={{ color: entry.grading.model_correct ? "var(--accent)" : "var(--accent-deep)" }}>
            {entry.grading.model_correct ? "✓" : "✗"}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap py-3 pr-4 text-foreground/60">
        {marketPick} <span className="font-mono text-xs">{pct(marketConf)}</span>{" "}
        {entry.grading && entry.grading.market_correct !== null && (
          <span className="font-mono text-xs" style={{ color: entry.grading.market_correct ? "var(--accent)" : "var(--accent-deep)" }}>
            {entry.grading.market_correct ? "✓" : "✗"}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap py-3 font-mono text-xs">
        {entry.provenance ? (
          <a
            href={entry.provenance.github_url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Prediction publicly committed ${formatUTC(entry.provenance.committed_at)} — before kickoff`}
            className="text-accent underline decoration-accent/40 underline-offset-2 hover:text-accent-hover"
          >
            {shortSha(entry.provenance.first_public_commit)}
          </a>
        ) : (
          <span className="text-foreground/35" title={entry.note ?? undefined}>append-only log</span>
        )}
        {!entry.result && <span className="ml-2 text-foreground/35">pending</span>}
      </td>
    </tr>
  );
}

export default function ProofLedgerShowcase({ ledger }: { ledger: ProofLedger }) {
  const signature = signatureEntry(ledger);
  const s = ledger.summary;
  const rows = [...ledger.entries].sort((a, b) => b.match.commence_time.localeCompare(a.match.commence_time));

  const stats = [
    { label: "Predictions in the ledger", value: String(s.n_entries) },
    { label: "Our model's accuracy", value: pct(s.model_accuracy) },
    { label: "The market's accuracy", value: pct(s.market_accuracy) },
    {
      label: "Disagreements we won",
      value: s.n_disagreements > 0 ? `${s.model_won_disagreements} of ${s.n_disagreements}` : "—",
    },
  ];

  return (
    <div className="space-y-8">
      {signature && <SignatureCard entry={signature} />}

      <StatsStrip stats={stats} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card overflow-x-auto rounded-2xl p-5 sm:p-6"
      >
        <div className="font-mono mb-4 flex flex-wrap items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-foreground/40">
          <span>Every WC26 prediction &middot; hash-chained &middot; SHA-timestamped pre-kickoff</span>
          <span>{s.n_with_git_provenance}/{s.n_entries} with public git provenance</span>
        </div>
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="font-mono border-b border-card-border text-[10px] uppercase tracking-[0.14em] text-foreground/35">
              <th className="py-2 pr-4 font-medium">Kickoff</th>
              <th className="py-2 pr-4 font-medium">Match</th>
              <th className="py-2 pr-4 font-medium">Our call</th>
              <th className="py-2 pr-4 font-medium">Market call</th>
              <th className="py-2 font-medium">Recorded at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <LedgerRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="grid gap-4 sm:grid-cols-3"
      >
        {ledger.how_to_verify.map((step, i) => (
          <div key={step} className="glass-card rounded-2xl p-5">
            <div className="font-display text-2xl font-extrabold text-accent">0{i + 1}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground/65">{step.replace(/^\d+\.\s*/, "")}</p>
          </div>
        ))}
      </motion.div>

      <div className="font-mono text-[11px] leading-relaxed text-foreground/35">
        Ledger {ledger.version} &middot; regenerated and committed by the daily pipeline &middot; every entry&apos;s
        hash embeds the previous entry&apos;s hash, so a quiet edit anywhere breaks every hash after it &middot;{" "}
        <a
          href={`${ledger.repo}/blob/main/data/proof/prediction_ledger.json`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/55 underline underline-offset-2 hover:text-foreground"
        >
          raw ledger
        </a>{" "}
        &middot;{" "}
        <a
          href={`${ledger.repo}/commits/main/data/proof/prediction_ledger.json`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground/55 underline underline-offset-2 hover:text-foreground"
        >
          its commit history
        </a>
      </div>
    </div>
  );
}
