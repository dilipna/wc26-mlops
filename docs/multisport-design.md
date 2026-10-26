# Multi-sport design decisions

## Date and outcome boundary

Matches have a stable source ID, date, distinct sides, decisive result and neutral indicator. Duplicates/invalid identities stop ingestion. NBA mirrored rows and other leagues, NFL ties/missing scores and cricket non-winner records are excluded and counted. These binary models condition on a decisive outcome.

Score the entire date from one pre-date state; accumulate updates afterward. Unknown teams start at 1500. K=24 and per-sport home advantages were fixed before evaluation. The comparator is side-A win frequency fitted on training games only. No supplied upstream Elo/forecasts, player information or ball-by-ball features are used.

Evaluation is historical/prequential, not a fixed-cutoff season forecast. Prior evaluation outcomes may update later dates. No tuning followed the cricket negative result. Point-loss differences do not establish significance.

## Useful browser workflow

Choose a sport, sides and an archived date. Hypothetical scenarios use ratings AFTER that date. Match replay separately shows probabilities BEFORE that match date's outcomes. Same-side matchups are rejected; absent historical teams use the initial rating with an explanation. No current roster or live fixture claim is made.

Reveal archived outcomes; inspect state receipts; download scenario JSON/Markdown, an archived receipt or full replay data. The browser verifies SHA-256 against the built summary before enabling forecasts. Failure/tampering shows an error and retry rather than substituted values.

Paper/green scorebook pages use native inputs, focus outlines, mobile navigation and captioned tables. The existing dark football archive remains separate.

## Model and deployment boundaries

Binary ReplaySport plugins share a standard-library engine. Football class order/features/approved-artifact loading are unchanged. Configuration alone does not make the football model valid for another sport.

Existing approval/rollback is a local trusted-operator workflow, not distributed authorization. Offline Elo-versus-constant comparison is not live shadow traffic. No automated promotion is added.

Workbenches need no paid API, remote model or storage service. Downloads are bounded and parsed; archive content is never executed or extracted as filesystem paths. Hosting uses the existing project after approval. Build/replay fingerprints identify the actual release. Frozen npm installs and project-scoped build tracing remain enforced. Old schedules and hosting settings are unchanged.

Coverage remains historical: NBA/NFL 2015, IPL 2023. No injuries/lineups, calibrated modern-season model, cross-sport ranking or champion probabilities are claimed. Further coverage requires a reviewed source and evaluation protocol.

## Historical ledger threat model

A stored hash chain detects changes relative to a trusted head. A repository operator can recompute the chain, and git author/committer timestamps do not independently prove when content first became public. Old archive wording asserting proof against backdating has been withdrawn. Source links and recorded grading remain inspectable; external timestamp anchoring was not added or claimed.
