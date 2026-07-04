# PROJECT_BRAIN.md — restart memory (rewritten 2026-07-04, verified against actual codebase)

Read this file first in a new session, then `DECISIONS.md` for full reasoning behind any
line here. This file is a **current-state snapshot**, not a chronological log — superseded
detail has been compressed out. Dates in parentheses are when something was built/verified,
not an indication it might be stale.

# 1. PROJECT GOAL
Daily-updating "who wins World Cup 2026" probability tracker as an MLOps job-search
portfolio project (see CLAUDE.md for full spec/tiers/hard dates). Final: July 19, 2026.
The dashboard is the #1 recruiter-facing deliverable — it is live and public (see #6).

# 2. SYSTEM ARCHITECTURE
```
historical CSVs (1872+) + The Odds API (live 2026 scores/odds)
  -> Elo/form feature timelines (leakage-safe as-of snapshots)
  -> Layer 1: stacked ensemble (XGBoost + Elo/logreg + FIFA heuristic, meta-learned blend)
  -> Layer 2: Monte Carlo over the REAL remaining 2026 bracket (live_bracket.py)
  -> predictions log (CSV + Supabase Postgres, durable)
  -> verify_predictions.py: grades finished fixtures vs their last pre-kickoff call
  -> export_dashboard_data.py -> dashboard/data/*.json
  -> Next.js dashboard, statically built, deployed on Vercel (PUBLIC, auto-deploys on push)

Also, in parallel:
  -> FastAPI serving layer (src/serving/app.py): score any fixture on demand, current
     P(champion) per team. Built + Dockerized + tested; Render blueprint ready,
     deploy pending (see #8).
```
Orchestration: Airflow (Docker Desktop), 3-task daily DAG, 06:00 UTC (see #6).
Tracking: MLflow (Docker Desktop), experiment + model registry (see #6).

# 3. CODEBASE STRUCTURE
```
CLAUDE.md            # project spec: methodology, tiers, hard dates (READ FIRST, not this file)
DECISIONS.md         # dated log of every non-trivial decision + full reasoning -- READ THIS for "why"
render.yaml          # Render Blueprint for the FastAPI serving layer
docker-compose.airflow.yml  # Postgres+Airflow, MLflow, and serving containers
data/historical/     # results.csv (1872+), fifa_ranking.csv (1992-2024), shootouts.csv
data/backtest/       # 2018.json, 2022.json -- Phase 0 validation output
data/live/           # results_log.csv (cumulative, git-tracked, 87 rows/48 teams as of 2026-07-04)
                     # + timestamped odds/prediction snapshots (gitignored, transient)
data/predictions/    # predictions_log.csv -- (date, team, win_probability, model_version)
data/tuning/         # Optuna output lands here if present; currently EMPTY on purpose (see #6)
src/features/        # data loading, FIFA-ranking as-of lookups, incremental Elo + rolling form
src/ingestion/       # Odds API client, live results store, Supabase client, team-name canonicalization
src/models/layer1_ensemble/  # feature rows, FIFA heuristic, stacked ensemble, MLflow tracking, tuning hooks
src/models/layer2_simulation/  # bracket reconstruction (backtest) + live bracket (2026) + Monte Carlo
src/verification/    # proof_tracker.py -- pure grading/calibration logic (tested)
src/serving/         # FastAPI app + OpenTelemetry instrumentation
src/orchestration/dags/  # Airflow DAG
scripts/             # all runnable entry points, see #10
dashboard/           # Next.js 16 App Router site, statically generated from dashboard/data/*.json
                     # LIVE at https://fifa2026mlops.vercel.app (also .../dashboard-hazel-kappa-52.vercel.app)
docker/{airflow,mlflow,serving}/Dockerfile
tests/               # 9 pytest files, 24 tests, all passing
k8s/, src/monitoring/  # still EMPTY -- planned only (Tier 2/3)
.env                 # ODDS_API_KEY, SUPABASE_URL/KEY, (API_FOOTBALL_KEY unused, see #7)
.obsidian/, graphify-out/, Untitled.md, "WC26 Dark*.{html,pdf}"  # NOT part of this system --
                     # user's own tooling / the design mockup source file (see #6). Leave alone.
```

# 4. CORE PIPELINE LOGIC
- **Ingestion:** `fetch_historical_data.py` (one-time). `daily_update.py` pulls Odds API
  `/scores` (rolling 3-day window) -> appends new completed matches to
  `data/live/results_log.csv` (dedup by date+teams, canonical team names) -> mirrors to
  Supabase `match_results` (best-effort).
- **Features:** `team_timeline.build_timelines()` -- per-team Elo (K=32, home adv 100) +
  rolling 10-match form, leakage-safe as-of snapshots (tested). FIFA rank via bisect lookup.
- **Training:** `Layer1Ensemble` trains fresh each run on 1992->cutoff (two symmetric rows
  per match). Can also load a pre-fit stack from the MLflow registry instead (serving layer).
- **Layer 2 (live):** `live_bracket.py` encodes the actual 2026 remaining-bracket skeleton,
  resolves it against real results (self-corrects shootout ambiguity as later fixtures
  appear), Monte Carlo (10,000 sims, seeded) over it using Layer 1's match probabilities.
- **Daily output (`daily_update.py`):** scores upcoming fixtures, writes a pre-kickoff
  snapshot to Supabase `match_predictions` (append-only) + local JSON, appends THREE
  tournament-winner series to `predictions_log.csv`/Supabase `tournament_predictions`:
  `stacked_l2_montecarlo_v1` (the model's own P(champion) -- the mission's centerpiece),
  `heuristic_l2_montecarlo_v1` (baseline), `bookmaker_outright_baseline_v1` (market).
- **Grading (`verify_predictions.py`):** joins each fixture's last pre-kickoff Supabase
  snapshot against its completed result once known; running accuracy/Brier/calibration.
- **Export (`export_dashboard_data.py`):** logs -> `dashboard/data/*.json`, incl. the team
  roster + alive/eliminated status (derived from `live_bracket`, not hand-maintained).

# 5. MODEL DETAILS
- Layer 1 = stacked meta-learner (sklearn `StackingClassifier`, 5-fold CV, logistic final
  estimator) over: XGBoost (6 features: elo_diff, form GF/GA/win-rate diffs, rank_diff,
  neutral), Elo/logreg baseline (elo_diff + neutral only), FIFA heuristic (closed-form,
  Gaussian-decay draw rate). Baseline for comparison = heuristic member alone.
- Layer 2 = Monte Carlo (not a model): `bracket.py` for backtests (completed tournaments),
  `live_bracket.py` for the real 2026 bracket in progress.
- **Backtest numbers (current, post-stacking, DEFAULT hyperparams -- verified 2026-07-04):**
  2018 France post-group->post-SF: .061/.128/.306/.622. 2022 Argentina: .216/.211/.495/.65.
  Avg model-baseline: Brier -0.0035, log-loss -0.0987 (negative = model beats baseline).
- **Hyperparameter tuning exists (Optuna, `scripts/tune_layer1.py`) but is NOT currently
  improving the shipped model** -- see #6. The numbers above are the untuned defaults.
- MLflow tracking + registry: experiment `wc26-layer1-ensemble`, registry
  `wc26-layer1-stacked-ensemble`. Best-effort (1.5s TCP preflight, never blocks the pipeline).

# 6. WHAT IS IMPLEMENTED (current state, grouped by area)

**Pipeline & data (2026-07-03/04):** Odds API ingestion (results, h2h odds, outright
market); live 2026 results log (87 rows, 48 teams, backfilled from Wikipedia + live
updates); leakage-safe Elo/form features; team-name canonicalization across ingestion
points; live Layer 2 (real 2026 bracket, self-correcting shootout resolution); Supabase as
the durable store (3 tables: `match_results`, `match_predictions` append-only,
`tournament_predictions`), best-effort client, live-verified with real rows.

**Orchestration & tracking:** Airflow in Docker (3-task DAG: `daily_update` ->
`verify_predictions` -> `export_dashboard_data`, 06:00 UTC daily, `restart:
unless-stopped`). MLflow tracking + model registry, best-effort, two early bugs found and
fixed (artifact permissions, Windows console encoding).

**Model quality:** Stacked meta-learner beats the heuristic baseline on average across both
backtested tournaments. Optuna tuning capability built and run for real (30-trial study,
3-fold CV on the XGBoost member) — **honest result: it improved isolated XGBoost CV log-loss
but made the actual backtest metric marginally WORSE (proxy-metric-vs-true-objective
mismatch)**. The regressing tuned-params file was deleted; the pipeline runs on
`DEFAULT_XGB_PARAMS`. Tuning capability ships and is tested; don't assume the model is
"tuned" — it isn't, yet. Also known (not fixed, low priority): no `random_state` set on
`XGBClassifier`/`StackingClassifier`, so re-running the backtest at all produces slightly
different per-team probabilities each time even with unchanged params.

**Proof tracker ("model vs reality"):** `src/verification/proof_tracker.py` (pure, tested)
joins each fixture's last pre-kickoff Supabase snapshot against its result once known;
grades model vs bookmaker, builds a 5-bucket calibration breakdown incrementally every day.
`ProofTracker.tsx` dashboard section ("Live Track Record"). Currently 0 graded matches —
real, not a bug (nothing predicted so far has finished yet); self-populates as R16+
matches complete.

**FastAPI serving layer + OpenTelemetry:** `src/serving/app.py` — `POST /predict` (score
any fixture), `GET /champions` (live Layer 2 P(champion) per team, cached), `GET /health`.
Loads the fitted model from the MLflow registry when reachable, else trains locally (~9s).
`/champions` doesn't call the paid Odds API (documented tradeoff, one shootout-inference
edge case self-corrects like the rest of the pipeline). OpenTelemetry auto-instruments
FastAPI (console exporter by default). Dockerized. Live-verified locally end-to-end
(health/predict/champions all correct) — only the MLflow-unreachable fallback path was
re-exercised live this session; the registry-load branch reuses already-proven code but
wasn't independently re-tested. **Not yet deployed publicly** — see #8.

**Dashboard — full redesign (2026-07-04):** Ported a Claude-designed mockup
(`WC26 Dark Standalone.html`, provided by Dilip) faithfully: warm near-black (#0d0c0a) +
cream (#f2ede0) + single olive accent (#C2D588), replacing the earlier neon cyan/magenta
theme. Big Shoulders Display / Manrope / IBM Plex Mono / Lora fonts. Team-code chips (ARG,
FRA...) replacing flag icons in most sections, matching the mockup's own choice (though
`Flag.tsx`/`flags.ts` are back in real use for the country dropdown below). Fixed nav bar,
true infinite-marquee results ticker, CSS/SVG hero globe (built from scratch rather than
embed the mockup's rotating-earth JPEG of unknown license — same copyright caution already
applied to player-likeness silhouettes). Sections: hero, stats strip, live leaderboard,
country lookup, day-by-day chart, upcoming fixtures, results ticker, live track record
(proof tracker), backtested history (2018/2022), methodology, tech stack, footer.

**"Check your country" dropdown:** `CountryLookup.tsx` — all 48 teams (roster derived from
`results_log.csv`, not hand-maintained), alive/eliminated status reused from
`live_bracket`, current P(champion) or last-tracked value, hand-rolled SVG sparkline.
Deliberately scoped to the 48 qualified teams, not a full ~211-country list with a "not
qualified" state (low-value busywork).

**Public deployment:** Dashboard is LIVE at **https://fifa2026mlops.vercel.app** (friendly
custom alias) and **https://dashboard-hazel-kappa-52.vercel.app** (original). Auto-deploys
on every push to `main`. GitHub Actions CI (pytest + dashboard lint/build) on every push.
**Two real Vercel bugs found and fixed this session, both worth knowing about:**
(1) `dashboard/package-lock.json` was out of sync (missing `@emnapi/*` lock entries),
failing `npm ci` on Linux CI even though `npm install` locally papered over it — fixed by a
clean lockfile regen. (2) The git-integration auto-deploy silently failed on EVERY push
after connecting it (repo is a monorepo, Next.js app lives in `dashboard/` not the repo
root, and Vercel's git build defaulted to the repo root) — the production alias just
stayed pinned to the last manual deploy, masking the failure. Fixed via the project's
"Root Directory" setting (dashboard-only, no CLI flag exists for it). **Lesson: a
green push/CI does not mean the live site actually updated when a host's git integration
is involved — verify the live URL's content directly.** Also disabled Vercel's SSO/
deployment-protection wall (was blocking public access to anything but the one
grandfathered production URL) — confirmed with Dilip this is intended (public portfolio
site, no secrets in the frontend build).

# 7. WHAT IS PARTIALLY DONE
- `api_football.py`: code exists but free tier rejects season 2026 — dropped from the
  pipeline, kept for reference. Odds API is the sole live source.
- Dashboard freshness: static-at-build (rebuild triggered by every push via CI/Vercel, so
  in practice this is fine day-to-day, just not literally real-time).
- Optuna tuning: capability built and run, but hasn't yet found a real improvement — see #6.

# 8. WHAT IS MISSING / NEXT
In priority order for the next session:
1. **Render deploy of the FastAPI serving layer** — `render.yaml` blueprint is ready and
   Dilip has the Render Blueprint review screen open (repo connected, `wc26-serving`
   service detected correctly). Needs: click deploy, then verify the live URL (health/
   predict/champions) same as was done locally. This closes the last real MLOps-JD gap
   (no cloud-compute touchpoint besides Vercel's static hosting + Supabase's DB-as-a-service).
2. **Chatbot** (floating widget, FIFA/match Q&A backed by this system's own data via the
   FastAPI layer) — **BLOCKED on an LLM API key from Dilip (Anthropic).** Ask for it early.
3. **Evidently drift monitoring** (Tier 2) — data (Elo/rank feature distributions over
   time) already exists, should be cheap to add.
4. **kind/minikube K8s manifests** for the FastAPI service (Tier 2) — deploy the same
   Docker image locally with plain manifests, no KServe (explicitly rejected, see #9).
5. **Calibration/reliability diagram, final version** (Tier 1, due after July 19) — the
   proof tracker's per-run calibration buckets (already built) are the building block, not
   the final artifact; re-run the same logic over the full season once the tournament ends.
6. README screenshot/GIF for the repo's front page.
7. Prometheus/Grafana (Tier 3, only if days remain).

**Explicitly rejected/scoped out — don't re-propose these:**
- KServe (needs Knative/Istio on kind, days of fragile setup) — use plain FastAPI + Docker
  + K8s manifests instead (item 4 above).
- Redis (once-daily data updates = nothing meaningful to cache; would read as
  over-engineering in interviews).
- DVC, Terraform, ArgoCD/Flux/GitOps (dataset is small and already versioned via git +
  Supabase; the rest is ceremony with negative ROI for a single free-tier deployment in a
  ~2-week window).
- Fly.io (its CLI installer needs a `curl|iex`-style remote script the sandbox blocks
  without explicit user approval each time — used Render instead, no new CLI needed).
- A full ~211-country dropdown with a "not qualified" state — scoped to the 48 real 2026
  teams instead (see #6).
- Replit-based dashboard redesign — superseded; the redesign happened via a
  Claude-generated mockup file Dilip provided directly, not a live Replit session.

# 9. KEY DESIGN DECISIONS (see DECISIONS.md for full reasoning on each)
- Stacked meta-learner (not equal-weight averaging) for Layer 1.
- Heuristic draw rate: Gaussian decay in the rank gap, not flat 25%. Knockout draws still
  resolve 50/50 (simplification; proper fix = Poisson/Dixon-Coles, parked stretch goal).
- Bracket reconstructed from real results, not hand-typed seeding.
- Train fresh each `daily_update.py` run (~9s, cheap) rather than train-once-per-tournament;
  MLflow versions each day's model. The serving layer can instead load a registered model.
- Trivial baseline = the ensemble's own heuristic member alone, logged alongside the model.
- API-Football abandoned (season lock); Odds API is the sole live source, ~2-3 credits/day
  against a ~500/month budget.
- Dashboard: Next.js over Streamlit; no real player photos or unlicensed stock imagery
  anywhere (copyright caution applied twice now — player silhouettes, then the hero globe).
- Secrets in `.env` (gitignored); `.env.example` committed.
- Every optional-infra integration (MLflow, Supabase, MLflow-registry-load in serving) is
  best-effort: fails fast, never blocks the actual pipeline/API.
- Render over Fly.io for the serving deploy (no CLI installer needed, git-connected
  Blueprint instead).
- Vercel SSO/deployment-protection disabled by explicit user confirmation — this is a
  public portfolio site with no frontend secrets, protection made it inaccessible to the
  people it's for.

# 10. ENTRY POINTS
```
python scripts/fetch_historical_data.py     # one-time: pull 3 historical CSVs
python scripts/backtest_2018_2022.py        # Phase 0 backtest -> data/backtest/*.json + console summary
python scripts/daily_update.py              # THE daily job: results->features->L1 scoring->L2 Monte Carlo->predictions log
python scripts/backfill_2026_group_stage.py # one-time (already run): Wikipedia group-stage backfill
python scripts/verify_predictions.py        # grades finished fixtures -> dashboard/data/proof_tracker.json
python scripts/export_dashboard_data.py     # logs -> dashboard/data/*.json (run after daily_update + verify_predictions)
python scripts/tune_layer1.py               # Optuna tuning pass (see #6: hasn't beaten defaults yet)
python scripts/fetch_live_snapshot.py       # raw odds/fixtures snapshot (superseded by daily_update)
python -m pytest tests/ -q                  # 24 tests
uvicorn src.serving.app:app --port 8000     # FastAPI serving layer -- docs at localhost:8000/docs
cd dashboard && npm run dev                 # local dev server at localhost:3000

docker compose -f docker-compose.airflow.yml up -d   # Postgres + Airflow + MLflow + serving, all local
# Airflow UI: localhost:8080 (admin/admin) -- wc26_daily_pipeline DAG, 06:00 UTC daily
# MLflow UI: localhost:5000 -- experiment "wc26-layer1-ensemble", registry "wc26-layer1-stacked-ensemble"

# LIVE PUBLIC URLS:
# Dashboard: https://fifa2026mlops.vercel.app (also https://dashboard-hazel-kappa-52.vercel.app)
# FastAPI serving: pending Render deploy (render.yaml ready, see #8 item 1)
```
Requires: Python 3.10 (pandas, numpy, sklearn, xgboost, mlflow, fastapi, uvicorn,
opentelemetry-*, optuna, supabase -- see requirements.txt), Node 24, `.env` with
`ODDS_API_KEY`/`SUPABASE_URL`/`SUPABASE_KEY`, Docker Desktop (for local Airflow/MLflow/
serving only -- NOT required for the live Vercel dashboard, which is fully static).
