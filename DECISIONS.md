# Decisions Log

One entry per non-trivial technical choice, with reasoning. Newest first.

## 2026-07-04 — Optuna tuning: built it, ran it, defaults still win (honest negative result)

Added after Dilip's "best possible model performance" ask + the MLOps-gap audit found no
tuning step anywhere in the pipeline. `scripts/tune_layer1.py` runs a 30-trial Optuna study
(3-fold stratified CV, `neg_log_loss`) over the XGBoost member's hyperparameters only --
the elo/logreg baseline has 2 features and the FIFA heuristic isn't fit to data at all, so
neither has anything meaningful to search. `Layer1Ensemble` gained an optional `xgb_params`
override (merged over `DEFAULT_XGB_PARAMS`) and `load_tuned_xgb_params()` reads
`data/tuning/best_xgb_params.json` best-effort (missing/corrupt -> `None` -> defaults),
wired into `daily_update.py`, `backtest_2018_2022.py`, and `src/serving/app.py`'s
fallback-training path.

**Ran it for real, and the result is an honest miss.** The winning trial improved isolated
XGBoost CV log-loss (0.9194 -> 0.9167, on the exact same folds). Plugged into the FULL
stacked ensemble and re-run through `backtest_2018_2022.py` -- the metric that actually
matters per CLAUDE.md's Phase 0 gate -- the tuned params came out marginally *worse* than
the untuned defaults: avg Brier delta vs baseline -0.0026 (defaults: -0.0035), avg log-loss
delta -0.0924 (defaults: -0.0987). Both still beat baseline, but by less.

**Why, and what I did about it:** classic proxy-metric-vs-true-objective mismatch --
match-level predictive log-loss (what Optuna optimized) and tournament-level champion-
probability calibration across 4 knockout checkpoints in 2 backtested World Cups (what
actually gets reported) are related but not the same target, and the meta-learner
re-weights the three stacked members anyway, so a "better" XGBoost in isolation doesn't
guarantee a better blend. Rather than ship a regression, **I deleted the generated
`data/tuning/best_xgb_params.json`** so `load_tuned_xgb_params()` falls back to
`DEFAULT_XGB_PARAMS` (confirmed by re-running the backtest: numbers exactly match the
pre-tuning documented baseline). The tuning *capability* ships (script, override plumbing,
4 new pytest tests on the loader's file-I/O edge cases); this run's specific numbers don't.

**Also hit, unrelated to tuning:** `xgb.XGBClassifier`/`StackingClassifier` have no
`random_state` set anywhere in `ensemble.py`, so re-running the backtest at all (even with
identical hyperparameters) produces slightly different per-team probabilities each time
(same teams, different noise-level values) -- caught this because re-running the backtest
to confirm the defaults-revert produced a git diff on `data/backtest/*.json` that looked
like a real change but wasn't. Restored the committed files rather than commit re-run
noise. Not fixing the missing seed now (out of scope for this task, and determinism wasn't
broken by anything I changed) -- flagging it here so a future session doesn't waste time
debugging "why did the backtest numbers move" when nothing substantive changed.

**Honest next step, not done here:** if tuning is revisited, the more correct (and more
expensive) objective would optimize the real backtest metric directly -- refit the full
`StackingClassifier` per trial per tournament year and re-run the Monte Carlo checkpoints --
rather than the cheap XGBoost-only CV proxy used this time. Estimated a full StackingClassifier
fit (cv=5, 3 members) is meaningfully slower per trial than a lone XGBoost fit, which is why
the cheap proxy was tried first; parked rather than built given the negative result already
found with the cheap version didn't justify the extra build time in this session.

## 2026-07-04 — FastAPI model-serving layer + OpenTelemetry

PROJECT_BRAIN #12 item 2. `src/serving/app.py`: `POST /predict` scores any fixture on
demand (Layer 1 model + the un-blended heuristic baseline side by side), `GET /champions`
returns the live Layer 2 Monte Carlo P(champion) per team, `GET /health` reports which
model source is live. Auto docs at `/docs` (FastAPI default).

**Registry-load, not retrain-in-the-serving-layer:** added an optional `stack` param to
`Layer1Ensemble.__init__` (backward compatible -- existing callers still train fresh) so
the API can load the already-fitted sklearn `StackingClassifier` from the MLflow registry
(`tracking.load_latest_stack()`, mirroring `log_run`'s reachability-preflight pattern) and
skip refitting it. Elo/form timelines are still rebuilt locally at startup from historical +
live results, since those aren't part of the registered artifact -- the registry holds the
classifier, not the feature pipeline's state. Falls back to training a fresh ensemble
locally (same as `daily_update.py`, ~9s) if the registry is unreachable or empty, so the API
never hard-fails on a down MLflow server. **Live-verified the fallback path only** this
session (ran the real server, hit `/health` -> `/predict` -> `/champions`, got real numbers
matching a prior `daily_update.py` run almost exactly: Argentina .2534/France .2004/...) --
Docker Desktop wasn't running so the actual registry-load branch wasn't re-exercised live,
though it reuses the exact `mlflow.sklearn`/reachability calls already live-verified in
`log_run` (2026-07-03).

**`/champions` doesn't call the paid Odds API.** `daily_update.py` passes upcoming fixtures
from a live Odds API call into `live_bracket.build_2026_tree` so a drawn knockout match's
shootout winner can be inferred before its next fixture is itself logged as a completed
result (see `live_bracket.py`'s docstring). Calling a paid, rate-limited API on every hit to
a public serving endpoint would be wrong -- so this endpoint passes an empty fixture list
and accepts that one specific edge case self-corrects once real results catch up, exactly
like the daily pipeline already does for everything else. Champion probabilities are cached
after first computation (only recomputed on `?refresh=true` or process restart), since
they only change once a day.

**OpenTelemetry (`src/serving/otel.py`):** FastAPI auto-instrumented via
`FastAPIInstrumentor`; console span exporter by default since no collector
(Jaeger/Tempo/etc.) exists in this project yet, switching to OTLP if
`OTEL_EXPORTER_OTLP_ENDPOINT` is set. Import failure degrades to a no-op print, same
best-effort convention as every other optional-infra integration here. Verified real spans
print for `/health`, `/predict`, `/champions` in a live run.

**Testing:** `tests/test_serving.py` uses FastAPI's dependency-injection (`app.
dependency_overrides[get_model_state]`) with a fake ensemble/state stub, not the real
9-second local-training bootstrap -- keeps CI fast and deterministic. The real bootstrap
path is what got manually live-verified above instead.

**Docker:** `docker/serving/Dockerfile` (COPY-based, self-contained -- unlike Airflow's
bind-mounted image, this one needs to be deployable as-is to a cloud host later) + a
`serving` service in `docker-compose.airflow.yml` for local compose usage (bind-mounts
`src/`/`data/` there instead, for fast local iteration).

## 2026-07-04 — "Model vs reality" proof tracker

Dilip's explicit highest-value ask (PROJECT_BRAIN #12 item 3): an auditable track record
showing the model's pre-match call against what actually happened, not just aggregate
backtest numbers. Two pieces:

**Logic lives in `src/verification/proof_tracker.py`, not `scripts/`** — unlike
`daily_update.py` (which has no unit tests and is only integration-verified via live runs),
the join/grading/calibration logic here is pure and easy to get subtly wrong (which
snapshot to grade, how to score a 3-way outcome), so it got 6 pytest tests
(`tests/test_proof_tracker.py`) before touching real data. `scripts/verify_predictions.py`
is a thin I/O wrapper: fetch from Supabase, read the results CSV, call `build_report`,
write JSON. Matches the existing `src/` = logic, `scripts/` = entry point split.

**Grading uses the LAST pre-kickoff snapshot per fixture, not the first.** A fixture
shows up in `match_predictions` once per daily run for as long as it's still upcoming
(append-only table), so the same match can have several snapshots taken days apart.
Grading the one closest to kickoff is the model's most-informed call and the one that
best supports the "model said X right before kickoff" framing Dilip asked for; the
earlier ones are still in Supabase for anyone who wants the full evolution.

**Why Supabase and not the local JSON snapshots for predictions:** `data/live/
match_predictions_<ts>.json` is gitignored and each file only covers whatever was
upcoming on ONE run, so nothing durable survives locally across days once a fixture is
predicted, played, and rotates out of "upcoming." Supabase's `match_predictions` table
(added earlier today, append-only by design for exactly this reason) is the only place
the full pre-kickoff history exists. Results, by contrast, already had a durable local
source (`results_log.csv`, git-tracked) — no reason to add a second read path for those.

**Best-effort, not fail-open with empty data:** if Supabase is unreachable, the script
leaves any existing `dashboard/data/proof_tracker.json` untouched rather than overwriting
it with an empty one — a transient outage shouldn't make a previously-populated dashboard
regress to "no graded matches yet." Only writes an empty placeholder the very first time,
when no file exists at all (so the dashboard build never 404s on a missing import).

**Live-verified the join is correct, not just untested-but-plausible:** ran the script
against real Supabase data and got 0 graded matches. Confirmed this is the actual state of
the world (not a name-matching bug) by pulling both tables directly: all 8 predictions
logged today are for fixtures dated July 4–7 that haven't finished yet; the two completed
matches in `results_log.csv` predate the Supabase table's existence entirely (predictions
only started logging today, after those matches were already done, so they were never
"upcoming" and never got a snapshot). This will self-populate once the first predicted
knockout match completes.

**Calibration is built incrementally, every run, not just once at the end.** CLAUDE.md's
Tier 1 spec asks for a calibration/reliability diagram in the FINAL summary after July 19;
building the bucketing logic now (5 buckets by the model's confidence in whatever it
picked, `n` and hit-rate per bucket) means that final artifact is just "run the same
function on the full season" rather than new code written under deadline pressure later.

**Dashboard:** new `ProofTracker.tsx` section ("Live Track Record" / "Our AI vs Reality"),
placed right after the live results ticker and before the historical 2018/2022 backtest
section (renamed that section's eyebrow "Proof" → "Backtested" to avoid two sections both
claiming to be "the proof" — this one is live/current, that one is retrospective/historical).
Verified by temporarily swapping in synthetic graded-match data and checking the rendered
SSR HTML for the expected content (team names, confidence numbers, ✓/✗ markers, calibration
caption) — no Playwright browser available in this environment, so no pixel screenshot.
`npm run build` and `npm run lint` both pass clean against the real (currently-empty)
`proof_tracker.json`, exercising the same empty-state code path the live site will show
until the first knockout match finishes.

Wired as the second task in the Airflow DAG: `daily_update >> verify_predictions >>
export_dashboard_data` (needs `daily_update`'s fresh results/predictions; must run before
`export_dashboard_data` regenerates the dashboard's data folder, though in practice the two
write disjoint files so ordering only matters for keeping one clean commit-worthy state).

## 2026-07-04 — Live Layer 2: the model's own P(champion) now flows daily

The single biggest honesty gap in the system is closed: `predictions_log.csv` (and the
dashboard hero/chart) had only ever carried the bookmaker's outright market, honestly
labeled as a baseline, because the model's own tournament-winner probability needs a
Monte Carlo over the *remaining* 2026 bracket — and the bracket skeleton was never
encoded (parked 2026-07-02, promoted to top priority by Dilip 2026-07-04: "this should
happen for sure"). Bundled with the two data fixes it depends on.

**2026 group-stage + R32-opener backfill (`scripts/backfill_2026_group_stage.py`):** live
Elo/form previously jumped from ~2024 straight into the knockout rounds. All 72 group
matches + the June 28 South Africa–Canada R32 match are parsed from the *raw wikitext* of
the twelve Wikipedia group pages (`action=raw` + regex over `football box` templates) and
appended to `results_log.csv` with the same dedup rule as live ingestion. Raw wikitext,
not the rendered page: three consecutive WebFetch attempts against the rendered
knockout-stage page returned mutually contradictory bracket pairings (the summarizer
garbles bracket-table layouts), while the wikitext's `{{score link|...|Match NN}}`
templates are unambiguous — every match number below was verified there. The parser
fails loudly on unknown FIFA codes / unparsable scores rather than dropping matches, and
validates every mapped name against the historical dataset before writing. Wikipedia 403s
the default `requests` UA; a descriptive User-Agent fixes it.

**Team-name canonicalization (`src/ingestion/team_names.py`):** found while checking
names for the backfill — the Odds API says "USA"/"Bosnia & Herzegovina", the historical
dataset says "United States"/"Bosnia and Herzegovina", and Elo timelines key on exact
names. So live "USA" results were feeding a *brand-new* team at the default 1500 rating
instead of the real United States timeline — a genuine cause of the model-vs-bookmaker
gaps flagged on 2026-07-02 (PROJECT_BRAIN #8). `canonical()` is now applied to every
name at the ingestion boundary (results, fixtures, outrights, bookmaker outcome keys),
and existing log rows were migrated one-time (2 results cells, 7 predictions cells).
`flags.ts` already aliased both spellings, so the dashboard is unaffected.

**Bracket skeleton + partial-state simulator
(`src/models/layer2_simulation/live_bracket.py`):** unlike `bracket.py` (backtests,
completed brackets only), this encodes the official remaining bracket once — R16 matches
89–96 with real entrants, QF children (97=W89vW90, **98=W93vW94, 99=W91vW92** — NOT
sequential, verified against the wikitext score-link match numbers, a naive assumption
would have wired the semifinal quadrants wrong), SF 101=W97vW98 / 102=W99vW100 — and
resolves it against results into a tree whose nodes are either a known winner or a
pending match. Handles the nested case where an R16 slot is itself a pending R32 match
(Switzerland vs winner of Colombia–Ghana). Only results dated ≥ June 28 resolve ties:
group-stage meetings of future knockout pairings (e.g. Colombia–Portugal, both Group K)
must not count. **Knockout draws:** the Odds API score feed doesn't report shootout
winners, so a drawn tie stays "pending" (re-simulated) until either team appears in a
later-round fixture against a different opponent (`_infer_drawn_winner`) — self-healing
within a day, no manual data entry. The simulator itself is a ~40-line recursive resolve
with memoized advance probabilities, replacing nothing (the backtest simulator stays
as-is for the fixed-round completed-bracket case).

**Daily output:** `daily_update.py` now appends THREE series per day to the predictions
log + Supabase: `stacked_l2_montecarlo_v1` (the model), `heuristic_l2_montecarlo_v1`
(the FIFA-heuristic member alone through the same simulation — same baseline convention
as the Phase 0 backtest), and the existing `bookmaker_outright_baseline_v1`.
`export_dashboard_data.py` and `data.ts` pick the model series as primary (bookmaker as
fallback for pre-07-04 dates), so the hero/leaderboard/chart now show OUR model.

**First live run (2026-07-04):** model favorites Argentina 25.3% / France 20.0% / Spain
16.6% / Brazil 10.3% / Colombia 5.0% vs bookmaker France 31.4% / Argentina 16.2% / Spain
12.7% — same top cluster, real disagreement on the order, which is exactly what an
honest model-vs-market comparison should look like. 4 new tests (17-team empty state,
group-game exclusion, draw-then-fixture-inference, simulation sanity); 10 total pass;
dashboard builds clean.

Dilip created the Supabase project and pasted credentials into `.env`, surfacing two real
issues caught by actually connecting rather than trusting the code review below:

**Credentials swapped on first paste:** `SUPABASE_URL` initially held a new-format secret
API key (`sb_secret_...`) and the actual project URL was never pasted in. Recovered
without asking Dilip to re-fetch anything: the `service_role` value he put in
`SUPABASE_KEY` is a JWT whose payload includes the project ref (`{"ref": "...",
"role": "service_role", ...}`), so the correct `https://<ref>.supabase.co` URL was derived
by decoding it and confirmed working on the next connection test.

**`supabase-py`'s `realtime` dependency needs `websockets>=13` (for `websockets.asyncio`),
but this machine's global site-packages had `websockets==11.0.3`** (pulled in by some
other, unrelated project sharing the same global Python install -- no venv exists yet).
`_client()`'s own try/except caught the `ModuleNotFoundError` and correctly no-op'd rather
than crashing, but that meant it looked "configured but silently doing nothing" rather
than actually writing -- only caught by explicitly querying table row counts after a run,
not by the absence of an exception. Fixed by pinning `websockets==15.0.1` (newest version
still inside `realtime`'s `<16` ceiling). This does put `websockets` outside some unrelated
global package's own pin (`gradio-client<12`, not used anywhere in this repo) -- an
acceptable trade-off for now given there's no project-local venv; worth revisiting if a
dedicated venv gets set up later.

**Verified live:** ran `scripts/daily_update.py` for real (2026-07-04) -- 2 new
`match_results` rows, 8 `match_predictions` rows, 17 `tournament_predictions` rows, all
confirmed via a direct row-count query against the Supabase tables, matching the console
output exactly. Supabase is now a live third destination alongside the CSV/JSON logs.

## 2026-07-03 — Supabase as durable predictions/results store

First item of Dilip's 2026-07-03 feature list (PROJECT_BRAIN.md #12): the per-match
prediction snapshots (`data/live/match_predictions_*.json`) are gitignored and only ever
live on one disk, but they're the raw material for the "model vs reality" proof tracker
(#12 item 3) -- that needed fixing before anything downstream (proof tracker, FastAPI,
country dropdown) could be built on top of it.

**Design:** three tables (`supabase/schema.sql`) mirroring the three existing logs --
`match_results` (mirrors `results_log.csv`), `match_predictions` (mirrors the
`match_predictions_<ts>.json` snapshots), `tournament_predictions` (mirrors
`predictions_log.csv`). `match_predictions` is deliberately **append-only, no unique
constraint** -- unlike the other two tables, its whole point is a timestamped history of
every pre-kickoff snapshot for a fixture (probabilities can shift run to run as odds move),
which is exactly the "prediction evolving day by day" data the proof tracker and mission
statement need. The other two upsert on their natural key so re-running the pipeline never
duplicates a row.

**Client** (`src/ingestion/supabase_store.py`): every function is best-effort -- if
`SUPABASE_URL`/`SUPABASE_KEY` aren't set, or the project is unreachable, or the call
fails, it prints a warning and returns 0 rather than raising. Same fast-fail philosophy as
`tracking.py`'s MLflow preflight (`src/models/layer1_ensemble/tracking.py`): CSV/JSON stay
the source of truth and Supabase is additive, never a new way for the daily pipeline to
break. Verified: with no credentials configured, `_client()` returns `None` and every
insert/upsert call is a silent no-op (all 6 existing tests still pass unchanged).

**Wired in at two call sites, not a new script:** `live_results_store.append_new_results`
pushes newly-appended completed-match rows; `daily_update.py` pushes the scored fixture
list right after writing the JSON snapshot, and the outright tournament probabilities
right after the CSV append. `docker-compose.airflow.yml` already does `env_file: .env` for
every Airflow service, so no compose changes were needed -- Supabase credentials reach the
scheduler container automatically once added to `.env`.

**Not yet done (needs Dilip):** create the actual Supabase project (free tier), run
`supabase/schema.sql` in its SQL editor, and paste `SUPABASE_URL` + the `service_role` key
into `.env`. Until then the pipeline runs exactly as before, just without the Supabase
mirror. FastAPI serving layer (#12 item 2) and the proof tracker (#12 item 3) are next.

## 2026-07-03 — Stacked meta-learner, heuristic draw-rate fix, MLflow; two bugs caught by
actually running it

Closed two items explicitly approved in the 2026-07-02 late-night follow-up (see
`.claude` memory / next-session-plan): the ensemble's equal-weight blending and the
FIFA-heuristic's flat 25% draw rate, both logged there as known gaps. Bundled with
standing up MLflow, since retraining the ensemble is a natural place to log an
experiment.

**Stacked meta-learner** (`src/models/layer1_ensemble/ensemble.py`): replaced the
hand-rolled `sum(members.values()) / len(members)` equal-weight average with sklearn's
`StackingClassifier` (5-fold CV, `stack_method="predict_proba"`, `LogisticRegression`
final estimator). The FIFA heuristic isn't a fitted sklearn model, so it's wrapped in a
tiny `_FifaHeuristicEstimator(BaseEstimator, ClassifierMixin)` with a no-op `fit()` so it
can sit inside the stack next to XGBoost and the Elo/logreg member. Chose sklearn's
built-in stacking over hand-rolling the out-of-fold CV logic myself -- it's the
canonical, battle-tested implementation of exactly this pattern, so less custom code to
get subtly wrong. Result, re-running the Phase 0 backtest: avg Brier delta -0.0003 →
-0.0035, avg log-loss delta -0.0524 → -0.0987 (both more negative = bigger win over
baseline), same rising-trend and semifinal-checkpoint results as before -- a genuine
improvement, not a regression risk.

**Heuristic draw-rate fix** (`src/models/layer1_ensemble/heuristic.py`): flat 25%
`FIXED_DRAW_RATE` replaced with a Gaussian decay in the rank-points gap -- `PEAK_DRAW_RATE`
0.30 at an even match, `FLOOR_DRAW_RATE` 0.06 as the gap widens. XGBoost and the logistic
member already learned this shape from data; only the heuristic assumed a constant.

**MLflow** (`docker/mlflow/Dockerfile`, `docker-compose.airflow.yml`, new
`src/models/layer1_ensemble/tracking.py`): tracking server in the same compose file as
Airflow (same Docker network, reachable at `http://mlflow:5000` from the scheduler
container), sqlite backend store, `mlflow-artifacts:/` proxied artifact serving (see bug
below). Wired into two places: `backtest_2018_2022.py` logs one run per year with
per-checkpoint Brier/log-loss as step-indexed metrics (so the UI plots the trend across
the tournament); `daily_update.py` logs one run per day and registers the model
(`wc26-layer1-stacked-ensemble` in the Model Registry) -- the natural split between
"experiment tracking" (backtest, rich held-out metrics) and "production model
versioning" (daily, registry). Every call is wrapped in a **fast TCP preflight
(`_is_reachable`, 1.5s timeout, IPv4-only)** before touching the mlflow SDK at all, and a
broad try/except around the logging itself -- MLflow is supplementary, never allowed to
block or fail the actual pipeline run.

**Bug 1 -- artifact PermissionError, caught by actually triggering the DAG, not just
building the image:** first version of `docker/mlflow/Dockerfile` set
`--default-artifact-root /mlflow/artifacts` (a plain local path). The client
(`mlflow.sklearn.log_model`) resolves the experiment's artifact location and tries to
write there *directly from whichever container is running the client* -- which for
`daily_update.py` is the airflow-scheduler container, where `/mlflow` doesn't exist at
all. Fixed by switching to MLflow's proxied-artifact mode: `--default-artifact-root
mlflow-artifacts:/` + `--artifacts-destination /mlflow/artifacts` + `--serve-artifacts`,
so all artifact reads/writes go through the tracking server's own REST API instead of
requiring direct filesystem/volume access from every client container. Had to delete and
recreate the `mlflow-data` volume once, since `--default-artifact-root` only affects
newly-created experiments, not ones already registered under the old scheme.

**Bug 2 -- stuck `RUNNING` runs, caught by checking the MLflow API after "success," not
trusting the console output:** running `backtest_2018_2022.py` locally on Windows (not
in a container) crashed with `UnicodeEncodeError` on the emoji MLflow's fluent API prints
("🏃 View run..."), because Windows' default console codepage can't encode it. The crash
landed inside `with mlflow.start_run()`, after params/metrics/model had already logged
successfully but before the run could be marked `FINISHED` -- so the run sat as an
invisible zombie in `RUNNING` status server-side even though the broad try/except made
the script itself exit cleanly. Fixed at the source in `tracking.py`:
`sys.stdout.reconfigure(encoding="utf-8", errors="replace")` on import, so this whole
class of "library prints Unicode, Windows console can't encode it" bug can't recur for
any future addition to this module. Only visible by querying the MLflow REST API for run
status after the fact, not from "the script ran without an exception."

## 2026-07-03 — Airflow via Docker Desktop, LocalExecutor, not the full Celery stack

Round of 16 (July 4) is the stated automation deadline and `daily_update.py` +
`export_dashboard_data.py` were still being run by hand. Airflow doesn't run
natively on Windows (Linux/WSL only), and this machine had neither WSL nor
Docker installed. Considered three options: (a) Task Scheduler now + Airflow
later, (b) install WSL2/Docker and go straight to Airflow, (c) GitHub Actions
cron instead of Airflow. User chose (b), specifically via Docker Desktop
(which installs/enables WSL2 itself during setup, so no separate `wsl
--install` + reboot cycle was needed first).

Built a `docker-compose.airflow.yml` with **LocalExecutor**, not the official
Celery+Redis multi-worker compose file Airflow publishes -- this is a
single-DAG portfolio pipeline, not a multi-tenant cluster; LocalExecutor runs
tasks as subprocesses in the scheduler container, which is sufficient and
avoids standing up Redis + worker replicas for no benefit (Tier 1 spirit:
real automation, not gold-plated infra).

Design:
- `docker/airflow/Dockerfile` -- `apache/airflow:2.9.3-python3.10` + this
  repo's `requirements.txt` (extracted from `pip freeze` since none existed
  yet -- see below).
- Whole repo mounted read-write at `/opt/airflow/project` (not just `src/`)
  so the two scripts' `Path(__file__).resolve().parent.parent`-relative
  paths into `data/` and `dashboard/data/` resolve identically to a local
  run -- no code changes needed to make the scripts container-aware.
- `.env` loaded via `env_file` on every Airflow service, since
  `odds_api.py` reads `ODDS_API_KEY` via `os.environ.get` directly (no
  path assumptions to work around).
- DAG (`src/orchestration/dags/wc26_daily_pipeline.py`): two chained
  `BashOperator` tasks, `schedule="0 6 * * *"` (06:00 UTC -- after the
  prior day's matches have concluded), `catchup=False`, 1 retry / 10 min.
  `BashOperator` over `PythonOperator` so the DAG stays a thin wrapper and
  the scripts remain independently runnable exactly as documented in
  PROJECT_BRAIN.md #10, with zero Airflow-specific imports in `scripts/`.

Added a root `requirements.txt` as a side effect (pinned from the working
`pip freeze` versions) -- didn't exist before since local dev never needed
one; now required for a reproducible Docker build.

**Verified live, same day:** built the image, ran `airflow-init` (db migrate +
admin user), brought up `postgres` + `airflow-webserver` + `airflow-scheduler`.
DAG parsed with zero import errors. Unpausing it (with `catchup=False`)
triggered an automatic backfill run for the most recent past interval
(2026-07-02) which succeeded; a manual trigger for 2026-07-03 also succeeded.
Both runs appended real rows to `predictions_log.csv`, a real new result
(Switzerland 2-0 Algeria) landed in `results_log.csv`, and all 5
`dashboard/data/*.json` files regenerated with fresh data -- confirming the
container's mounted-volume write-back to the host works exactly as designed.
Containers run `restart: unless-stopped`, so the 06:00 UTC daily fire is now
unattended as long as Docker Desktop is running, including July 4 (Round of 16).

## 2026-07-02 — Dashboard built; two bugs caught by actually looking at it

Built the Next.js dashboard described in the entry below: animated hero, live favorites
leaderboard, probability-over-time chart, upcoming-fixture cards (model vs. bookmaker),
recent results, and the Phase 0 backtest validation section. Verified with Playwright
screenshots (desktop + mobile, real incremental scroll so `whileInView` animations
actually fire) rather than just a clean build -- caught two real bugs a build alone
wouldn't have:

- **Flag emoji don't render as flags on Windows Chrome** (a well-known platform gap --
  Windows historically lacks the regional-indicator flag glyphs, showing raw two-letter
  codes like "FR" instead). Switched to the `flag-icons` CSS/SVG library, which renders
  identically everywhere.
- **Hydration mismatch from `toLocaleDateString`/`toLocaleTimeString`** in the upcoming-
  fixtures cards -- server and browser locale/timezone can differ, so React threw a
  hydration error and had to re-render client-side. Replaced with a fixed, explicit UTC
  formatter (`formatKickoff` in `UpcomingMatches.tsx`) so server and client output match
  byte-for-byte.

Data freshness: `scripts/export_dashboard_data.py` must be re-run (and the site
redeployed) after each `scripts/daily_update.py` run to pick up new predictions -- see the
"Dashboard stack reversed" entry below for the freshness model.

## 2026-07-02 — Dashboard stack reversed: Next.js + Framer Motion, not Streamlit

Reverses the 2026-07-01 "Streamlit first" decision below. The ask shifted from "a working
chart" to "a genuinely impressive, animated site that amazes football fans" -- real motion
design (smooth transitions, an animated hero, live-feeling counters) means fighting
Streamlit's component model the whole way, and the result would still read as "a styled
Streamlit app," not a bespoke site.

**Why now, not earlier:** the original Streamlit call was explicitly about shipping
something live *fast* under the July 4 ingestion deadline; that deadline is now handled
(live pipeline is flowing, see the 2026-07-02 ingestion entries below), so the dashboard is
no longer on the critical path in the same way, and it's worth spending the build time the
better stack needs.

**Approach:** Next.js (App Router, TypeScript) + Tailwind + Framer Motion for animation +
Recharts for the probability-over-time chart, deployed on Vercel. A small Python export
step converts `data/predictions/predictions_log.csv`, `data/backtest/*.json`, and
`data/live/results_log.csv` into `dashboard/data/*.json` that the frontend reads at build
time -- keeps the site self-contained for deployment (no cross-directory file reads a
Vercel monorepo build might restrict) and avoids standing up a database for Tier 1.
**Freshness model:** the site is statically generated at build time from those JSON
snapshots; "daily-updating" comes from re-running the export + redeploying (via Vercel's
git integration) each time `scripts/daily_update.py` produces new data, not from client-side
polling -- consistent with "don't over-engineer storage" for Tier 1.

## 2026-07-02 — Live ingestion v1: Odds API only; Layer 2's own tournament-win output deferred

`scripts/daily_update.py` is the first working live pipeline: pulls completed results
(Odds API `/scores`, 3-day rolling window) into `data/live/results_log.csv`, rebuilds
Elo/form from historical + live matches, scores every upcoming/live fixture with Layer 1,
and logs the bookmaker's outright "wins the tournament" probabilities to
`data/predictions/predictions_log.csv` as `(date, team, win_probability, model_version)`.

**API-Football dropped entirely, not just RapidAPI.** Both the RapidAPI and the direct
api-football.com paths hit the same wall: `"Free plans do not have access to this season,
try from 2022 to 2024."` -- a structural free-tier restriction, not a subscription
hiccup. The Odds API's `/scores` endpoint (already integrated, already free) covers
fixtures + completed results well enough for daily cadence, so API-Football isn't needed
for Tier 1. `src/ingestion/api_football.py` is left in place, updated to the correct
direct-account host/header, in case a future need justifies revisiting it.

**2026 group-stage backfill skipped, by user decision.** Wikipedia's match-result tables
parse cleanly, but the matchday-to-date schedule table has rowspan/merged-cell issues
that make exact per-match dates unreliable to extract automatically, and team names differ
across historical CSV / Wikipedia / Odds API (e.g. "United States" vs "USA"), needing its
own alias-mapping layer. Given July 4 was 2 days out, we chose to ship the daily pipeline
now rather than keep sinking time into a fragile scrape. **Known consequence:** current
Elo/form doesn't yet reflect the 2026 group stage, only pre-tournament history -- visible
today as some sizeable model-vs-bookmaker disagreements (e.g. model ~50/50 on USA vs Bosnia
& Herzegovina, bookmaker ~85/15 USA). Revisit if time allows later.

**Layer 2's own P(wins World Cup) output for the live 2026 tournament is deferred**, not
faked. The Phase 0 backtest could reconstruct the bracket tree (who meets whom in each
future round) from *completed* results after the fact -- but live, future rounds' pairings
aren't derivable that way until they're actually played; encoding the official bracket
skeleton in advance (as FIFA publishes it, e.g. "Match 89: winner of Match 73 vs winner of
Match 74") is a real one-time task, not yet done. In the meantime, the bookmaker's own
outright market is logged in the exact `(date, team, win_probability, model_version)` shape
Layer 2's output will eventually take, so the predictions log and dashboard time series
start today, honestly labeled as a bookmaker baseline rather than our model.

## 2026-07-02 — API-Football blocked: RapidAPI key not subscribed to the API

`API_FOOTBALL_KEY` is a valid RapidAPI key but returns `403 "You are not
subscribed to this API"` from `api-football-v1.p.rapidapi.com/v3/status` and
`/fixtures`. The direct (non-RapidAPI) host `v3.football.api-sports.io` also
rejects it, but that host needs an entirely different key from
api-football.com's own dashboard -- not applicable here since CLAUDE.md
specifies RapidAPI.

**Why it matters:** fixtures/live-scores ingestion (the actual July 4 hard
date) is blocked until this is resolved.

**Fix (user action, not a code change):** subscribe to the free Basic plan
on the API-FOOTBALL listing in the RapidAPI dashboard -- no new key needed,
the existing key activates once subscribed. `src/ingestion/api_football.py`
is written and ready but unverified against a live response until then.

**Per CLAUDE.md's "flag immediately, don't silently mock" instruction:** no
mocked fixture data has been substituted. `scripts/fetch_live_snapshot.py`
surfaces the failure explicitly instead of masking it.

## 2026-07-02 — Odds API rate limits verified; outright market is a strong baseline

Checked against the live free-tier key: ~500 credits/month, and credit cost
scales with the number of `regions` requested (1 credit per region per
call), not with `markets`. Defaulting to a single region (`uk`) keeps each
snapshot pull to ~2 credits (h2h + outrights) -- trivially sustainable for
daily polling through July 19.

Also found `soccer_fifa_world_cup_winner` -- an **outright "wins the
tournament" market**, not just per-match odds. This gives a direct
bookmaker-implied P(win World Cup) per team, which is a stronger, more
directly comparable baseline for Layer 2's own output than the FIFA-rank
heuristic used in the Phase 0 backtest (bookmaker odds weren't available
for the 2018/2022 backtest itself -- see the Phase 0 backtest entry above --
but they are available now for live 2026 comparison, as CLAUDE.md intended).

## 2026-07-01 — Phase 0 backtest complete: results and design notes

Ran the full pipeline against 2018 and 2022. Results in `data/backtest/2018.json` and
`2022.json` (per-checkpoint team probabilities, champion trajectory, baseline comparison,
Brier/log-loss) -- see chat for the pass/fail verdict.

A few implementation decisions made while building this, not called out elsewhere:

- **XGBoost + Elo/logistic trained once per tournament, not per checkpoint.** Both are
  fit on real matches from 1992 up to the tournament's first match. Only the Elo rating,
  rolling form, and FIFA-rank features are re-queried "as of" each checkpoint date (using
  real results up to that point) -- so predictions change checkpoint to checkpoint via
  updated features, not via retraining. Matches CLAUDE.md's daily-cadence spirit (features
  update, model doesn't need to retrain every day) without adding real complexity for
  Phase 0.
- **Bracket tree reconstructed from actual match results, not hand-typed groups/seeding.**
  The real Round-of-16/QF/SF/Final fixture lists fully determine "who would face whom" at
  each round, worked out bottom-up by matching each round's participants back to the
  previous round's actual winners. No group-stage compositions or seeding rules needed to
  be hand-entered, which also sidesteps having to encode 2026's more complex 48-team
  seeding logic for this backtest (2018/2022 were simpler 32-team, direct-to-R16 formats).
- **Trivial baseline = the FIFA-heuristic ensemble member, run alone.** Rather than write a
  second "trivial baseline" formula, the baseline reuses Layer 1's own FIFA-rank heuristic
  member in isolation (un-blended). This directly tests the question the "lift over
  baseline" requirement is getting at: does blending in Elo + XGBoost actually help
  over the naive rank-based heuristic alone?
- **Match probabilities are memoized per checkpoint, not recomputed per Monte Carlo
  iteration.** Every simulated winner is still drawn from the same ~16-32 real entrants, so
  only a few dozen distinct matchups are ever possible within one checkpoint's bracket tree
  -- caching keeps 10,000 sims fast without needing batched/vectorized model inference.

## 2026-07-01 — Streamlit Community Cloud sleeps after inactivity

Chosen dashboard host is Streamlit Community Cloud (see "Dashboard stack" decision below).
Free-tier Community Cloud apps go to sleep after a period of no visitors and take ~30-60s
to wake on the next visit ("This app has gone to sleep" screen).

**Why it matters:** the dashboard is the primary recruiter-facing artifact. A cold-started
app looking broken/slow on first click is a bad first impression.

**Action before sharing the live link with anyone:** visit it ourselves shortly before
sending it out, and/or set up a low-frequency uptime ping (e.g. a free cron/uptime monitor
hitting the URL every ~20-30 min) to keep it warm. Tracked as a Tier-1 dashboard-phase
follow-up, not a Phase 0 blocker.

## 2026-07-01 — Dashboard stack: Streamlit (not Next.js/React)

Picked Streamlit + Streamlit Community Cloud over a Next.js/React app on Vercel.

**Why:** the rest of the stack (feature engineering, XGBoost, Monte Carlo simulation) is
Python, and the predictions log is a simple timestamped table — Streamlit's sweet spot,
with zero-config deploy straight from the GitHub repo. A Next.js app would need a separate
FastAPI serving layer plus a second toolchain, which is meaningfully more surface area given
the 19-day budget (today 2026-07-01, final 2026-07-19).

**Trade-off accepted:** Streamlit has a recognizable "data-science-demo" look. Plan is to
ship Streamlit first to guarantee something live fast, then apply real custom theming or
upgrade the frontend before 2026-07-19 so it reads as intentional rather than default —
see the "Streamlit sleeps" entry above for the other known rough edge.

## 2026-07-01 — Ensemble weighting for Layer 1 (Phase 0): equal weights

Layer 1 blends three members (XGBoost, Elo/logistic baseline, FIFA-rank heuristic) via a
plain equal-weighted average for Phase 0, rather than a learned meta-learner.

**Why:** CLAUDE.md permits "weighted average or a small meta-learner" — equal weighting is
the simplest version that still satisfies "stack it properly" (i.e., not shipping XGBoost
alone). A learned meta-learner needs a held-out validation set to fit weights on, which is
more machinery than Phase 0's goal (prove the two-layer methodology works at all) needs.

**Revisit:** once Phase 0's backtest numbers are in, consider whether per-member weights or
a logistic meta-learner meaningfully improves calibration before carrying this into Tier 1.

## 2026-07-01 — Historical data source: GitHub-mirrored dataset, not Kaggle API

Phase 0's historical match results and FIFA rankings are pulled from an open,
GitHub-hosted mirror rather than Kaggle's authenticated API.

**Why:** no Kaggle credentials are configured yet, and setting them up is a detour that
isn't on the critical path to validating the methodology. GitHub is directly reachable from
this environment (verified) and several international-results datasets are mirrored there
with no auth required.

## 2026-07-01 — Knockout draw resolution: 50/50 split of draw probability

CLAUDE.md's Layer 1 spec doesn't say how to convert a 3-outcome (win/draw/loss) prediction
into a binary advance-or-not probability for knockout matches (which end in a penalty
shootout after a draw, no replays). Phase 0 assumption: split the predicted draw-probability
mass 50/50 between the two teams before feeding the result into Layer 2's bracket simulation.

**Why:** simplest defensible placeholder; a rating-weighted penalty model would be more
realistic but is more precision than Phase 0's validation goal requires.

**Revisit:** if Phase 0 backtest results look off specifically in matches that historically
went to penalties, consider weighting the split by rating instead of a flat 50/50.
