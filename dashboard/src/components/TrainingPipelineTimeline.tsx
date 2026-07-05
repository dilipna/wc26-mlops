const REPO = "dilipna/wc26-mlops";
const DAG_PATH = "src/orchestration/dags/wc26_daily_pipeline.py";

function TaskNode({ label, path }: { label: string; path?: string }) {
  const content = (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground">
      {label}
    </div>
  );
  if (!path) return content;
  return (
    <a href={`https://github.com/${REPO}/blob/main/${path}`} target="_blank" rel="noreferrer" className="hover:opacity-80">
      {content}
    </a>
  );
}

function Arrow() {
  return <span className="font-mono text-text-muted">&rarr;</span>;
}

export default function TrainingPipelineTimeline({
  lastDataRefresh,
  lastDriftCheck,
}: {
  lastDataRefresh: string | null;
  lastDriftCheck: string | null;
}) {
  return (
    <div className="glass-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-xs text-text-secondary">
          DAG <span className="text-foreground">wc26_daily_pipeline</span> &middot; schedule{" "}
          <span className="text-foreground">0 6 * * * UTC</span>
        </div>
        <a
          href={`https://github.com/${REPO}/blob/main/${DAG_PATH}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-series-1 hover:underline"
        >
          view DAG source &rarr;
        </a>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <TaskNode label="daily_update.py" path="scripts/daily_update.py" />
        <Arrow />
        <TaskNode label="verify_predictions.py" path="scripts/verify_predictions.py" />
        <Arrow />
        <TaskNode label="export_dashboard_data.py" path="scripts/export_dashboard_data.py" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 pl-0 sm:pl-[calc(11ch+1.25rem)]">
        <span className="font-mono text-[11px] text-text-muted">(parallel branch)</span>
        <Arrow />
        <TaskNode label="check_drift.py" path="scripts/check_drift.py" />
      </div>

      <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
        <div className="font-mono text-xs">
          <div className="text-text-muted">Last successful data refresh</div>
          <div className="mt-1 text-foreground">{lastDataRefresh ?? "unknown"}</div>
        </div>
        <div className="font-mono text-xs">
          <div className="text-text-muted">Last drift check</div>
          <div className="mt-1 text-foreground">{lastDriftCheck ?? "not yet run"}</div>
        </div>
      </div>

      <p className="mt-4 text-xs text-text-muted">
        Runs in the project&apos;s docker-compose Airflow stack; timestamps come from the last successful run.
      </p>
    </div>
  );
}
