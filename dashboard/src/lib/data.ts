import predictionsRaw from "../../data/predictions_timeseries.json";
import backtestRaw from "../../data/backtest.json";
import resultsRaw from "../../data/results.json";
import upcomingRaw from "../../data/upcoming_matches.json";
import summaryRaw from "../../data/summary.json";

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

export const predictions = predictionsRaw as unknown as PredictionRow[];
export const backtest = backtestRaw as unknown as Record<string, BacktestYear>;
export const results = resultsRaw as unknown as MatchResult[];
export const upcomingMatches = upcomingRaw as unknown as UpcomingMatch[];
export const summary = summaryRaw as unknown as {
  generated_at: string;
  latest_predictions_date: string | null;
  top_favorites: PredictionRow[];
  completed_results_count: number;
  upcoming_matches_count: number;
};

export function seriesByTeam(): Map<string, PredictionRow[]> {
  const map = new Map<string, PredictionRow[]>();
  for (const row of predictions) {
    const list = map.get(row.team) ?? [];
    list.push(row);
    map.set(row.team, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return map;
}

export const CHECKPOINT_ORDER = ["post_group", "post_r16", "post_qf", "post_sf"] as const;
export const CHECKPOINT_LABELS: Record<string, string> = {
  post_group: "After Groups",
  post_r16: "After R16",
  post_qf: "After QF",
  post_sf: "After SF",
};
