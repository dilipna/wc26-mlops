import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import ModelRegistryCard from "@/components/ModelRegistryCard";
import TrainingPipelineTimeline from "@/components/TrainingPipelineTimeline";
import DriftDashboard from "@/components/DriftDashboard";
import ProbabilityChart from "@/components/ProbabilityChart";
import ProofTracker from "@/components/ProofTracker";
import SystemHealthSection from "@/components/admin/SystemHealthSection";
import DataQualitySection from "@/components/admin/DataQualitySection";
import TrainingSection from "@/components/admin/TrainingSection";
import MonitoringSection from "@/components/admin/MonitoringSection";
import ObservabilitySection from "@/components/admin/ObservabilitySection";
import ReplayScrubber from "@/components/admin/ReplayScrubber";
import { GITHUB_URL, PRODUCT_NAME } from "@/lib/site";
import {
  backtest,
  dataQuality,
  drift,
  modelRegistry,
  predictions,
  proofTracker,
  seriesByTeam,
  summary,
  systemHealth,
  teams,
  trainingHistory,
} from "@/lib/data";

export default function AdminPage() {
  const perTeam = seriesByTeam();
  const chartTeams = teams.filter((t) => t.status === "alive").map((t) => t.team).slice(0, 8);

  const backtestModelLogLoss = Object.values(backtest)
    .flatMap((y) => Object.values(y.checkpoints))
    .map((c) => c.model.log_loss);
  const avgLogLoss = backtestModelLogLoss.length
    ? backtestModelLogLoss.reduce((a, b) => a + b, 0) / backtestModelLogLoss.length
    : null;

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-16">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-6">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-series-1">Internal &middot; read-only</div>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{PRODUCT_NAME} admin — football module</h1>
          <p className="mt-2 max-w-xl text-sm text-text-secondary">
            Everything below is read-only: no destructive actions or write endpoints are exposed here, even where
            the backing infra supports them.
          </p>
        </div>
        <Link href="/" className="font-mono text-xs text-series-1 hover:underline">
          &larr; back to the public site
        </Link>
      </div>

      <section id="system" className="py-8">
        <SectionHeading eyebrow="1 · System" title="API / DB / storage health" />
        <SystemHealthSection systemHealth={systemHealth} />
      </section>

      <section id="mlops" className="py-8">
        <SectionHeading eyebrow="2 · MLOps" title="Pipeline runs & schedule" subtitle="The real Airflow DAG task graph, not a diagram drawn by hand." />
        <TrainingPipelineTimeline
          lastDataRefresh={summary.generated_at}
          lastDriftCheck={drift.latest?.generated_at ?? null}
          lastDataQualityCheck={dataQuality.latest?.generated_at ?? null}
        />
      </section>

      <section id="models" className="py-8">
        <SectionHeading eyebrow="3 · Models" title="Production model & registry" />
        <ModelRegistryCard registry={modelRegistry} />
        <p className="mt-3 text-xs text-text-secondary">
          Precision/recall/F1/ROC-AUC aren&apos;t the natural fit here: Layer 1 outputs a 3-outcome probability
          distribution (win/draw/loss) each match, not a binary label, so this project tracks{" "}
          <strong className="text-foreground">Brier score and log-loss</strong> instead (avg backtest log-loss:{" "}
          {avgLogLoss !== null ? avgLogLoss.toFixed(3) : "n/a"} across 2018/2022 checkpoints — see Backtest on the
          public site for the full breakdown against baseline).
        </p>
      </section>

      <section id="training" className="py-8">
        <SectionHeading eyebrow="4 · Training" title="Training history, tuning, feature importance" />
        <TrainingSection trainingHistory={trainingHistory} teams={teams} />
      </section>

      <section id="monitoring" className="py-8">
        <SectionHeading eyebrow="5 · Monitoring" title="Latency, traffic, containers" />
        <MonitoringSection />
      </section>

      <section id="data-quality" className="py-8">
        <SectionHeading eyebrow="6 · Data quality" title="Missing values, schema, duplicates, drift" />
        <div className="space-y-6">
          <DataQualitySection dataQuality={dataQuality} />
          <DriftDashboard drift={drift} />
        </div>
      </section>

      <section id="predictions" className="py-8">
        <SectionHeading eyebrow="7 · Predictions" title="History, confidence, bracket evolution" />
        <div className="space-y-6">
          <ProbabilityChart seriesByTeam={perTeam} teams={chartTeams} />
          <ProofTracker data={proofTracker} />
          <div className="glass-card p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              Replay (seed of Phase 6 &mdash; life after the tournament)
            </div>
            <div className="mt-3">
              <ReplayScrubber predictions={predictions} />
            </div>
          </div>
        </div>
      </section>

      <section id="observability" className="py-8">
        <SectionHeading eyebrow="8 · Observability" title="Metrics, traces, deployments" />
        <ObservabilitySection />
      </section>

      <footer className="mt-10 border-t border-border pt-6 font-mono text-xs text-text-muted">
        Built by Dilip &middot;{" "}
        <a href={GITHUB_URL} className="text-series-1 hover:underline">
          code on GitHub
        </a>
      </footer>
    </main>
  );
}
