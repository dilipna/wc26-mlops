import Link from "next/link";
import cards from "../../data/sport_replays.json";
const names: Record<string, string> = {
  basketball: "Basketball",
  nfl: "American football",
  cricket: "Cricket",
};
export default function PlatformIntro() {
  return (
    <section className="platform-intro" aria-labelledby="platform-title">
      <div className="platform-heading">
        <p className="replay-kicker">SPOPS / SPORTS MODEL LAB</p>
        <h2 id="platform-title">
          Pick a sport.
          <br />
          Question the forecast.
        </h2>
        <p>
          Matchups you can explore. Predictions you can replay. Evidence you can
          download.
        </p>
        <Link href="/football">Explore the football archive →</Link>
        <Link href="/engineering">How model decisions are checked →</Link>
      </div>
      <div className="platform-cards">
        {cards.map((c, i) => (
          <Link
            key={c.sport}
            href={`/${c.sport === "nfl" ? "nfl" : c.sport}`}
            className="platform-card"
          >
            <span className="replay-kicker">0{i + 1} / HISTORICAL REPLAY</span>
            <h2>{names[c.sport]}</h2>
            <p>
              {c.sport === "basketball"
                ? "NBA"
                : c.sport === "cricket"
                  ? "IPL"
                  : "NFL"}{" "}
              · Data through {c.as_of}
            </p>
            <strong>
              {c.model_metrics.n.toLocaleString("en-US")} evaluated matches
            </strong>
            <span>Try a matchup & inspect the model ↗</span>
          </Link>
        ))}
      </div>
      <p className="platform-boundary">
        Historical research tools, not current live feeds. Each page shows its
        data date, method, baseline and limitations. The cricket baseline
        outperformed Elo; that result stays visible.
      </p>
    </section>
  );
}
