import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import FavoritesLeaderboard from "@/components/FavoritesLeaderboard";
import ProbabilityChart from "@/components/ProbabilityChart";
import UpcomingMatches from "@/components/UpcomingMatches";
import ModelValidation from "@/components/ModelValidation";
import MethodologySection from "@/components/MethodologySection";
import StatsStrip from "@/components/StatsStrip";
import ResultsTicker from "@/components/ResultsTicker";
import Footer from "@/components/Footer";
import {
  backtest,
  results,
  seriesByTeam,
  summary,
  upcomingMatches,
} from "@/lib/data";

export default function Home() {
  const favorites = summary.top_favorites;
  const perTeam = seriesByTeam();
  const chartTeams = favorites.map((f) => f.team).slice(0, 6);

  const stats = [
    { label: "Live results tracked", value: String(summary.completed_results_count) },
    { label: "Upcoming fixtures scored", value: String(summary.upcoming_matches_count) },
    { label: "Monte Carlo sims / checkpoint", value: "10,000" },
    { label: "Backtest tournaments", value: "2018 & 2022" },
  ];

  return (
    <main className="relative">
      <Hero topFavorite={favorites[0]} latestDate={summary.latest_predictions_date} />

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <StatsStrip stats={stats} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Live Tracker"
          title="The Contenders"
          subtitle="Each team's implied chance of lifting the trophy, distilled from the global market and updated daily. Our own Layer 2 tournament simulation joins this board once the knockout bracket is fully live -- see the note below."
        />
        <FavoritesLeaderboard favorites={favorites} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Prediction Market"
          title="Probability Over Time"
          subtitle="Every day of the tournament adds one point per team to this series -- the genuine time series at the heart of this project, watched against the eventual real champion."
        />
        <ProbabilityChart seriesByTeam={perTeam} teams={chartTeams} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Up Next"
          title="Upcoming Fixtures"
          subtitle="Our Layer 1 ensemble vs. the market's own expectations, side by side for every remaining fixture."
        />
        <UpcomingMatches matches={upcomingMatches} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Recent Results"
          title="What Just Happened"
          subtitle="Completed matches feeding today's ratings and predictions."
        />
        <ResultsTicker results={results} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Phase 0 Validation"
          title="Does This Actually Work?"
          subtitle="Before trusting any live output, the full two-layer pipeline was backtested against the 2018 and 2022 World Cups: does the eventual champion's simulated win probability rise as the tournament goes on, and does it beat a naive FIFA-ranking baseline?"
        />
        <ModelValidation backtest={backtest} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading eyebrow="How It Works" title="Two Layers, One Question" />
        <MethodologySection />
      </section>

      <Footer />
    </main>
  );
}
