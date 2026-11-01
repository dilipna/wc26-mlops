# WC26 governed-model lifecycle milestone

October 21, 2026. **COMPLETE for the bounded local governance milestone. WC26 as a whole remains PARTIAL.** No push, public PR, paid API call, cloud job, settings change or deployment was performed. The portfolio website, Furnace and protected repositories were not modified.

Baseline: `e55b1be6d6508a2def38225f54032933fa1ff409`. Local branch: `improve/governed-model-promotion`. Implementation/rehearsal revision: `da0ce65a6911d41c9b4b37475259a86028558b98`. The isolated repository is this mission's `work/wc26-mlops`; the branch is clean. The final source/evidence manifest records archive checksums and revisions.

## Deficiency resolved

The previous daily path registered every freshly trained stack while reporting only in-sample loss. The API loaded `models:/.../latest`, queried registry version metadata separately, and trained a new local model if registry loading failed. There was no enforced separation between registering a candidate and approving it for serving. A tracking outage could therefore change model weights; the independently queried version could also fail to describe the loaded model.

The new local lifecycle creates hashed candidates, computes a paired chronological selection comparison, records explicit approval transactionally, and loads the approved model and identity together. Registration and a dry run cannot change serving. Inferior/tied candidates remain candidates. Stale decisions reject after another approval changes the generation. Previously approved artifacts can be restored exactly after integrity checks. Serving has no implicit retraining or remote “latest” selection.

## Relevant code paths

| Path | Responsibility |
|---|---|
| `src/models/layer1_ensemble/lifecycle.py` | Content-addressed trusted-local model storage; manifest/lineage/runtime checks; paired probability scoring; transactional approvals and rollback |
| `scripts/model_lifecycle.py` | Explicit operator train/evaluate/bootstrap/status/rollback commands |
| `src/serving/app.py` | Approved artifact startup, matching identity, current causal feature data, rejection of requests before the training cutoff |
| `scripts/daily_update.py` | Training produces candidates; daily forecast output uses approved weights and stops without approval |
| `scripts/rehearse_model_lifecycle.py` | Real historical CPU ensemble serialization, selection comparison and separate-interpreter reload |
| `tests/test_model_lifecycle.py` | Data, probability, stale-state, corruption, restart, rollback and daily-isolation regressions |
| `docs/governed-promotion.md` | Architecture alternatives, predeclared policy, reproduction, data policy and interview explanation |

MLflow remains supplementary tracking. `tracking.load_latest_stack` and latest-registry metadata remain legacy/dashboard helpers; neither selects the API model now. The dashboard itself was not redesigned. Historical prediction CSV series labels remain series labels, not artifact IDs; new match fixture JSON carries the selected artifact ID.

## Acceptance and actual validation

The policy was recorded before inspecting candidate metrics: at least 30 distinct matches, no training overlap, valid finite probability distributions, and strict improvement in **both** mean log loss and summed-class Brier score. Ties fail. This is an operational rule, not a significance test or power analysis. Bootstrap is a separate explicit operator action; it does not assert superiority to an absent incumbent.

| Criterion | Evidence / outcome |
|---|---|
| Registration and dry run do not approve | Persistence assertions; normal approve cannot implicitly bootstrap |
| Inferior/tied candidate cannot change serving | Deterministic fitted sklearn controls; real historical candidate rejected |
| Chronology, lineage and finite probability checks | Negative tests for overlap, revised history, duplicates/sample floor, invalid distributions and implementation mismatch |
| Atomic approval and stale-state protection | Actual SQLite store; injected competing update makes stale decision fail |
| Exact rollback | Distinct fitted sklearn controls serialized to real files; prior artifact restored, predictions identical; unapproved targets rejected |
| Outage/restart | Separate interpreter loads approved real Layer1Ensemble; serving test forbids registry-latest and training calls |
| Corruption/absence | Missing/corrupt artifact and altered manifest stop approval loading; no substitute is trained |
| Daily candidate isolation | Full daily function exercised with fake ingestion/training collaborators but real store; without approval it registers a candidate and stops before fetching/writing forecasts |
| Regression and quality checks | Final complete run: **99 passed, zero skipped, 21 dependency deprecation warnings, 188.45 seconds** at `da0ce65`; 27 lifecycle tests also passed separately. Log: `validation/wc26-final-regression.txt`. New-code Ruff check passed; diff whitespace clean |

The fitted DummyClassifier controls deliberately make better/worse/tie cases observable. Their scores are not football results. Existing API tests use fake model state, so they do not independently exercise startup; startup selection is covered by the new direct state test and actual artifact/restart rehearsal.

Commands actually used with the isolated Python 3.10.9 environment:

```powershell
.venv/Scripts/python.exe -m pytest tests/ -q
.venv/Scripts/python.exe -m pytest tests/test_model_lifecycle.py -q
.venv/Scripts/python.exe scripts/rehearse_model_lifecycle.py --output ../../outputs/validation/wc26-real-artifacts-accepted.json
```

Environment: Windows; numpy 1.26.4, scikit-learn 1.4.1.post1, XGBoost 3.2.0, MLflow 3.2.0. Full installed environment is in validation/wc26-windows-environment.txt. The unchanged Linux lock could not install on Windows because its NCCL wheel is Linux-only. Pinned direct requirements were used; exact Linux/container reproduction is not claimed. Prior full runs produced dependency deprecation warnings. An early baseline run also emitted an OpenTelemetry console-export shutdown error after tests passed; it was not a model-selection failure. Docker was unavailable, and no container/server/cloud rehearsal occurred.

## Real candidate comparison — negative result retained

The committed historical CSV contains 49,484 rows. The declared 1992+ feature-history scope contains 31,376 rows before exact duplicate removal and 31,375 after it; 18,108 older rows are outside scope. One exact duplicate is collapsed. Older same-date/team identity conflicts are not automatically repaired. The raw files remain unchanged. This era boundary changes rating initialization relative to the prior all-history model, so no quality comparison to old project metrics is valid without reevaluation.

Two real Layer1Ensembles trained on 2015 matches, with causal earlier 1992+ feature history. Both used eight XGBoost estimators and one job; incumbent depth two, candidate depth one. Selection: January 1, 2016 inclusive through January 1, 2017 exclusive, **920 matches**, one oriented evaluation row per match.

| Model | Mean log loss | Mean summed-class Brier | Decision |
|---|---:|---:|---|
| Explicitly bootstrapped incumbent | 0.9120704804 | 0.5374558023 | Remained approved |
| Candidate | 0.9144007394 | 0.5389323134 | REJECTED: worse on both |

The rejection is a successful governance test, not an improvement in forecasting. No hyperparameter was changed after seeing this outcome. This retrospective interval is an operational selection rehearsal, not a new untouched predictive benchmark. Features may use results already known before each selection match, so it is a sequential as-of evaluation, not 920 forecasts all made on December 31, 2015.

The separate process reloaded the approved artifact with loss/draw/win class order. Because the real candidate was rejected, a distinct real-Layer1Ensemble rollback was not forced by bypassing the gate; distinct-artifact rollback is demonstrated by controlled fitted sklearn models. The report records model IDs, data/ranking/selection hashes and prediction hashes in validation/wc26-real-artifacts-accepted.json. Temporary rehearsal stores were discarded after use; no production or shared approval store was touched.

## Known limitations and next milestone

- Local trusted operator and filesystem only. Pickle may execute code; artifacts must not come from untrusted uploads. Hashes detect corruption, not a malicious operator rewriting manifests/database. No signed audit, distributed authorization or multi-host registry guarantee.
- Active processes remain pinned until restart. No hot reload, zero-downtime rollout, production SLA or live outage experiment is claimed. Missing approval is an intentional startup failure; an existing deployment needs explicit artifact migration before adopting this branch.
- Component hashes and exact Python/library versions fail closed on guarded compatibility changes. They are not proof of a fully closed dependency/runtime environment. Clean target-image reproduction remains conditional on Docker.
- The model's original internal stacking CV remains flawed for temporal/group separation. Fresh structural audit found future-reaching training in all five folds and mirrored-match overlap in four. This gate does not repair that training method and does not establish generalization or improved accuracy.
- No fresh live football data, Odds API, Supabase writes, MLflow service, hosted API or dashboard was used in the acceptance rehearsal. The disabled schedule and deploy hooks remain unchanged.

**Next proposal, not implemented:** freeze source-match/time partitions for internal meta-learner training; compare manual expanding-window stacking with a simpler fixed blend; keep early burn-in exclusions explicit; reserve later data before fitting. Acceptance requires no source-match/future overlap, reproducible baseline comparison, paired uncertainty and retained negative results. `validation/wc26-inner-cv-audit.json` is the new defect evidence. Do not claim a quality fix until that separate milestone is evaluated. Chess CPU reproduction is an alternative if its ownership/materials make it higher value.

## Technical ownership and proposed career evidence

**Contribution statement for review:** separated local model registration from serving approval, implemented paired candidate/incumbent evaluation and artifact/lineage checks, and validated rejection, pinned startup and rollback behavior. This is new personal-project work, never an employer accomplishment.

Candidate resume bullets, **not approved for adoption until you review and can defend the implementation**:

- Implemented a local model-promotion gate with chronological paired evaluation, immutable artifact identities, transactional approval history and explicit rollback; removed latest-version selection and silent startup retraining.
- Validated failure and recovery paths with a 99-test Python suite and serialized-model rehearsals; retained an inferior candidate as rejected across 920 historical selection matches without changing serving approval.

LinkedIn draft: “Strengthened WC26's local ML lifecycle by separating candidate registration from approval and pinning inference to a verified artifact. Tested corruption, stale approval, restart and rollback; a worse historical candidate was correctly kept out. Cloud integration and model-quality methodology remain separately qualified.”

Three-minute case study: explain the original latest/fallback path; show a candidate that fails both metrics; inspect its unchanged approval ID; show the stale/rollback tests; then disclose the inner-CV flaw and why governance success does not establish forecasting improvement.

Interview questions: Why are registration and approval different? Why not use a mutable MLflow alias alone? What does SQLite serialize? What race does the generation check prevent? How do you know the model version describes the loaded bytes? What does your hash not prove? Why can a chronological gate still sit around a non-temporal training method? Why keep a negative result? How do changed feature data affect replay? What would a multi-host production version need that this local one does not?
