export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 px-6 py-10 text-center text-sm text-white/40">
      <p>
        Built as an end-to-end MLOps portfolio project &mdash; ingestion, a stacked ML
        ensemble, Monte Carlo simulation, and this dashboard, all driven by a daily
        pipeline.
      </p>
      <p className="mt-2">
        <a
          href="https://github.com/dilipna/wc26-mlops"
          className="text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View the source on GitHub
        </a>
      </p>
      <p className="mt-4 text-xs text-white/25">
        Market data via The Odds API. Model probabilities are estimates, not betting
        advice.
      </p>
    </footer>
  );
}
