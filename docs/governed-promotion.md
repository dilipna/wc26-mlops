# Governed local model promotion

Local review branch only. The hosted API/dashboard and cloud jobs have not changed. The historical daily schedule remains disabled. This subsystem governs the Layer 1 weights used by the local serving API and daily prediction path. It is a single-host trusted-operator implementation, not a distributed registry or production authorization service.

## Problem and decision

Previously `daily_update.py` registered a newly fit stack while reporting in-sample loss. `tracking.load_latest_stack()` requested `models:/wc26-layer1-stacked-ensemble/latest`. Serving separately looked up the highest registry version for its identity and trained another model when registry loading failed. Registration could therefore become implicit promotion, model identity could describe a different version than the loaded model, and a tracking outage could change the weights being served.

The narrow solution separates candidates from approval. A local content-addressed artifact store plus SQLite approval history is simpler to validate without cloud access than coupling serving correctness to a remote mutable alias. MLflow remains optional experiment tracking. Its highest registered version is not the active serving version; older dashboard registry cards remain registry information only.

Rejected alternatives: retaining “latest” with a documented convention (no executable approval boundary); silently fitting on outage (changes model identity and predictions); adding another cloud registry or service (cost/availability complexity without a demonstrated need). A hard-coded filename is simpler but lacks paired evaluation, lineage and transactional rollback history.

## Contract and predeclared acceptance

- `ModelStore.register` writes a candidate, never approval. A manifest binds source revision, component hashes, serialized artifact hash, Python/ML dependency versions, class/feature order, training population, pretraining feature history and historical rankings.
- Official producers train using `[train_start, train_end)` only. The gate rejects training that overlaps its declared selection interval. It scores one home-oriented row per distinct match, not the mirrored training twins.
- Before candidate results were examined, policy `strict-logloss-and-brier-v1` required strictly lower mean multiclass log loss **and** summed-class multiclass Brier score than the incumbent. Ties or a worse score on either metric do not promote. The minimum 30 matches is a small operational floor, not evidence of statistical power.
- Initial bootstrap requires explicit `--bootstrap --approve`, an operator, a reason and valid evaluation. It establishes a first model without claiming superiority to an absent incumbent. A normal `--approve` cannot silently bootstrap.
- Both models are evaluated on the same interval and input identity. Non-finite features/predictions, invalid distributions, changed training/feature/ranking histories and malformed class contracts stop evaluation.
- The selection interval is used for model choice. It must not be called a pristine final test set or used as an unbiased generalization estimate. Future accuracy claims need separate reserved data and statistical design. Default sklearn stacking CV is still non-temporal; this milestone does not fix or endorse that methodology.
- Approval events are transactional. A concurrent change to the incumbent generation rejects a stale decision. Rollback accepts only previously approved, integrity-checked artifacts. Identity is loaded with the model, not fetched separately from MLflow.
- Serving never retrains or resolves “latest.” A valid local approval loads without MLflow; missing or corrupt approval fails startup. A running process retains its loaded model until restart; approval/rollback is not a hot-reload or zero-downtime mechanism.
- Daily training stores/logs an unapproved candidate, then uses the approved weights for forecasts. Without approval it stops before writing candidate forecasts. Same-day fixture JSON records carry the artifact ID; historical CSV series labels remain aggregate series identifiers and are not per-row artifact provenance.

## Data scope and negative findings

Real CSV rehearsal exposed 17 same-date/team-pair collision groups. Some older records may reflect distinct matches or historical ambiguity; they are not automatically repaired. The governed entry points explicitly bound feature history to January 1, 1992 onward, matching the established training era, with a cold start at that boundary. This changes feature initialization relative to the previous all-history implementation and requires reevaluation; do not compare its quality to older reports as though only governance changed.

In the bounded history one exact duplicate row (Gibraltar–Cayman Islands, June 6, 2026) is collapsed deterministically. Conflicting current identities stop the run. Raw CSVs are unchanged. Gate reports count duplicate removals and hash the normalized input. The historical rehearsal records excluded pre-1992 rows separately. No claim of a globally cleaned or independently source-verified football dataset is made.

Pickle artifacts are executable trusted-local inputs. SHA-256 detects corruption relative to the local manifest, not malicious modifications by an operator who can rewrite the store. This is not safe ingestion of arbitrary uploaded models. Keep the store outside public/static exports, limit local write access and retain backups. Exact runtime/code matching intentionally fails closed on upgrades; recreate and reevaluate artifacts after compatibility changes. SQLite history is operational history, not a signed tamper-proof audit log.

## Reproduce

Use Python 3.10 and the existing dependencies. The committed transitive lock targets Linux. On Windows its Linux-only NCCL wheel cannot be installed; validation uses unchanged pinned direct requirements and records the resulting environment separately. Do not regenerate the Linux deployment lock from Windows.

```powershell
python -m pytest tests/test_model_lifecycle.py -q
python -m pytest tests/ -q
python scripts/rehearse_model_lifecycle.py --output reports/governance-rehearsal.json
```

The rehearsal fits two real, small CPU ensembles on 2015 matches, using earlier 1992+ feature history; it evaluates the predeclared 2016 selection interval. XGBoost uses eight estimators, depths two and one, and one job. It exercises serialization and loading in a separate interpreter, retains rejection if the candidate fails either metric, and rolls back only if a promotion occurred. These are lifecycle checks, not a new predictive superiority benchmark. Synthetic fitted DummyClassifier tests deliberately force worse, tie and better cases to verify gate behavior; their scores have no forecasting interpretation.

For an explicit local candidate (CPU training may take longer with default settings):

```powershell
python scripts/model_lifecycle.py train --start 1992-01-01 --end 2016-01-01
python scripts/model_lifecycle.py status
```

Use the returned candidate ID in `evaluate CANDIDATE_ID --start 2016-01-01 --end 2017-01-01 --actor YOUR_NAME --reason YOUR_REASON`. This is a dry run. Only an intended first local approval adds `--bootstrap --approve`. Subsequent approvals omit `--bootstrap` and must pass comparison. Use `rollback PREVIOUSLY_APPROVED_ID --expected-generation CURRENT_GENERATION --actor YOUR_NAME --reason YOUR_REASON` for an explicit rollback, then restart serving. `--store PATH` before the subcommand and `WC26_MODEL_STORE` select the local store. Never point rehearsal commands at someone else's store.

## Explain it in an interview

The key distinction is registration versus approval: a successful training run creates an artifact, while a serving decision requires paired evidence and an explicit recorded action. An inferior candidate must be observable without changing serving. An outage must not silently invent a substitute model. A rollback must restore the same bytes, not ask the registry for whatever happens to be latest.

Challenges to rehearse: Why strict improvement on both metrics? Why is this not a significance test? How do mirrored rows affect validation? What does a hash protect and what does it not protect? Which transaction prevents stale promotion? Why can the loaded artifact identity differ from a separately queried registry version? What happens on a Python upgrade, corrupted file or process restart? Why is the 1992 feature-history boundary a modeling change that must be disclosed?

Validation results and resume wording are recorded after final tests in the central mission outputs. No employer/client achievement, business impact, production SLO or improved forecasting accuracy is established by this change.
