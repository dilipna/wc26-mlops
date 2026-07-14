import predictionsRaw from "../../data/predictions_timeseries.json";
import proofLedgerRaw from "../../data/proof_ledger.json";
import backtestRaw from "../../data/backtest.json";
import resultsRaw from "../../data/results.json";
import upcomingRaw from "../../data/upcoming_matches.json";
import summaryRaw from "../../data/summary.json";
import proofTrackerRaw from "../../data/proof_tracker.json";
import teamsRaw from "../../data/teams.json";
import modelRegistryRaw from "../../data/model_registry.json";
import driftRaw from "../../data/drift.json";
import dataQualityRaw from "../../data/data_quality.json";
import systemHealthRaw from "../../data/system_health.json";
import trainingHistoryRaw from "../../data/training_history.json";

export type PredictionRow = {
  date: string;
  team: string;
  win_probability: number;
  model_version: string;
};

export type MatchResult = {
  date: string;
  home_team: string;
  away_team: string;
  home_score: string;
  away_score: string;
};

export type UpcomingMatch = {
  commence_time: string;
  home_team: string;
  away_team: string;
  model: { home_win: number; draw: number; away_win: number };
  bookmaker: Record<string, number>;
};

export type BacktestCheckpoint = {
  as_of: string;
  model: { team_probs: Record<string, number>; champion_prob: number; brier: number; log_loss: number };
  baseline: { team_probs: Record<string, number>; champion_prob: number; brier: number; log_loss: number };
};

export type BacktestYear = {
  year: number;
  champion: string;
  n_sims: number;
  checkpoints: Record<string, BacktestCheckpoint>;
};

export type OutcomeKey = "home_win" | "draw" | "away_win";

export type GradedMatch = {
  home_team: string;
  away_team: string;
  commence_time: string;
  logged_at: string;
  home_score: number;
  away_score: number;
  actual_outcome: OutcomeKey;
  model: Record<OutcomeKey, number>;
  model_predicted_outcome: OutcomeKey;
  model_correct: boolean;
  model_brier: number;
  bookmaker: Record<OutcomeKey, number> | null;
  bookmaker_predicted_outcome: OutcomeKey | null;
  bookmaker_correct: boolean | null;
  bookmaker_brier: number | null;
};

export type ProofTrackerData = {
  generated_at: string | null;
  graded_matches: GradedMatch[];
  summary: {
    n_graded: number;
    model_accuracy: number | null;
    model_avg_brier: number | null;
    n_bookmaker_graded: number;
    bookmaker_accuracy: number | null;
    bookmaker_avg_brier: number | null;
  };
  calibration: {
    bucket_label: string;
    predicted_mid: number;
    n: number;
    actual_rate: number | null;
  }[];
};

export type TeamStatus = {
  team: string;
  status: "alive" | "eliminated";
  current_probability: number | null;
};

export type ModelRegistry = {
  registered_model_name: string;
  feature_names: string[];
  mlflow_reachable: boolean;
  version: string | null;
  run_id: string | null;
  trained_at: string | null;
  params: Record<string, string>;
  metrics: Record<string, number>;
  member_influence: Record<string, number>;
};

export type DriftColumnInfo = {
  drift_detected: boolean;
  drift_score: number;
  stattest_name: string;
};

export type DriftSnapshot = {
  generated_at: string;
  reference_window: [string, string];
  current_window: [string, string];
  reference_rows: number;
  current_rows: number;
  dataset_drift: boolean;
  share_of_drifted_columns: number;
  number_of_drifted_columns: number;
  number_of_columns: number;
  columns: Record<string, DriftColumnInfo>;
};

export type DriftHistoryRow = {
  generated_at: string;
  reference_rows: string;
  current_rows: string;
  dataset_drift: string;
  share_of_drifted_columns: string;
  [key: string]: string; // per-feature `${col}_drift_score` / `${col}_drift_detected`
};

export type DriftData = {
  latest: DriftSnapshot | null;
  history: DriftHistoryRow[];
};

export type DataQualitySnapshot = {
  generated_at: string;
  missing_values: Record<string, { missing: number; total: number; pct: number }>;
  schema: {
    columns_present: Record<string, boolean>;
    dtype_mismatches: Record<string, { expected: string; actual: string }>;
    extra_columns: string[];
    valid: boolean;
  };
  duplicates_before_dedup: { duplicate_rows: number; duplicate_keys: number; total_rows: number };
  historical_live_overlap: { historical_count: number; live_count: number; overlap_count: number };
};

export type DataQualityHistoryRow = {
  generated_at: string;
  total_rows: string;
  schema_valid: string;
  duplicate_rows: string;
  historical_count: string;
  live_count: string;
  overlap_count: string;
};

export type DataQualityData = {
  latest: DataQualitySnapshot | null;
  history: DataQualityHistoryRow[];
};

export type SystemHealth = {
  generated_at: string;
  mlflow_reachable: boolean;
  supabase_reachable: boolean;
};

export type TrainingRun = {
  run_id: string;
  run_name: string;
  status: string;
  start_time: string | null;
  params: Record<string, string>;
  metrics: Record<string, number>;
};

export type LedgerProvenance = {
  recorded_pre_match: boolean;
  first_public_commit: string;
  committed_at: string;
  file: string;
  committed_model_probs: Record<OutcomeKey, number>;
  github_url: string;
  github_commit_url: string;
};

export type LedgerEntry = {
  id: string;
  match: { home_team: string; away_team: string; commence_time: string };
  prediction: {
    logged_at: string | null;
    model: Record<OutcomeKey, number>;
    market: Record<OutcomeKey, number> | null;
    model_pick: OutcomeKey;
    market_pick: OutcomeKey | null;
    disagreement: boolean;
    divergence: number | null;
  };
  result: { home_score: number; away_score: number; actual_outcome: OutcomeKey } | null;
  grading: {
    model_correct: boolean;
    market_correct: boolean | null;
    model_brier: number;
    market_brier: number | null;
  } | null;
  provenance: LedgerProvenance | null;
  note?: string;
  prev_hash: string;
  entry_hash: string;
};

export type ProofLedger = {
  version: string;
  generated_at: string;
  repo: string;
  how_to_verify: string[];
  summary: {
    n_entries: number;
    n_graded: number;
    n_pending: number;
    model_accuracy: number | null;
    market_accuracy: number | null;
    model_avg_brier: number | null;
    market_avg_brier: number | null;
    n_disagreements: number;
    model_won_disagreements: number;
    best_call: string | null;
    n_with_git_provenance: number;
  };
  entries: LedgerEntry[];
};

export const predictions = predictionsRaw as unknown as PredictionRow[];
export const proofLedger = proofLedgerRaw as unknown as ProofLedger;
export const dataQuality = dataQualityRaw as unknown as DataQualityData;
export const systemHealth = systemHealthRaw as unknown as SystemHealth;
export const trainingHistory = trainingHistoryRaw as unknown as TrainingRun[];
export const proofTracker = proofTrackerRaw as unknown as ProofTrackerData;
export const teams = teamsRaw as unknown as TeamStatus[];
export const backtest = backtestRaw as unknown as Record<string, BacktestYear>;
export const results = resultsRaw as unknown as MatchResult[];
export const upcomingMatches = upcomingRaw as unknown as UpcomingMatch[];
export const modelRegistry = modelRegistryRaw as unknown as ModelRegistry;
export const drift = driftRaw as unknown as DriftData;

export const summary = summaryRaw as unknown as {
  generated_at: string;
  latest_predictions_date: string | null;
  primary_series?: string;
  top_favorites: PredictionRow[];
  completed_results_count: number;
  upcoming_matches_count: number;
};

// The predictions log holds several timestamped series side by side,
// keyed by model_version. The model's own Layer 2 output is the
// centerpiece; the bookmaker outright market is the benchmark (and the
// only series that existed before 2026-07-04).
export const MODEL_SERIES = "stacked_l2_montecarlo_v1";
export const BOOKMAKER_SERIES = "bookmaker_outright_baseline_v1";

export function seriesByTeam(modelVersion?: string): Map<string, PredictionRow[]> {
  const version =
    modelVersion ??
    (predictions.some((r) => r.model_version === MODEL_SERIES) ? MODEL_SERIES : BOOKMAKER_SERIES);
  const map = new Map<string, PredictionRow[]>();
  for (const row of predictions) {
    if (row.model_version !== version) continue;
    const list = map.get(row.team) ?? [];
    list.push(row);
    map.set(row.team, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}

// Per-team series lookup for the country dropdown: unlike seriesByTeam
// (which picks one series for the whole app), a team eliminated before
// the model's own Layer 2 series existed (2026-07-04) may only have
// bookmaker-series history -- fall back per-team, not globally.
export function seriesForTeam(team: string): PredictionRow[] {
  const modelRows = predictions.filter((r) => r.team === team && r.model_version === MODEL_SERIES);
  const rows = modelRows.length > 0 ? modelRows : predictions.filter((r) => r.team === team && r.model_version === BOOKMAKER_SERIES);
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export const CHECKPOINT_ORDER = ["post_group", "post_r16", "post_qf", "post_sf"] as const;
export const CHECKPOINT_LABELS: Record<string, string> = {
  post_group: "After Groups",
  post_r16: "After R16",
  post_qf: "After QF",
  post_sf: "After SF",
};
