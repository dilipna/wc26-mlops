// Typed access to dashboard/data/pele_page.json, produced by
// scripts/export_pele_page.py from the committed benchmark outputs. This
// module is the /pele page's only data source; it is imported at build time
// (static JSON import), so the deployed page needs no API or database.
import raw from "../../../data/pele_page.json";
import type { Triple } from "./stats";

export type Stage = "group" | "R32" | "R16" | "QF" | "SF" | "F";

export type PeleVersion = { v: number; t: string; p: Triple };

export type PeleMatch = {
  date: string;
  stage: Stage;
  home: string;
  away: string;
  score: string;
  outcome: 0 | 1 | 2;
  host: boolean;
  ours: Triple; // leakage-safe replay
  pele: Triple; // PELE's last pre-deadline published forecast
  live: {
    ours: Triple;
    pele: Triple;
    market: Triple;
    kickoff: string;
    commit: string;
    committed_at: string;
  } | null;
  history: {
    versions: PeleVersion[];
    deadline: string;
    deadline_rule: "kickoff" | "local_date_15utc";
    label_date: string;
    selected_version: number;
    label_rule_version: number | null;
    label_rule_leak: boolean;
  };
};

export type TeamRating = {
  team: string;
  pele: number;
  pele_base: number | null;
  roster_adj: number | null;
  elo: number;
  finish: Stage | "Champion";
  elo_path: { t: string; d: number }[];
  pele_path: { t: string; d: number }[];
};

type Paired = { mean_diff: number; ci95: [number, number]; p_value: number; n: number; sd_diff: number; matches_for_80pct_power: number | null };
type Scores = { rps: number; brier: number; log_loss: number; accuracy: number };

export type PelePageData = {
  generated_at: string;
  source_generated_at: string;
  sources: {
    pele_methodology: string;
    pele_data: { charts: Record<string, { versions: number }>; url_pattern: string; fetched_at: string };
  };
  protocol: Record<string, string>;
  accounting: {
    pele_fixtures: number;
    world_cup_results: number;
    results_without_pele_fixture: string[];
    scored_replay: number;
    scored_live: number;
    knockout_excluded_from_live: string[];
  };
  fixtures_without_pre_kickoff_pele: string[][];
  headline: {
    live: {
      n: number;
      metrics: Record<"ours" | "pele" | "market", Scores>;
      ours_vs_pele: Record<string, Paired>;
      ours_vs_market: Record<string, Paired>;
      pele_vs_market: Record<string, Paired>;
      replay_fidelity_mean_abs_diff: number;
    };
    replay: Record<"all" | "group" | "knockout", { n: number; metrics: Record<"replay" | "pele" | "combo", Scores>; ours_vs_pele: Record<string, Paired> }>;
    combo_vs_ours: Record<string, Paired>;
    combo_vs_pele: Record<string, Paired>;
    diagnostics: {
      draw_rate: { observed: number; mean_predicted_ours: number; mean_predicted_pele: number };
      favorites: Record<"ours" | "pele", { mean_predicted: number; observed: number; gap: { point: number; ci95: [number, number] } }>;
      ece_decile_diff_ours_minus_pele: { point: number; ci95: [number, number] };
      per_match_rps_correlation: number;
    };
    ablation_host_advantage: { n_host_matches: number; hfa_vs_neutral: Record<string, Paired> };
  };
  method_differences: { aspect: string; pele: string; ours: string }[];
  leak_cases: number;
  matches: PeleMatch[];
  ratings: TeamRating[];
};

export const pelePage = raw as unknown as PelePageData;

export const STAGE_LABEL: Record<string, string> = {
  group: "Group",
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarterfinal",
  SF: "Semifinal",
  F: "Final",
  Champion: "Champion",
};

export const OUTCOME_LABEL = ["Home win", "Draw", "Away win"] as const;

// Forecaster identity colors: the site's validated chart tokens (dataviz
// validate_palette.js, dark surface #111111, all checks PASS). Color follows
// the forecaster everywhere on the page.
export const FORECASTER = {
  ours: { name: "Our model", color: "var(--chart-1)" },
  pele: { name: "PELE", color: "var(--chart-2)" },
  market: { name: "Bookmakers", color: "var(--chart-4)" },
  // A transformed forecast (blend / temperature-scaled) is neutral light ink,
  // not a new hue: it is never plotted next to an outcome color, and purple
  // failed CVD separation against PELE's blue.
  adjusted: { name: "Adjusted", color: "#d6d6d6" },
} as const;

// Outcome colors for W/D/L encodings. Home/away pair validated separately
// (PASS); draw is the neutral midpoint (gray) and is also dashed/labelled.
export const OUTCOME_COLOR = ["#a379e8", "#888888", "#d9634e"] as const;

export const DATAWRAPPER_VERSION_URL = (version: number) => `https://datawrapper.dwcdn.net/3bTOr/${version}/dataset.csv`;

export function fmtUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function signed(v: number, digits = 3): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(digits)}`;
}
