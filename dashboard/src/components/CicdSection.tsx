import ArchitectureDiagram from "@/components/ArchitectureDiagram";

const REPO = "dilipna/wc26-mlops";

type LinkedItem = { label: string; detail: string; path: string };

const ITEMS: LinkedItem[] = [
  { label: "CI on every push", detail: "Fresh install, 34 tests, dashboard lint + build", path: ".github/workflows/ci.yml" },
  { label: "Daily Airflow DAG", detail: "Ingest → grade → export → drift check, 06:00 UTC", path: "src/orchestration/dags/wc26_daily_pipeline.py" },
  { label: "Dockerized stack", detail: "Postgres + Airflow + MLflow + serving, digest-pinned, health-checked", path: "docker-compose.airflow.yml" },
  { label: "Locked dependencies", detail: "Full transitive pins, resolved inside the Linux base image", path: "requirements-lock.txt" },
  { label: "Test suite", detail: "Ingestion, features, models, drift, serving, verification", path: "tests" },
  { label: "Decision log", detail: "Dated reasoning for every non-trivial choice, failures included", path: "DECISIONS.md" },
];

export default function CicdSection() {
  return (
    <div className="space-y-6">
      <ArchitectureDiagram />
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((item) => (
          <a
            key={item.path}
            href={`https://github.com/${REPO}/blob/main/${item.path}`}
            target="_blank"
            rel="noreferrer"
            className="glass-card block p-4 transition-colors hover:border-series-1/50"
          >
            <div className="font-mono text-xs font-semibold text-foreground">{item.label}</div>
            <div className="mt-1 text-[12px] text-text-secondary">{item.detail}</div>
            <div className="mt-2 font-mono text-[11px] text-series-1">{item.path} &rarr;</div>
          </a>
        ))}
      </div>
    </div>
  );
}
