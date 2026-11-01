import Link from "next/link";
import cards from "../../data/sport_replays.json";
const names: Record<string, string> = {
  basketball: "Basketball",
  nfl: "American football",
  cricket: "Cricket",
};
const marks: Record<string, string> = {
  basketball: "◉",
  nfl: "◈",
  cricket: "◒",
};
export default function PlatformIntro({ page = false }: { page?: boolean }) {
  const Heading = page ? "h1" : "h2";
  const CardHeading = page ? "h2" : "h3";
  return (
    <section
      className={`platform-intro ${page ? "platform-models-hub" : "platform-intro-compact"}`}
      aria-labelledby="platform-title"
    >
      <div className="platform-heading">
        <div>
          <p className="replay-kicker">HISTORICAL MODEL LABS</p>
          <Heading id="platform-title">Go beyond the score.</Heading>
          <p>
            Explore a matchup, replay a forecast and see how the model was
            tested.
          </p>
        </div>
        <Link href={page ? "/engineering" : "/models"}>
          {page
            ? "How model decisions are checked ↗"
            : "Explore all model labs ↗"}
        </Link>
      </div>
      <div className="platform-cards">
        {cards.map((c) => (
          <Link key={c.sport} href={`/${c.sport}`} className="platform-card">
            <div className="platform-card-top">
              <span
                className={`platform-sport-mark platform-mark-${c.sport}`}
                aria-hidden="true"
              >
                {marks[c.sport]}
              </span>
              <span className="platform-history-tag">Historical research</span>
            </div>
            <CardHeading>{names[c.sport]}</CardHeading>
            <p>
              {c.sport === "basketball"
                ? "NBA"
                : c.sport === "cricket"
                  ? "IPL"
                  : "NFL"}{" "}
              · Data through {c.as_of}
            </p>
            <div className="platform-card-evidence">
              <strong>{c.model_metrics.n.toLocaleString("en-US")}</strong>
              <span>evaluated matches</span>
            </div>
            <span className="platform-card-cta">
              Open matchup workbench <b aria-hidden="true">↗</b>
            </span>
          </Link>
        ))}
      </div>
      {page && (
        <div className="platform-more-labs">
          <Link href="/football">
            <strong>Football / WC26 archive ↗</strong>
            <span>Stored forecasts, calibration and lifecycle evidence.</span>
          </Link>
          <Link href="/pele">
            <strong>Football ratings study ↗</strong>
            <span>Explore the historical Pelé ratings and research tools.</span>
          </Link>
          <Link href="/engineering">
            <strong>Model release decisions ↗</strong>
            <span>See rejected candidates and retained negative results.</span>
          </Link>
        </div>
      )}
      <p className="platform-boundary">
        Historical tools are separate from current score snapshots. Each lab
        shows its data date, method and limitations. The cricket baseline
        outperformed Elo; that result remains visible.
      </p>
    </section>
  );
}
