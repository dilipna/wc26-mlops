// The ONLY source of truth for which sports exist, which are active,
// and which are completed (Section: multi-sport architecture). No sport
// name is hardcoded in any component -- everything renders from this
// config, so flipping is_active to false moves a sport to the Completed
// showcase with zero code changes.
import sportsConfigRaw from "../../public/sports_config.json";

export type SportConfig = {
  id: string;
  name: string;
  short: string;
  path: string;
  is_active: boolean;
  is_live: boolean;
  start_date?: string;
  end_date?: string;
};

export const SPORTS = (sportsConfigRaw as { sports: SportConfig[] }).sports;

export const activeSports = () => SPORTS.filter((s) => s.is_active);
export const completedSports = () => SPORTS.filter((s) => !s.is_active);
export const sportByPath = (path: string) => SPORTS.find((s) => s.path === path);

// LIVE while the sport is flagged live and its end date (if any) hasn't
// passed; FINAL once the end date is behind us. Date comparison is done
// in UTC against the build/render date -- the daily pipeline rebuilds the
// site every day, so this stays current without client-side clocks.
export function liveBadge(sport: SportConfig, today = new Date()): "LIVE" | "FINAL" | null {
  if (sport.end_date && today.toISOString().slice(0, 10) > sport.end_date) return "FINAL";
  return sport.is_live ? "LIVE" : null;
}
