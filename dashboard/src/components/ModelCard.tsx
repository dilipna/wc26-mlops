const REPO = "dilipna/wc26-mlops";

const STEPS: { title: string; body: string }[] = [
  {
    title: "Rate every team",
    body: "Elo ratings, recent form, and FIFA rank — computed from international results since 1992, only ever using data available before each kickoff.",
  },
  {
    title: "Score every match",
    body: "A stacked ensemble (XGBoost + Elo logistic regression + a rank heuristic) turns those ratings into win/draw/loss probabilities.",
  },
  {
    title: "Play out the tournament",
    body: "10,000 Monte Carlo simulations of the actual remaining bracket, every day, give each team its chance of lifting the trophy.",
  },
  {
    title: "Check the work",
    body: "Before trusting it with 2026, I replayed the 2018 and 2022 World Cups — the model beat a world-ranking baseline in both. Live predictions get graded the same way.",
  },
];

export default function ModelCard() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <div key={step.title} className="glass-card p-5">
            <div className="font-mono text-xs text-series-1">0{i + 1}</div>
            <div className="mt-2 font-semibold text-foreground">{step.title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{step.body}</p>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-text-muted">
        Known limitations: no SHAP explanations yet, hyperparameter tuning hasn&apos;t beaten the defaults,
        and the free-tier API cold-starts in ~10s. I keep a dated log of every design decision — including
        the ones that didn&apos;t work — in{" "}
        <a
          href={`https://github.com/${REPO}/blob/main/DECISIONS.md`}
          target="_blank"
          rel="noreferrer"
          className="text-series-1 hover:underline"
        >
          DECISIONS.md
        </a>
        .
      </p>
    </div>
  );
}
