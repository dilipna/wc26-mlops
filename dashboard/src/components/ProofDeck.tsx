import Link from "next/link";
import cards from "../../data/sport_replays.json";

export default function ProofDeck() {
  const count = cards.reduce((total, card) => total + card.model_metrics.n, 0);
  return (
    <section id="platform-proof" className="proof-deck" aria-labelledby="proof-title">
      <div className="proof-heading">
        <div><p className="replay-kicker">THE EVIDENCE, WITH THE EXPERIENCE</p>
          <h2 id="proof-title">Every claim has a way back.</h2>
          <p>Enjoy the game first. Open the record whenever you want to check the call.</p></div>
        <Link href="/engineering">Explore the evidence ↗</Link>
      </div>
      <div className="proof-grid">
        <Link href="/models"><span className="proof-number">{count.toLocaleString("en-US")}</span>
          <h3>Historical matches. Replayed.</h3><p>Inspect the forecast, reveal the result and download its receipt.</p><b>Open the model labs ↗</b></Link>
        <Link href="/engineering"><span className="proof-number">The misses stay.</span>
          <h3>Better evidence beats a better story.</h3><p>Rejected models and baseline wins remain visible alongside the results.</p><b>Inspect the decisions ↗</b></Link>
        <a href="/release.json" download="spops-release.json"><span className="proof-number">Trace the build.</span>
          <h3>A receipt for the website, too.</h3><p>Download the source commit and file fingerprints for this deployed release.</p><b>Download build receipt ↓</b></a>
      </div>
      <details><summary>What does this evidence establish?</summary>
        <p>Match records cite their provider and capture time. Historical model results use the dates and evaluation boundaries shown in each lab. File fingerprints establish build consistency, not independent truth, future accuracy or live coverage.</p>
        <a href="/proof/governance-rehearsal.json" download>Download the original model-decision record ↓</a>
      </details>
    </section>
  );
}
