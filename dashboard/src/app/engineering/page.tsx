import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import proofSources from "../../../data/historical_evidence.json";
export const metadata = {
  title: "Model decisions and reproducibility — SpOps",
};
export default function Engineering() {
  const review = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "public/proof/governance-rehearsal.json"),
      "utf8",
    ),
  );
  const temporal = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "public/proof/temporal-comparison.json"),
      "utf8",
    ),
  );
  const c = review.comparison;
  return (
    <main className="replay-page">
      <header className="replay-header">
        <Link href="/">← All sports</Link>
        <p className="replay-kicker">ENGINEERING / DECISIONS WITH RECEIPTS</p>
        <h1>A new model must earn its place.</h1>
        <p>
          Registering a candidate is not permission to serve it. Keep the
          decision, the data boundary and the recovery path.
        </p>
        <div className="replay-badges">
          <span>Retained historical CPU evidence</span>
          <span>Local trusted-operator lifecycle</span>
        </div>
      </header>
      <div className="replay-content">
        <section className="replay-workspace">
          <p className="replay-kicker">01 / THE RELEASE GATE</p>
          <h2>The candidate was worse. It stayed a candidate.</h2>
          <p>
            Two real football ensembles were trained on 2015 matches and
            compared over {c.n_matches} historical 2016 matches. The rule
            required strict improvement on both log loss and summed-class Brier.
            This is an operational selection rehearsal, not an unbiased accuracy
            benchmark or significance test.
          </p>
          <div className="replay-table-wrap">
            <table>
              <caption>
                Stored historical rehearsal · lower losses are better
              </caption>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Log loss</th>
                  <th>Summed Brier</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>Approved incumbent</th>
                  <td>{c.incumbent_metrics.log_loss.toFixed(6)}</td>
                  <td>{c.incumbent_metrics.brier.toFixed(6)}</td>
                </tr>
                <tr>
                  <th>New candidate</th>
                  <td>{c.candidate.log_loss.toFixed(6)}</td>
                  <td>{c.candidate.brier.toFixed(6)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="replay-verdict caution">
            Rejected: worse on both metrics. The approved artifact remained
            unchanged.
          </p>
          <details>
            <summary>Inspect the decision and reload identity</summary>
            <code className="replay-hash">Candidate: {c.candidate_id}</code>
            <code className="replay-hash">
              Final approved: {review.final_approved_id}
            </code>
            <code className="replay-hash">
              Separate-process reload: {review.separate_process_reload.model_id}
            </code>
            <p>
              Registration and evaluation cannot implicitly approve a model.
              Bootstrap is an explicit first-approval operation. Active serving
              stays pinned until restart. Missing/corrupt approved artifacts
              fail closed instead of silently training replacements.
            </p>
          </details>
          <div className="replay-actions">
            <a href="/proof/governance-rehearsal.json" download>
              Download original rehearsal receipt
            </a>
          </div>
        </section>
        <section className="replay-panel">
          <p className="replay-kicker">02 / A NEGATIVE EXPERIMENT</p>
          <h2>More elaborate stacking did not win.</h2>
          <p>
            A forward-only stack kept source matches and date boundaries
            separate. It failed the frozen replacement criteria, so it was not
            adopted. Confirmation was reserved within that experiment; these
            historical years are not globally pristine data.
          </p>
          <div className="replay-table-wrap">
            <table>
              <caption>
                Stored selection/confirmation log loss · lower is better
              </caption>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>2016 selection</th>
                  <th>2017 confirmation</th>
                </tr>
              </thead>
              <tbody>
                {[
                  "legacy_stratified_stack",
                  "equal_weight_blend",
                  "temporal_stack",
                ].map((name) => (
                  <tr key={name}>
                    <th>{name.replaceAll("_", " ")}</th>
                    <td>
                      {temporal.selection.metrics[name].log_loss.toFixed(6)}
                    </td>
                    <td>
                      {temporal.confirmation.metrics[name].log_loss.toFixed(6)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The temporal-versus-blend selection log-loss interval crosses zero:
            [
            {temporal.selection.temporal_minus_fixed.log_loss_ci95
              .map((x: number) => x.toFixed(6))
              .join(", ")}
            ]. It also trails the legacy stack on point losses. A favorable
            comparison against only the weaker baseline does not justify
            replacement.
          </p>
          <a href="/proof/temporal-comparison.json" download>
            Download original comparison summary
          </a>
        </section>
        <section className="replay-panel">
          <p className="replay-kicker">03 / REPRODUCIBLE RECOVERY</p>
          <h2>Keep the identity with the model.</h2>
          <ol className="replay-steps">
            <li>
              <strong>Register:</strong> content-addressed artifacts retain
              training/code/runtime lineage.
            </li>
            <li>
              <strong>Evaluate:</strong> date/overlap/probability checks run
              before paired scores.
            </li>
            <li>
              <strong>Approve explicitly:</strong> SQLite transactions reject
              stale approval generations.
            </li>
            <li>
              <strong>Load together:</strong> artifact bytes and returned model
              identity agree after restart.
            </li>
            <li>
              <strong>Recover:</strong> previously approved artifacts can be
              restored after integrity checks.
            </li>
          </ol>
          <p>
            Distinct-artifact rollback is verified with fitted controlled
            sklearn models. The rejected real candidate was not forcibly
            promoted to manufacture a rollback demo. This is not a signed
            multi-host registry or zero-downtime rollout.
          </p>
        </section>
        <section className="replay-panel">
          <p className="replay-kicker">04 / EVIDENCE BOUNDARIES</p>
          <h2>What these records establish.</h2>
          <p>
            These are preserved experiment outputs. The current website does not
            claim that MLflow, Render, Airflow or a live cluster is healthy. New
            sport pages use historical browser-side states without those
            services.
          </p>
          {Object.entries(proofSources).map(([file, source]) => (
            <details key={file}>
              <summary>{file}</summary>
              <code className="replay-hash">
                Original source: {source.source_sha}
              </code>
              <code className="replay-hash">
                Receipt SHA-256: {source.sha256}
              </code>
              <p>{source.scope}</p>
            </details>
          ))}
          <p>
            Current release CI/browser links will accompany publication. The
            public build identity describes deployed source, not predictive
            quality.
          </p>
          <div className="replay-actions">
            <a href="https://github.com/dilipna/wc26-mlops/tree/improve/multisport-release">
              Review source and runbooks ↗
            </a>
            <Link href="/admin">Existing read-only operations archive →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
