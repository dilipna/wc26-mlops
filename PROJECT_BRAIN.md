# PROJECT_BRAIN.md — restart memory (generated 2026-07-02, verified against actual codebase)

# 1. PROJECT GOAL
Daily-updating "who wins World Cup 2026" probability tracker as an MLOps job-search portfolio project. Hard dates: daily pipeline must run automatically before July 4, 2026 (Round of 16); final July 19, 2026. Recruiter-facing dashboard is the top deliverable (per CLAUDE.md).

# 2. SYSTEM ARCHITECTURE
Flow: historical CSVs + The Odds API → Elo/form feature timelines → Layer 1 match-probability ensemble → Layer 2 Monte Carlo bracket simulation → JSON/CSV prediction logs → export script → static Next.js dashboard.

Modules:
- `src/features/` — data loading, FIFA-ranking as-of lookups, incremental Elo + rolling form
- `src/ingestion/` — Odds API client (working), API-Football client (dead-end), live results store
- `src/models/layer1_ensemble/` — feature rows, FIFA heuristic, 3-model blended ensemble
- `src/models/layer2_simulation/` — bracket reconstruction + Monte Carlo simulator
- `scripts/` — all entry points (no orchestration exists; everything is manual)
- `dashboard/` — Next.js 16 App Router site, statically generated from `dashboard/data/*.json`

# 3. CODEBASE STRUCTURE
```
CLAUDE.md            # project spec: methodology, tiers, hard dates (READ FIRST)
DECISIONS.md         # dated log of every non-trivial decision + reasoning
data/historical/     # results.csv (1872+), fifa_ranking.csv (1992-2024), shootouts.csv
data/backtest/       # 2018.json, 2022.json — Phase 0 validation output
data/live/           # results_log.csv (cumulative, git-tracked) + timestamped odds/prediction snapshots (gitignored)
data/predictions/    # predictions_log.csv — (date, team, win_probability, model_version)
src/                 # see #2
scripts/             # 5 runnable scripts, see #10
dashboard/           # Next.js site; dashboard/data/*.json is its only data source
tests/               # 4 pytest files, 6 tests, all passing
k8s/, src/orchestration/, src/serving/, src/monitoring/   # EMPTY — planned only
.env                 # ODDS_API_KEY (works), API_FOOTBALL_KEY (useless, see #7)
.obsidian/, graphify-out/, Untitled.md  # NOT part of this system. Confirmed via graphify-out/.graphify_detect.json:
                     # user ran the `graphifyy` CLI (installed via `uv tool install`) against this repo;
                     # it scanned 71 files (~16k words) and concluded "needs_graph: false" (fits one
                     # context window). .obsidian/ is an Obsidian vault config; Untitled.md is empty.
                     # These are the user's own context-tooling, unrelated to the WC26 pipeline/dashboard.
```

# 4. CORE PIPELINE LOGIC
- Ingestion: `fetch_historical_data.py` pulls 3 CSVs from open GitHub mirrors (no auth). `daily_update.py` pulls Odds API `/scores` (rolling 3-day window, free-tier cap) → appends new completed matches to `data/live/results_log.csv` (dedup by date+teams).
- Features: `team_timeline.build_timelines()` — single chronological pass over historical+live matches → per-team Elo (K=32, home adv 100, goal-diff multiplier) + rolling 10-match form. `snapshot_as_of()` returns state strictly before a date (leakage-safe, tested). FIFA rank points via bisect as-of lookup; name aliases in `rankings.py` / `flags.ts`.
- Training: `Layer1Ensemble.__init__` trains per run on matches 1992→cutoff. Two symmetric rows per match (home/away perspectives). 3-class labels (loss/draw/win).
- Inference/simulation: `monte_carlo.simulate_champion_probabilities()` — 10,000 sims of a real bracket from any start round, match probs memoized, seeded RNG (42). Knockout advance prob = P(win) + 0.5·P(draw).
- Daily output: `daily_update.py` scores upcoming fixtures (model vs de-vigged bookmaker h2h) → `data/live/match_predictions_<ts>.json`; appends bookmaker outright de-vigged probs to `predictions_log.csv` as `model_version=bookmaker_outright_baseline_v1`. `export_dashboard_data.py` converts logs → `dashboard/data/*.json`.

# 5. MODEL DETAILS
- Layer 1 = **stacked meta-learner** (sklearn `StackingClassifier`, 5-fold CV, `LogisticRegression` final estimator over 3 members' predict_proba) over: (a) XGBClassifier multi:softprob, 200 trees, depth 4, lr 0.1, 6 features (elo_diff, form GF/GA/win-rate diffs, rank_points_diff, neutral); (b) LogisticRegression on [elo_diff, neutral] only; (c) FIFA heuristic `1/(1+10^(-rank_diff/200))` with a Gaussian-decay draw rate (0.30 peak at even match → 0.06 floor as the gap widens, `heuristic.py`) — replaced 2026-07-03, was flat 25%. Replaced 2026-07-03: was equal-weight averaging, see DECISIONS.md.
- Baseline for comparison = heuristic member alone (un-blended).
- Layer 2 = Monte Carlo (not a model): bracket tree built bottom-up from actual completed results (`bracket.py`, expects 64 matches, 32-team format; penalty winners from shootouts.csv).
- Backtest results (data/backtest/*.json, re-run 2026-07-03 post-stacking): champion P(win) post-group→post-SF: 2018 France .061→.128→.306→.622; 2022 Argentina .216→.211→.495→.65. Avg model−baseline: Brier −0.0035, log-loss −0.0987 (both improved ~7-10x vs the pre-stacking equal-weight numbers below; model still loses to baseline at 2018 post-SF checkpoint, same as before).
  - Pre-stacking numbers (superseded): Brier −0.0003, log-loss −0.0524.
- **MLflow experiment tracking + model registry (2026-07-03, live-verified):** `backtest_2018_2022.py` logs one run/year with step-indexed per-checkpoint Brier/log-loss; `daily_update.py` logs one run/day and registers the model as `wc26-layer1-stacked-ensemble`. Tracking server: `docker/mlflow/Dockerfile` + `mlflow` service in `docker-compose.airflow.yml`, sqlite backend, `mlflow-artifacts:/` proxied artifact serving (localhost:5000). `src/models/layer1_ensemble/tracking.py` fast-fails (1.5s TCP preflight) if the server's down so it never blocks the pipeline. Two bugs found and fixed live — see DECISIONS.md 2026-07-03 entry: (1) artifact PermissionError from non-proxied local-path artifact root, (2) runs stuck `RUNNING` from a Windows-console UnicodeEncodeError on mlflow's own emoji print, fixed via `sys.stdout.reconfigure(encoding="utf-8")`.

# 6. WHAT IS IMPLEMENTED
- **Live Layer 2 (2026-07-04, live-verified):** official 2026 remaining-bracket skeleton encoded
  (`src/models/layer2_simulation/live_bracket.py`, match numbers verified from Wikipedia RAW wikitext — QF pairing
  is 97=W89vW90, 98=W93vW94, 99=W91vW92, 100=W95vW96, NOT sequential), partial-state tree resolution (drawn ties
  stay pending until the shootout winner appears in a later-round fixture), Monte Carlo over the remaining bracket.
  `daily_update.py` now logs THREE series daily: `stacked_l2_montecarlo_v1` (the model's own P(champion) — the
  mission's centerpiece), `heuristic_l2_montecarlo_v1` (baseline), `bookmaker_outright_baseline_v1`. Dashboard
  hero/chart prefer the model series. First run: model says Argentina .253 / France .200 / Spain .166 vs bookmaker
  France .314 / Argentina .162.
- **2026 Elo backfill + name canonicalization (2026-07-04):** all 72 group matches + June 28 R32 opener parsed from
  Wikipedia raw wikitext into `results_log.csv` (87 rows total, 48 teams) via `scripts/backfill_2026_group_stage.py`;
  `src/ingestion/team_names.py` maps Odds API names → historical-dataset names at every ingestion point (the "USA"
  vs "United States" split had live USA results feeding a fresh default-1500 Elo team — now fixed, old rows migrated).
- Phase 0 backtest end-to-end, passing agreed success bar
- Odds API ingestion: h2h odds, outright winner market (de-vig = mean implied price, normalized), `/scores` results
- Cumulative live results log with dedup; leakage-safe feature pipeline
- Manual daily update script (verified live 2026-07-02: 8 results, 11 fixtures scored, 23 teams logged)
- Dashboard: neon-themed (Orbitron/Rajdhani, cyan/magenta), animated №10/№7 SVG figures, leaderboard, time-series chart, AI-vs-market fixture cards, results ticker, backtest-proof section, tech-stack section; hydration-safe UTC dates; flag-icons lib. Verified via Playwright screenshots desktop+mobile; builds clean; runs at localhost:3000 (`npm run dev`)
- 6 pytest tests (bracket reconstruction incl. penalty finals, Elo leakage-safety, de-vig, results-store dedup)
- Git pushed to https://github.com/dilipna/wc26-mlops
- **Daily automation (2026-07-03): Airflow via Docker Desktop, verified live.** `docker-compose.airflow.yml`
  (Postgres + Airflow webserver/scheduler, LocalExecutor) + `docker/airflow/Dockerfile` (apache/airflow:2.9.3-python3.10
  + root `requirements.txt`, new file) + `src/orchestration/dags/wc26_daily_pipeline.py` (BashOperator
  `daily_update.py` >> `export_dashboard_data.py`, `schedule="0 6 * * *"`, `catchup=False`). Whole repo mounted
  read-write at `/opt/airflow/project` so scripts' relative paths need no changes. Live-verified: unpausing
  triggered an auto backfill run for 2026-07-02 (success) plus a manual trigger for 2026-07-03 (success) — both
  appended real rows to `predictions_log.csv` and regenerated all 5 `dashboard/data/*.json` files. Containers use
  `restart: unless-stopped`, so the scheduler will fire automatically at 06:00 UTC daily (incl. tomorrow, July 4,
  Round of 16) as long as Docker Desktop is running. Airflow UI: localhost:8080 (admin/admin).

# 7. WHAT IS PARTIALLY DONE
- `api_football.py`: code exists (direct api-sports.io host) but free tier rejects season 2026 on both RapidAPI and direct ("try from 2022 to 2024") — dropped from pipeline, kept for reference
- Dashboard freshness: static-at-build; requires re-running export + rebuild to update (documented in DECISIONS.md)

# 8. WHAT IS MISSING
- Flat 50/50 knockout draw split (unchanged; stacking + heuristic draw-rate fix done 2026-07-03, see #5/#6). Live Layer 2 + Elo backfill DONE 2026-07-04, see #6.
- FastAPI, DVC, Evidently, Prometheus/Grafana, Kubernetes, chatbot (empty dirs / not started) — Airflow, Docker, MLflow, Supabase now done, see #6
- Public deploy (Vercel planned), calibration/reliability diagram (Tier 1 requirement for final summary), README screenshot/GIF

# 9. KEY DESIGN DECISIONS (FROM CODE / DECISIONS.md)
- Stacked meta-learner (sklearn StackingClassifier, 5-fold CV) for Layer 1, replacing the earlier equal-weight average — done 2026-07-03
- Knockout draws → 50/50 split (unchanged); heuristic draw rate now a Gaussian decay in the rank gap (0.30→0.06), was flat 0.25 — fixed 2026-07-03
- Bracket reconstructed from real results, not hand-typed seeding (sidesteps 2026 48-team seeding rules for backtests)
- Train once per tournament; predictions change via as-of features, not retraining — though daily_update.py actually retrains fresh each run (cheap, ~9s) since the training-set cutoff advances daily; MLflow now versions each day's model in the registry
- Trivial baseline = ensemble's own heuristic member alone
- API-Football abandoned (free-tier season lock), Odds API is sole live source; each daily_update.py run makes 3 paid calls (fetch_scores + fetch_match_odds + fetch_outright_probabilities); the latter two use region="uk" (1 region = ~1 credit each per DECISIONS.md finding that cost scales with regions, not markets), so a daily run costs roughly 2-3 credits against a ~500/month budget
- Dashboard: Next.js chosen over Streamlit (reversal, logged); no real player photos (copyright/likeness) → original SVG silhouettes; results_log.csv git-tracked because the 3-day API window makes it the only cumulative record
- Secrets in .env (gitignored); .env.example committed
- MLflow tracking calls are best-effort: fast TCP preflight (1.5s) + broad try/except, so an unreachable/down tracking server never blocks daily_update.py or backtest_2018_2022.py — see DECISIONS.md 2026-07-03

# 10. ENTRY POINTS
```
python scripts/fetch_historical_data.py    # one-time: pull 3 historical CSVs
python scripts/backtest_2018_2022.py       # Phase 0 backtest → data/backtest/*.json + console summary
python scripts/daily_update.py             # THE daily job: results→features→L1 scoring→L2 Monte Carlo→predictions log
python scripts/backfill_2026_group_stage.py # one-time (already run 2026-07-04): Wikipedia group-stage backfill
python scripts/export_dashboard_data.py    # logs → dashboard/data/*.json (run after daily_update)
python scripts/fetch_live_snapshot.py      # raw odds/fixtures snapshot (superseded by daily_update)
python -m pytest tests/ -q                 # 6 tests
cd dashboard && npm run dev                # site at localhost:3000

docker compose -f docker-compose.airflow.yml up -d   # Postgres + Airflow (webserver/scheduler) + MLflow
# Airflow UI: localhost:8080 (admin/admin) -- wc26_daily_pipeline DAG, @ 06:00 UTC daily
# MLflow UI: localhost:5000 -- experiment "wc26-layer1-ensemble", registry "wc26-layer1-stacked-ensemble"
```
Requires: Python 3.10 (pandas, numpy, sklearn, xgboost, requests, python-dotenv, pytest, mlflow — see requirements.txt, new file), Node 24, `.env` with ODDS_API_KEY, Docker Desktop (running, for Airflow/MLflow).

# 11. NEXT STEP (CRITICAL)
1. ~~Airflow DAG wrapping daily_update.py + export_dashboard_data.py~~ — DONE 2026-07-03, live-verified, see #6. The
   July 4 deadline risk is resolved as long as Docker Desktop stays running (containers are `restart: unless-stopped`).
2. ~~MLflow + stacked meta-learner + heuristic draw-rate fix~~ — DONE 2026-07-03, live-verified, see #5/#6.
3. **NEW: Dilip's 2026-07-03 feature list — see #12, this supersedes the old ordering.** The infra tail
   (DVC → Evidently/Prometheus/Grafana → kind/minikube K8s) is still wanted but comes after #12's items.
4. Higher-prediction-value alternatives explicitly parked, raise with user: 2026 group-stage Elo backfill; encode official 2026 bracket skeleton to turn on live Layer 2.

# 12. USER-REQUESTED FEATURES (Dilip, 2026-07-03 — agreed plan for next session, NOT yet built)

Suggested build order (dependency-driven: storage first, then API, then the three UI features that need them):

**1. Supabase as the durable predictions/results store — DONE and LIVE-VERIFIED 2026-07-04.**
`supabase/schema.sql` (3 tables: `match_results`, `match_predictions` append-only, `tournament_predictions`),
`src/ingestion/supabase_store.py` (best-effort client, no-op if unconfigured), wired into
`live_results_store.append_new_results` + `daily_update.py`. All 6 tests still pass. Live-verified 2026-07-04:
a real `daily_update.py` run wrote 2 `match_results`, 8 `match_predictions`, 17 `tournament_predictions` rows,
confirmed via direct Supabase queries. Two bugs caught during setup (credentials pasted into the wrong .env
fields, outdated global `websockets` package) — see DECISIONS.md 2026-07-04 entry.
Next: dashboard reading live Supabase data instead of static-at-build JSON (fixes #7's freshness gap) is not
yet done -- the dashboard still reads `dashboard/data/*.json` via the export script. Revisit once the FastAPI
serving layer (item 2) or a direct Supabase read path is in place.

**2. FastAPI serving layer (goes WITH Supabase, not instead of it — different layers).**
Decision discussed 2026-07-03: FastAPI = the model-serving service (score any fixture on demand, current
P(champion) per team, loads model from MLflow registry `wc26-layer1-stacked-ensemble`); Supabase = the database.
Both, together, is the strongest portfolio combo. FastAPI is also the natural backend for the chatbot (item 5).
Add as a service in docker-compose. `src/serving/` is the empty dir waiting for it.
**Redis: discussed and REJECTED (honest-pushback)** — recruiter-level traffic + once-daily data updates = nothing
to cache; adding it would read as over-engineering in interviews. Revisit only if something real needs it.

**3. "Model vs reality" proof tracker — HIGHEST recruiter value, Dilip's explicit ask.**
Dashboard section acting as an auditable track record: every day the model's pre-match probabilities are logged
(timestamped, BEFORE kickoff); after each match completes, a verification job joins prediction ↔ result and the
dashboard shows e.g. "July 2, 10:04 UTC: model said 61% Spain — Spain won 3-0 ✓", with running accuracy /
Brier / calibration stats and model-vs-bookmaker comparison. Most raw data ALREADY exists (match_predictions
snapshots + results_log.csv); what's missing is durability (item 1), the join/verification job (add as a third
Airflow DAG task after daily_update), and the UI. This directly serves CLAUDE.md's core mission ("dashboard that
shows the prediction evolving day by day against the eventual real result").

**4. "Check your country's prediction" dropdown.**
Dashboard feature: dropdown of all national teams (with flag-icons, aliases in flags.ts/rankings.py) → shows that
team's current P(champion), probability-over-time sparkline, status (alive/eliminated/not qualified). Data source:
predictions log (via Supabase or the exported JSON). Note: only teams still alive have current rows — eliminated
teams need an "eliminated" state, not a blank.

**5. Chatbot button (bottom-right corner) for FIFA/match questions.**
Floating chat widget on the dashboard; answers from THIS system's data (current predictions, results, backtest) —
RAG-lite over the predictions store via the FastAPI backend, LangSmith-or-Langfuse for observability (per original
plan). **BLOCKER: needs an LLM API key from Dilip (likely Anthropic) — ask for it at session start so it's not a
dead-end at the finish.**

**6. Dashboard visual upgrade via Replit — with a repo-divergence warning (flagged 2026-07-03).**
Dilip wants Replit for UI/UX: more modern animations, scrolling dynamic football-themed design. AGREED APPROACH:
use Replit/v0 as a *design playground* to prototype animated components, then port the good ones into `dashboard/`
(Next.js 16 + Framer Motion already there). The repo must stay the single source of truth and Vercel the deploy
target — do NOT let a second, diverging dashboard codebase grow on Replit. The existing neon theme + №10/№7 SVG
figures were deliberate (copyright-safe) choices; keep those constraints when porting.

**Draw-probability status (Dilip asked):** heuristic's flat 25% draw rate FIXED 2026-07-03 (Gaussian decay
0.30→0.06, see #5). Still simplified: the knockout 50/50 draw-split. Proper fix = Poisson/Dixon-Coles goals
model (parked stretch item, see memory/next-session-plan).
