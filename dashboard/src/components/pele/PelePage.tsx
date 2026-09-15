"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";
import { pelePage } from "@/lib/pele/data";
import Overview from "./Overview";
import StatsLab from "./StatsLab";
import ModelLab from "./ModelLab";
import MatchExplorer from "./MatchExplorer";
import RatingsLab from "./RatingsLab";
import PowerCalculator from "./PowerCalculator";
import Audit from "./Audit";
import HowItWorks from "./HowItWorks";

const SECTIONS = [
  { id: "overview", label: "Result" },
  { id: "stats-lab", label: "Stats lab" },
  { id: "model-lab", label: "Model lab" },
  { id: "matches", label: "Matches" },
  { id: "ratings", label: "Ratings" },
  { id: "power", label: "Power" },
  { id: "audit", label: "Audit" },
  { id: "how-it-works", label: "How it works" },
];

export default function PelePage() {
  const h = pelePage.headline;
  return (
    <main className="relative">
      <Nav />

      {/* Hero: same structure and scale as the site's sport pages */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-4 pt-40">
        <h1 className="font-display text-[clamp(32px,6vw,72px)] font-black uppercase leading-[1.05] tracking-tight text-foreground">
          Our Model vs <span className="italic text-accent">PELE</span>
        </h1>
        <div
          className="font-mono mt-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] text-foreground"
          style={{ background: "linear-gradient(180deg, var(--accent-warm), var(--card-alt))" }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          2026 World Cup · {pelePage.matches.length} matches · pre-kickoff forecasts only
        </div>
        <p className="font-serif mt-6 max-w-3xl text-[15px] leading-relaxed text-foreground/60">
          PELE (&ldquo;Predictive Elo with Lineup Equilibria&rdquo;) is Nate Silver&apos;s international soccer model at Silver Bulletin. This page scores our
          stacked-ensemble forecasts against PELE&apos;s own published pre-kickoff numbers, match by match, with proper scoring rules and paired significance tests.
          The honest headline: on the {h.live.n} knockout matches both published live, ours scored {h.live.metrics.ours.rps.toFixed(3)} RPS to PELE&apos;s{" "}
          {h.live.metrics.pele.rps.toFixed(3)}; over all {h.replay.all.n} matches PELE scored {h.replay.all.metrics.pele.rps.toFixed(3)} to our{" "}
          {h.replay.all.metrics.replay.rps.toFixed(3)}. Neither gap is statistically distinguishable. Every number below is recomputed in your browser and can be
          traced to its source.
        </p>

        <nav aria-label="Sections" className="mt-8 -mx-6 overflow-x-auto px-6">
          <div className="flex w-max gap-1.5">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="font-mono rounded-md border border-foreground/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-foreground/55 transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </div>
        </nav>
      </section>

      <section id="overview" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="The Result" title="Head To Head" subtitle="Ranked Probability Score over win / draw / loss: lower is better. Two tracks, never mixed." />
        <Overview />
      </section>

      <section id="stats-lab" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="Interactive" title="Is The Gap Real?" subtitle="Rerun the significance tests yourself, on any subset, metric and comparison." />
        <StatsLab />
      </section>

      <section id="model-lab" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="Interactive" title="Blend & Calibrate" subtitle="Forecast combination and temperature scaling, with leave-one-out cross-validation." />
        <ModelLab />
      </section>

      <section id="matches" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="Receipts" title="Every Match" subtitle="Forecasts, results, and the provenance of each number." />
        <MatchExplorer />
      </section>

      <section id="ratings" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="Team Strength" title="Two Rating Systems" />
        <RatingsLab />
      </section>

      <section id="power" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="Sample Size" title="What One Tournament Can Tell You" />
        <PowerCalculator />
      </section>

      <section id="audit" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="Integrity" title="Audit" subtitle="The bug we found, what was excluded, and the claims we withdrew." />
        <Audit />
      </section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-12">
        <SectionHeading eyebrow="Under the Hood" title="How It Works" subtitle="Data sources, pipeline, statistics, the in-browser engine, and the frontend, exactly as implemented." />
        <HowItWorks />
      </section>

      <Footer />
    </main>
  );
}
