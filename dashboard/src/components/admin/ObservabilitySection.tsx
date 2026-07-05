import { REPO } from "@/lib/site";

export default function ObservabilitySection() {
  return (
    <div className="glass-card p-6">
      <p className="text-sm text-text-secondary">
        <strong className="text-foreground">Not yet implemented.</strong> Prometheus/Grafana, centralized structured
        logs, and alerting are Tier 3 (CLAUDE.md) -- not prioritized ahead of the two Tier 1/2 mission gaps this
        project&apos;s own audit trail (PROJECT_BRAIN.md) tracks. Not faking a metrics dashboard to check a box.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          href={`https://github.com/${REPO}/actions`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text-secondary hover:text-foreground"
        >
          Real recent deployments &rarr; GitHub Actions run history
        </a>
        <a
          href={`https://github.com/${REPO}/blob/main/docker-compose.airflow.yml`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-text-secondary hover:text-foreground"
        >
          Real health checks &rarr; docker-compose.airflow.yml
        </a>
      </div>
    </div>
  );
}
