import type { DataQualityData } from "@/lib/data";

export default function DataQualitySection({ dataQuality }: { dataQuality: DataQualityData }) {
  const latest = dataQuality.latest;

  if (!latest) {
    return (
      <div className="glass-card p-6 text-sm text-text-secondary">
        No data-quality check has run yet -- run <code className="font-mono">python scripts/check_data_quality.py</code>.
      </div>
    );
  }

  const missingRows = Object.entries(latest.missing_values);
  const totalMissing = missingRows.reduce((sum, [, v]) => sum + v.missing, 0);

  return (
    <div className="glass-card p-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Schema</div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`status-dot ${latest.schema.valid ? "status-dot--good" : "status-dot--critical"}`} />
            <span className="font-mono text-sm text-foreground">{latest.schema.valid ? "valid" : "mismatch detected"}</span>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {Object.keys(latest.schema.columns_present).length} expected columns checked against the combined
            historical + live match data.
          </p>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Missing values</div>
          <div className="mt-1 font-mono text-sm text-foreground">{totalMissing} cells across {missingRows.length} columns</div>
          <p className="mt-1 text-xs text-text-secondary">
            {totalMissing === 0 ? "Zero missing values in the combined match dataset." : "See breakdown below."}
          </p>
        </div>

        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Historical / live overlap</div>
          <div className="mt-1 font-mono text-sm text-foreground">
            {latest.historical_live_overlap.overlap_count} of {latest.historical_live_overlap.live_count}
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Live-ingested 2026 matches already present in the periodically-refreshed historical CSV -- deduplicated
            by <code className="font-mono">load_combined_matches()</code> before training (see DECISIONS.md: a real
            double-counting bug this check exists to catch a regression of).
          </p>
        </div>
      </div>

      {latest.schema.extra_columns.length > 0 && (
        <div className="mt-4 text-xs text-text-secondary">
          Extra columns beyond the expected schema: {latest.schema.extra_columns.join(", ")}
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">Duplicate keys (pre-dedup)</div>
        <p className="mt-1 text-xs text-text-secondary">
          {latest.duplicates_before_dedup.duplicate_keys} duplicate (date, home_team, away_team) key(s) across{" "}
          {latest.duplicates_before_dedup.total_rows.toLocaleString()} combined rows, before the training
          pipeline&apos;s own dedup runs.
        </p>
      </div>
    </div>
  );
}
