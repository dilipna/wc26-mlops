import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import FavoritesLeaderboard from "@/components/FavoritesLeaderboard";
import ProbabilityChart from "@/components/ProbabilityChart";
import UpcomingMatches from "@/components/UpcomingMatches";
import ProofLedgerShowcase from "@/components/ProofLedgerShowcase";
import CompletedShowcase from "@/components/CompletedShowcase";
import CountryLookup from "@/components/CountryLookup";
import ModelValidation from "@/components/ModelValidation";
import MethodologySection from "@/components/MethodologySection";
import StatsStrip from "@/components/StatsStrip";
import ResultsTicker from "@/components/ResultsTicker";
import TechStack from "@/components/TechStack";
import Footer from "@/components/Footer";
import {
  backtest,
  proofLedger,
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

  const stats = [
    { label: "Matches tracked live", value: String(summary.completed_results_count) },
    { label: "Next matches predicted", value: String(summary.upcoming_matches_count) },
    { label: "Tournament simulations a day", value: "10,000" },
    { label: "Past World Cups tested", value: "2018 & 2022" },
  ];

  return (
    <main className="relative">
      <Nav />
      <Hero topFavorite={favorites[0]} latestDate={summary.latest_predictions_date} />

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <StatsStrip stats={stats} />
      </section>

      <section id="leaderboard" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Live Tracker"
          title="Who Takes The Trophy?"
          subtitle="Every remaining team's chance of winning it all, refreshed daily. Right now these numbers come from the global market; our own simulator's numbers join this board once the knockout bracket is locked in -- see the note below."
        />
        <FavoritesLeaderboard favorites={favorites} />
      </section>

      <section id="country" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Find Your Team"
          title="Check Your Country"
          subtitle="Every one of the 48 teams: still alive or eliminated, and how their odds have moved."
        />
        <CountryLookup teams={teams} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Day By Day"
          title="The Race, Charted"
          subtitle="One point per team, per day. Watch the favorites rise and fall as real results land -- and see who the data backed once the champion is crowned."
        />
        <ProbabilityChart seriesByTeam={perTeam} teams={chartTeams} />
      </section>

      <section id="fixtures" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Up Next"
          title="Our AI vs The World"
          subtitle="For every upcoming match: our prediction, right next to what the rest of the world expects."
        />
        <UpcomingMatches matches={upcomingMatches} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Just Finished"
          title="Latest Results"
          subtitle="Every final score below feeds straight into tomorrow's ratings."
        />
        <ResultsTicker results={results} />
      </section>

      <section id="proof" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Verified Track Record"
          title="Don't Trust Us. Check."
          subtitle="Every prediction is committed to a public, SHA-timestamped git history BEFORE kickoff, hash-chained so it can't be quietly edited, and graded against the market once the match ends. The receipts are one click away."
        />
        <ProofLedgerShowcase ledger={proofLedger} />
      </section>

      <CompletedShowcase />

      <section id="backtest" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Backtested"
          title="Tested On Real History"
          subtitle="Before trusting it with 2026, we replayed the 2018 and 2022 World Cups from the group stage onward. The eventual champion's predicted chances climbed round after round in both -- and beat a simple world-ranking guess on average."
        />
        <ModelValidation backtest={backtest} />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading eyebrow="Under the Hood" title="How It Works" />
        <MethodologySection />
      </section>

      <section id="stack" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading
          eyebrow="Behind The Scenes"
          title="What Powers This Site"
          subtitle="Every tool used to build what you're looking at -- from the models to the pixels."
        />
        <TechStack />
      </section>

      <Footer />
    </main>
  );
}
