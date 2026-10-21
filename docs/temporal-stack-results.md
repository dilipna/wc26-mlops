# WC26 temporal stacking comparison

October 21, 2026. **COMPLETE: bounded implementation and experiment. REJECTED as a default-model replacement under the frozen criteria.** The existing model default and approval state remain unchanged. No push, PR, cloud run, paid API call or deployment occurred. The broader redevelopment program remains partial.

## What was investigated

The prior audit found future-reaching training dates and some mirrored-source-match overlap inside sklearn's integer-CV stacking folds. This fails a strict forward-only, source-match-disjoint meta-training contract. We implemented and tested that stronger contract, then checked whether it justified replacing the existing stack.

**Correction to the earlier assessment:** calling the legacy split a general predictive-validity defect was too broad. Stacking's internal CV generates meta-training features; it is not itself a generalization estimate. A separate chronological outer holdout can remain valid even when the internal stack uses ordinary stratified CV. The results below do not demonstrate that the old model's held-out metrics were inflated. sklearn documents this [CV/prediction distinction](https://scikit-learn.org/1.4/modules/generated/sklearn.model_selection.cross_val_predict.html); the [partition requirement](https://github.com/scikit-learn/scikit-learn/issues/32614) also explains why simply substituting TimeSeriesSplit does not solve burn-in handling.

## Source and frozen acceptance

- Prior completed governance checkpoint: `65657002b05c5ba4394c4f9dd1fe57c349d65c69`, preserved on `improve/governed-model-promotion`.
- Experiment branch: `improve/temporal-stack-evaluation`.
- Protocol committed before training: `5c4d586dbd1bd2e2d658bb5b3e54bb39967d16bf`, `docs/temporal-stack-protocol.json`.
- Tested implementation and model-run source: `8afced74365712662399cd59e6e0ecbe2a277c03`. Later report-only commits do not change those executed files.
- One historical comparison run, `validation/wc26-temporal-run1/`. No metric-driven tuning or threshold changes followed the results.

The frozen review criteria required the temporal arm to beat both the fixed blend and legacy stack on point log loss and Brier in selection and confirmation. Its paired weekly log-loss delta versus the fixed blend also had to have an upper 95% percentile bound below zero in both intervals. Passing would only make it eligible for human review, never automatic promotion. Structural correctness and predictive adoption were deliberately separate decisions.

## Implementation and simpler alternative

`src/models/layer1_ensemble/temporal.py` adds an experimental date-block stack and fixed equal-weight blend. Both use the same XGBoost, Elo/logistic and FIFA-heuristic members as the legacy model. The existing `ensemble.py`, serving API, daily training default, governance implementation and deployed services are unchanged.

Each temporal fold trains cloned base members strictly before a validation block, keeping both orientations of every source match on the same side. Initial burn-in rows train base members but are excluded from meta training; they never receive in-sample meta features. After fitting the meta-learner on forward-only predictions, the final base members are refit on the complete permitted training population. Invalid date/group metadata, gaps/overlap/trailing blocks, missing classes and invalid probabilities stop fitting. Fixed blending fits the members once and uses equal weights, avoiding meta-model complexity entirely.

`temporal_eval.py` computes proper probability losses and paired ISO-week bootstrap intervals. `scripts/compare_temporal_stack.py` checks the committed protocol, saves selection and its decision before evaluating confirmation, retains per-match predictions/models/splits and checks separate-process reload. No serving/model-store promotion is performed.

## Data, models and boundaries

Historical feature history starts in 1992, using the prior governance data policy. Train: 2010-01-01 through 2016-01-01 exclusive. Temporal validation blocks: calendar years 2012, 2013, 2014 and 2015. Selection: 2016. Confirmation reserved within this comparison: 2017.

- **5,865 training matches / 11,730 symmetric rows.**
- **7,766 meta-training rows**, with **3,964 burn-in rows excluded** from meta fitting.
- **Four forward folds:** zero date or source-match boundary violations, independently checked from saved row indices and groups.
- All arms: 50 XGBoost estimators, depth 3, learning rate 0.1, one job, random seed 20261021. Logistic meta-learner: max_iter 1000, no search/tuning.
- The fixed and temporal arms' final base-member predictions were checked to be identical. Their combination rule is the intended difference.
- Bootstrap: 2,000 paired resamples, seed 20261021; 44 observed match-week clusters in selection, 43 in confirmation.

These are retrospective historical data. The 2016 interval was already observed in the lifecycle rehearsal; earlier project development may also have used these years. “Confirmation” means reserved within this run, not globally pristine data or prospective publication. Features may use outcomes known before each later match, rather than fixing all 2016/2017 information at the training cutoff.

## Measured result

Lower is better for both metrics; Brier is summed across the three classes before averaging over matches.

| Interval | Arm | Mean log loss | Mean Brier |
|---|---|---:|---:|
| 2016 selection, 920 matches | Legacy stratified stack | 0.908257 | 0.535222 |
| | Equal-weight blend | 0.918302 | 0.542663 |
| | Temporal stack | 0.908886 | 0.535396 |
| 2017 confirmation, 924 matches | Legacy stratified stack | 0.941466 | 0.556693 |
| | Equal-weight blend | 0.959318 | 0.567403 |
| | Temporal stack | 0.943541 | 0.557869 |

Temporal-minus-fixed mean log-loss delta:

- Selection: **−0.009416**, weekly bootstrap interval **[−0.023029, +0.001826]**; crosses zero.
- Confirmation: **−0.015777**, interval **[−0.030240, −0.001388]**.

The temporal arm has better point metrics than the simple blend, but slightly worse point metrics than legacy in both intervals. Selection also fails the predeclared uncertainty bar. Therefore the replacement criteria fail. A confirmation-only advantage over the weaker blend does not rescue the failed selection or demonstrate superiority over legacy. Do not quote a percentage accuracy gain or claim a production fix.

## Actual verification

**116 tests passed, zero skipped**, 21 dependency deprecation warnings, 52.67 seconds in the full run. The **17 new focused tests** are a subset of 116, not additional tests. New-code Ruff and diff whitespace checks passed. Tests cover burn-in, strict dates/groups, malformed metadata, probabilities, final refit, pickle round-trip, fixed weights, metric arithmetic and uncertainty/eligibility logic.

Independent artifact checks recomputed all-arm log loss/Brier and float64 prediction hashes from the saved per-match predictions; regenerated weekly intervals using direct resampled row indices; checked every fold against saved date/group arrays; verified all artifact hashes; and confirmed the selection decision file precedes confirmation locally. This is independent calculation from the same artifacts, not independent data collection or an externally witnessed prospective timestamp. A separate interpreter reloaded all three saved models and reproduced their selection prediction hashes.

Windows, Python 3.10.9, numpy 1.26.4, sklearn 1.4.1.post1, XGBoost 3.2.0. The prior pinned-direct-dependency environment is unchanged; exact Linux/container reproduction remains unverified. No GPU was used. Observed fit times are retained in summary.json but are single-run timings, not performance benchmarks or speedup claims.

Evidence:

- `validation/wc26-temporal-full.txt`, `wc26-temporal-unit.txt`, `wc26-temporal-lint.txt`.
- `validation/wc26-temporal-run1/summary.json`, protocol/manifest, folds, training/OOF arrays, selection/confirmation predictions and metrics, decision and serialized models.
- `validation/wc26-temporal-independent-check.json` and portable `verify_temporal_evidence.py`.

## Reproduce and inspect

From this branch with its existing Python environment:

```powershell
.venv/Scripts/python.exe -m pytest tests/test_temporal_stack.py -q
.venv/Scripts/python.exe -m pytest tests/ -q
.venv/Scripts/python.exe scripts/compare_temporal_stack.py --outdir NEW_OUTPUT_DIRECTORY
```

The runner requires a clean committed source tree, the frozen protocol commit and a new directory for each run. For the packaged artifacts without retraining:

```powershell
python verify_temporal_evidence.py --run-dir wc26-temporal-run1 --output independent-check.json
```

Use the recorded dependencies. `models.pkl` is a trusted locally generated pickle, not a safe format for arbitrary uploaded models; verify its recorded hash and source before loading. The new experimental class is not integrated into serving approval or its artifact compatibility contract. Adopting it would require a separately justified integration and review, which this result does not support.

## What this demonstrates, and what it does not

The accomplishment is explicit temporal/group validation, controlled experimentation, independent metric reproduction and refusing an unsupported replacement. It is not a new best forecasting model, evidence that all legacy holdouts were invalid, or a result about GPU/production performance. Weekly resampling only approximates dependence; repeated teams, cross-week effects, one period/configuration and historical development exposure limit inference.

**Stop decision:** retain this as an experimental research branch. Do not tune repeatedly on these intervals to manufacture a win. Move to Chess CPU reproducibility after checking its branch/owner handoff; that adds breadth of evidence more efficiently than another WC26 feature now.

Proposed project-only resume wording for user review, not automatic adoption:

- Implemented forward-only stacking with source-match boundaries and burn-in exclusion; validated split, probability and serialization invariants through 17 new tests within a 116-test suite.
- Compared three ensemble designs under a frozen chronological protocol across 1,844 later matches, independently reproducing paired-week uncertainty and retaining the existing default when replacement criteria failed.

LinkedIn/case-study draft: “Audited WC26's internal stacking split, implemented a stricter temporal alternative and compared it with both a simpler blend and the existing stack. The alternative did not meet the frozen replacement criteria, so I retained the current default and published the negative result with reproducible artifacts.”

Interview prompts: Why isn't TimeSeriesSplit a drop-in here? Why are burn-in rows excluded from meta fitting? What does internal CV do in stacking? Why doesn't a strict temporal contract automatically improve held-out quality? How do mirrored rows differ from independent matches? Why bootstrap weeks rather than rows, and what dependence remains? Why was the 2017 interval still insufficient to justify adoption? Which exact evidence would make you revisit this decision?
