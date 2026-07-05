import StatusBar from "@/components/StatusBar";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import FavoritesLeaderboard from "@/components/FavoritesLeaderboard";
import ProbabilityChart from "@/components/ProbabilityChart";
import UpcomingMatches from "@/components/UpcomingMatches";
import CountryLookup from "@/components/CountryLookup";
import ResultsTicker from "@/components/ResultsTicker";
import ProofTracker from "@/components/ProofTracker";
import ModelValidation from "@/components/ModelValidation";
import LiveInferenceConsole from "@/components/LiveInferenceConsole";
import ModelCard from "@/components/ModelCard";
import ModelRegistryCard from "@/components/ModelRegistryCard";
import TrainingPipelineTimeline from "@/components/TrainingPipelineTimeline";
import DriftDashboard from "@/components/DriftDashboard";
import CicdSection from "@/components/CicdSection";
import Footer from "@/components/Footer";
import {
  backtest,
  drift,
  modelRegistry,
  proofTracker,
  results,
  seriesByTeam,
  summary,
  teams,
  upcomingMatches,
} from "@/lib/data";

export default function Home() {
  const favorites = summary.top_favorites;
  const perTeam = seriesByTeam();
  const chartTeams = favorites.map((f) => f.team).slice(0, 6);
  const teamNames = teams.map((t) => t.team);

  return (
    <main className="relative">
      <StatusBar />
      <Hero topFavorite={favorites[0]} latestDate={summary.latest_predictions_date} />

      {/* ---------- The predictions ---------- */}

      <section id="leaderboard" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading
          eyebrow="Today's odds"
          title="Who takes the trophy?"
          subtitle="Every remaining team's chance of winning it all, refreshed each morning."
        />
        <FavoritesLeaderboard favorites={favorites} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading
          eyebrow="Day by day"
          title="The race, charted"
          subtitle="One point per team, per day — watch the favorites rise and fall as real results land."
        />
        <ProbabilityChart seriesByTeam={perTeam} teams={chartTeams} />
      </section>

      <section id="fixtures" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading
          eyebrow="Up next"
          title="My model vs the market"
          subtitle="For every upcoming match: my prediction next to the bookmakers'."
        />
        <UpcomingMatches matches={upcomingMatches} />
      </section>

      <section id="country" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading eyebrow="Find your team" title="Check your country" />
        <CountryLookup teams={teams} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        <ResultsTicker results={results} />
      </section>

      {/* ---------- The proof ---------- */}

      <div className="relative z-10 mx-auto max-w-6xl border-t border-border px-6 pt-16 pb-2">
        <p className="max-w-xl text-[15px] leading-relaxed text-text-secondary">
          Everything above comes from a system I built and operate end to end — ingestion,
          training, simulation, deployment, monitoring. Here&apos;s the proof it works.
        </p>
      </div>

      <section id="performance" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading
          eyebrow="Track record"
          title="Graded against reality"
          subtitle="I log every prediction before kickoff and grade it once the match ends — no cherry-picking, no hindsight."
        />
        <ProofTracker data={proofTracker} />
      </section>

      <section id="backtest" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading
          eyebrow="Backtested"
          title="Tested on 2018 and 2022 first"
          subtitle="Before touching live data, I replayed two whole World Cups. The eventual champion's predicted chances climbed round after round in both."
        />
        <ModelValidation backtest={backtest} />
      </section>

      <section id="inference" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading
          eyebrow="Live demo"
          title="Call the model yourself"
          subtitle="This hits the deployed API from your browser — the request ID and latency below are the actual round trip, not mocked."
        />
        <LiveInferenceConsole teams={teamNames} />
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading eyebrow="Method" title="How it works" />
        <ModelCard />
      </section>

      <section id="engineering" className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <SectionHeading
          eyebrow="Engineering"
          title="Under the hood"
          subtitle="The model retrains and re-registers in MLflow daily, an Airflow DAG runs the pipeline, and Evidently watches for feature drift."
        />
        <div className="space-y-6">
          <ModelRegistryCard registry={modelRegistry} />
          <TrainingPipelineTimeline
            lastDataRefresh={summary.generated_at}
            lastDriftCheck={drift.latest?.generated_at ?? null}
          />
          <DriftDashboard drift={drift} />
          <CicdSection />
        </div>
      </section>

      <Footer />
    </main>
  );
}
