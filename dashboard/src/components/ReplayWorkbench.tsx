"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type ReplayCard = {
  sport: string;
  as_of: string;
  training_matches: number;
  evaluation_start: string;
  evaluation_end_exclusive: string;
  model_metrics: {
    n: number;
    log_loss: number;
    summed_brier: number;
    calibration: Bucket[];
  };
  baseline_metrics: { n: number; log_loss: number; summed_brier: number };
  artifact_sha256: string;
};
type Bucket = {
  lower: number;
  upper: number;
  n: number;
  mean_predicted: number | null;
  observed_frequency: number | null;
};
type Prediction = {
  match_id: string;
  date: string;
  side_a: string;
  side_b: string;
  side_a_won: number;
  probability_a: number;
  baseline_probability_a: number;
  rating_a_before: number;
  rating_b_before: number;
  home_advantage: number;
  pre_date_state_sha256: string;
};
type Replay = {
  schema: number;
  sport: string;
  as_of: string;
  ratings: {
    side: string;
    rating: number;
    matches: number;
    last_seen: string;
  }[];
  history: { date: string; ratings: Record<string, number> }[];
  predictions: Prediction[];
  baseline_probability_a: number;
  parameters: {
    k: number;
    initial: number;
    scale: number;
    home_advantage: number;
  };
  source: {
    url: string;
    credit: string;
    license: string;
    license_url: string;
    normalized_sha256: string;
    excluded: Record<string, number>;
  };
  identity: {
    protocol_sha256: string;
    data_sha256: string;
    source_sha: string;
    dirty_source: boolean;
  };
};
export const sportNames: Record<string, string> = {
  basketball: "Basketball / NBA",
  nfl: "American football / NFL",
  cricket: "Cricket / IPL",
};
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ReplayWorkbench({ card }: { card: ReplayCard }) {
  const [data, setData] = useState<Replay | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [neutral, setNeutral] = useState(true);
  const [day, setDay] = useState(0);
  const [match, setMatch] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/replays/${card.sport}.json`, {
          signal: controller.signal,
        });
        if (!response.ok) throw Error("Replay snapshot could not be loaded.");
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 8 * 1024 * 1024)
          throw Error("Replay snapshot exceeds its size limit.");
        const digest = Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
          (n) => n.toString(16).padStart(2, "0"),
        ).join("");
        if (digest !== card.artifact_sha256)
          throw Error("Replay integrity check failed. Please reload the page.");
        const next = JSON.parse(new TextDecoder().decode(bytes)) as Replay;
        if (
          next.schema !== 1 ||
          next.sport !== card.sport ||
          !next.history?.length ||
          next.predictions?.length !== card.model_metrics.n
        )
          throw Error("Replay schema or match count is invalid.");
        setData(next);
        setDay(next.history.length - 1);
        setA(next.ratings[0].side);
        setB(next.ratings[1].side);
        setError("");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Replay unavailable.");
      }
    }
    void load();
    return () => controller.abort();
  }, [card.sport, card.artifact_sha256, card.model_metrics.n, attempt]);
  const better =
    card.model_metrics.log_loss < card.baseline_metrics.log_loss &&
    card.model_metrics.summed_brier < card.baseline_metrics.summed_brier;
  const snapshot = data?.history[day];
  const ra = snapshot?.ratings[a] ?? data?.parameters.initial ?? 1500;
  const rb = snapshot?.ratings[b] ?? data?.parameters.initial ?? 1500;
  const advantage = neutral ? 0 : (data?.parameters.home_advantage ?? 0);
  const probability =
    1 /
    (1 + Math.pow(10, (rb - ra - advantage) / (data?.parameters.scale ?? 400)));
  const current = data?.predictions[match];
  const receipt = {
    schema: 1,
    sport: card.sport,
    kind: "historical-as-of-scenario",
    as_of: snapshot?.date,
    side_a: a,
    side_b: b,
    probability_a: probability,
    probability_b: 1 - probability,
    neutral,
    rating_a: ra,
    rating_b: rb,
    home_advantage: advantage,
    model: "date-batched Elo baseline",
    parameters: data?.parameters,
    artifact_sha256: card.artifact_sha256,
    source: data?.source,
    scope:
      "Hypothetical matchup from archived ratings. Conditional on a decisive result; not a current fixture or champion forecast. No injury, lineup or venue-specific features.",
  };
  return (
    <main className="replay-page">
      <header className="replay-header">
        <Link href="/models">← Model labs</Link>
        <p className="replay-kicker">
          HISTORICAL MODEL LAB / {card.sport.toUpperCase()}
        </p>
        <h1>{sportNames[card.sport]}</h1>
        <p>
          Explore a matchup. Replay a prediction. Take the evidence with you.
        </p>
        <div className="replay-badges">
          <span>Data through {card.as_of}</span>
          <span>Two outcomes · decisive games only</span>
          <span>No live feed or paid API</span>
        </div>
      </header>
      <div className="replay-content">
        <section className="replay-workspace" aria-labelledby="matchup-title">
          <div>
            <p className="replay-kicker">01 / TRY A MATCHUP</p>
            <h2 id="matchup-title">What do the ratings say?</h2>
            <p>
              Use only information available at your selected archived date.
              This is a hypothetical scenario.
            </p>
          </div>
          {!data && !error && (
            <p role="status">Loading and checking the replay snapshot…</p>
          )}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button
                onClick={() => {
                  setError("");
                  setAttempt(attempt + 1);
                }}
              >
                Retry snapshot
              </button>
            </div>
          )}
          {data && snapshot && (
            <>
              <div className="replay-inputs">
                <label>
                  Side A
                  <select
                    aria-label="Side A"
                    value={a}
                    onChange={(e) => {
                      setA(e.target.value);
                      setNotice("");
                    }}
                  >
                    {data.ratings.map((r) => (
                      <option key={r.side}>{r.side}</option>
                    ))}
                  </select>
                </label>
                <span aria-hidden="true">vs</span>
                <label>
                  Side B
                  <select
                    aria-label="Side B"
                    value={b}
                    onChange={(e) => {
                      setB(e.target.value);
                      setNotice("");
                    }}
                  >
                    {data.ratings.map((r) => (
                      <option key={r.side}>{r.side}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="replay-range">
                Ratings as of <strong>{snapshot.date}</strong>
                <input
                  aria-label="Ratings as-of date"
                  type="range"
                  min="0"
                  max={data.history.length - 1}
                  value={day}
                  onChange={(e) => {
                    setDay(Number(e.target.value));
                    setNotice("");
                  }}
                />
              </label>
              {data.parameters.home_advantage > 0 && (
                <label className="replay-checkbox">
                  <input
                    type="checkbox"
                    checked={neutral}
                    onChange={(e) => setNeutral(e.target.checked)}
                  />
                  Neutral venue (otherwise Side A is at home)
                </label>
              )}
              {a === b ? (
                <p role="alert">Choose two different sides.</p>
              ) : (
                <>
                  <div className="replay-probabilities" aria-live="polite">
                    <div>
                      <span>{a}</span>
                      <strong>{pct(probability)}</strong>
                    </div>
                    <div>
                      <span>{b}</span>
                      <strong>{pct(1 - probability)}</strong>
                    </div>
                  </div>
                  <div className="replay-probability-bar" aria-hidden="true">
                    <span style={{ width: pct(probability) }} />
                  </div>
                  <p className="replay-fine">
                    Outcome probabilities from a simple Elo baseline, not
                    certainty or a ranking of championship chances.
                  </p>
                  <details>
                    <summary>Why this number?</summary>
                    <p>
                      Rating {a}: {ra.toFixed(1)}. Rating {b}: {rb.toFixed(1)}.
                      Side A advantage: {advantage} rating points. Scale:{" "}
                      {data.parameters.scale}. Each date is scored before its
                      outcomes update the ratings. The scenario uses ratings
                      after {snapshot.date}.
                    </p>
                    {(!(a in snapshot.ratings) || !(b in snapshot.ratings)) && (
                      <p>
                        One side has no results at this date and uses the
                        initial rating of {data.parameters.initial}.
                      </p>
                    )}
                    <p>
                      Roster changes, injuries and detailed venue conditions are
                      not modeled. Historical team identifiers are preserved;
                      this is not a current-team forecast.
                    </p>
                  </details>
                  <div className="replay-actions">
                    <button
                      onClick={() => {
                        download(
                          `spops-${card.sport}-receipt.json`,
                          JSON.stringify(receipt, null, 2),
                        );
                        setNotice(
                          "Scenario receipt downloaded with its source and as-of date.",
                        );
                      }}
                    >
                      Download prediction receipt
                    </button>
                    <button
                      className="secondary"
                      onClick={() => {
                        download(
                          `spops-${card.sport}-notes.md`,
                          `# ${sportNames[card.sport]} matchup\n\nAs of: ${snapshot.date}\n\n${a}: ${pct(probability)}\n${b}: ${pct(1 - probability)}\n\nHistorical Elo scenario, conditional on a decisive result. Not a live fixture prediction.\n\nSource: ${data.source.credit}\n${data.source.url}\n\nArtifact SHA-256: ${card.artifact_sha256}\n`,
                          "text/markdown",
                        );
                        setNotice("Matchup notes downloaded.");
                      }}
                    >
                      Save matchup notes
                    </button>
                  </div>
                </>
              )}
              <p role="status" className="replay-fine">
                {notice}
              </p>
            </>
          )}
        </section>
        <section className="replay-panel" aria-labelledby="replay-title">
          <p className="replay-kicker">02 / REPLAY A REAL MATCH</p>
          <h2 id="replay-title">Before the result was applied.</h2>
          <p>
            These forecasts are reconstructed from historical data. They are not
            timestamped pre-event public calls.
          </p>
          {data && current && (
            <>
              <label className="replay-range">
                Evaluation match {match + 1} of {data.predictions.length}
                <input
                  aria-label="Archived evaluation match"
                  type="range"
                  min="0"
                  max={data.predictions.length - 1}
                  value={match}
                  onChange={(e) => {
                    setMatch(Number(e.target.value));
                    setShowResult(false);
                  }}
                />
              </label>
              <div className="replay-match">
                <p>
                  {current.date} · {current.match_id}
                </p>
                <h3>
                  {current.side_a} vs {current.side_b}
                </h3>
                <p>
                  Elo: {pct(current.probability_a)} for {current.side_a} ·
                  Constant baseline: {pct(current.baseline_probability_a)}
                </p>
                <button
                  className="secondary"
                  aria-expanded={showResult}
                  onClick={() => setShowResult(!showResult)}
                >
                  {showResult ? "Hide result" : "Reveal archived result"}
                </button>
                {showResult && (
                  <p role="status">
                    Winner:{" "}
                    {current.side_a_won ? current.side_a : current.side_b}
                  </p>
                )}
                <details>
                  <summary>Prediction receipt</summary>
                  <p>
                    Pre-match ratings: {current.rating_a_before.toFixed(1)} /{" "}
                    {current.rating_b_before.toFixed(1)}. Home advantage:{" "}
                    {current.home_advantage}.
                  </p>
                  <code className="replay-hash">
                    Pre-date state: {current.pre_date_state_sha256}
                  </code>
                  <button
                    className="secondary"
                    onClick={() =>
                      download(
                        `spops-${card.sport}-archived-receipt.json`,
                        JSON.stringify(
                          {
                            ...current,
                            artifact_sha256: card.artifact_sha256,
                            source: data.source,
                            scope:
                              "Retrospective date-batched replay, not a pre-kickoff public prediction",
                          },
                          null,
                          2,
                        ),
                      )
                    }
                  >
                    Download archived receipt
                  </button>
                </details>
              </div>
            </>
          )}
        </section>
        <section className="replay-panel" aria-labelledby="evaluation-title">
          <p className="replay-kicker">03 / CHECK THE MODEL</p>
          <h2 id="evaluation-title">A comparison, including the misses.</h2>
          <p>
            {card.model_metrics.n} decisive games from {card.evaluation_start}{" "}
            to {card.evaluation_end_exclusive} (exclusive). Lower scores are
            better.
          </p>
          <div className="replay-table-wrap">
            <table>
              <caption>
                Historical evaluation · fixed parameters ·{" "}
                {card.training_matches} warmup games
              </caption>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Log loss</th>
                  <th scope="col">Summed Brier</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Date-batched Elo</th>
                  <td>{card.model_metrics.log_loss.toFixed(4)}</td>
                  <td>{card.model_metrics.summed_brier.toFixed(4)}</td>
                </tr>
                <tr>
                  <th scope="row">Training-only constant baseline</th>
                  <td>{card.baseline_metrics.log_loss.toFixed(4)}</td>
                  <td>{card.baseline_metrics.summed_brier.toFixed(4)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={`replay-verdict ${better ? "" : "caution"}`}>
            {better
              ? "Elo had lower point losses on this historical interval. This does not establish statistical significance or future superiority."
              : "The constant baseline performed better on one or both losses. This result is retained; the experiment did not justify a superiority claim."}
          </p>
          <details>
            <summary>Calibration by probability bin</summary>
            <div className="replay-table-wrap">
              <table>
                <caption>
                  Side A predictions; empty bins have no estimate. Small bins
                  are uncertain.
                </caption>
                <thead>
                  <tr>
                    <th>Range</th>
                    <th>Games</th>
                    <th>Mean predicted</th>
                    <th>Observed wins</th>
                  </tr>
                </thead>
                <tbody>
                  {card.model_metrics.calibration.map((bucket) => (
                    <tr key={bucket.lower}>
                      <td>
                        {pct(bucket.lower)}–{pct(bucket.upper)}
                      </td>
                      <td>{bucket.n}</td>
                      <td>
                        {bucket.mean_predicted === null
                          ? "—"
                          : pct(bucket.mean_predicted)}
                      </td>
                      <td>
                        {bucket.observed_frequency === null
                          ? "—"
                          : pct(bucket.observed_frequency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="replay-panel">
          <p className="replay-kicker">04 / SOURCE & REPRODUCTION</p>
          <h2>The data behind the page.</h2>
          {data && (
            <>
              <p>
                {data.source.credit}. License:{" "}
                <a
                  href={data.source.license_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {data.source.license}
                </a>
                . Scores/outcomes are normalized; upstream Elo and forecasts are
                not model inputs.
              </p>
              <p>
                Exclusions:{" "}
                {Object.entries(data.source.excluded)
                  .map(
                    ([k, v]) =>
                      `${k.replaceAll("_", " ")}: ${v.toLocaleString()}`,
                  )
                  .join(" · ")}
                .
              </p>
              <code className="replay-hash">
                Match snapshot SHA-256: {data.identity.data_sha256}
              </code>
              <code className="replay-hash">
                Protocol SHA-256: {data.identity.protocol_sha256}
              </code>
            </>
          )}
          <p>
            Evaluation is prequential: earlier evaluation dates may update later
            ratings, but a date never sees its own outcomes. It is a
            retrospective public-data comparison, not a globally untouched
            prospective test.
          </p>
          <div className="replay-actions">
            <a href={`/replays/${card.sport}.json`} download>
              Download full replay JSON
            </a>
            <a
              href="https://github.com/dilipna/wc26-mlops/tree/improve/multisport-release"
              target="_blank"
              rel="noreferrer"
            >
              Inspect project source ↗
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
