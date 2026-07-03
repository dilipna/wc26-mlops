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
.obsidian/, graphify-out/, Untitled.md  # user's note-tooling artifacts, not part of the system (uncertain purpose)
```

# 4. CORE PIPELINE LOGIC
- Ingestion: `fetch_historical_data.py` pulls 3 CSVs from open GitHub mirrors (no auth). `daily_update.py` pulls Odds API `/scores` (rolling 3-day window, free-tier cap) → appends new completed matches to `data/live/results_log.csv` (dedup by date+teams).
- Features: `team_timeline.build_timelines()` — single chronological pass over historical+live matches → per-team Elo (K=32, home adv 100, goal-diff multiplier) + rolling 10-match form. `snapshot_as_of()` returns state strictly before a date (leakage-safe, tested). FIFA rank points via bisect as-of lookup; name aliases in `rankings.py` / `flags.ts`.
- Training: `Layer1Ensemble.__init__` trains per run on matches 1992→cutoff. Two symmetric rows per match (home/away perspectives). 3-class labels (loss/draw/win).
- Inference/simulation: `monte_carlo.simulate_champion_probabilities()` — 10,000 sims of a real bracket from any start round, match probs memoized, seeded RNG (42). Knockout advance prob = P(win) + 0.5·P(draw).
- Daily output: `daily_update.py` scores upcoming fixtures (model vs de-vigged bookmaker h2h) → `data/live/match_predictions_<ts>.json`; appends bookmaker outright de-vigged probs to `predictions_log.csv` as `model_version=bookmaker_outright_baseline_v1`. `export_dashboard_data.py` converts logs → `dashboard/data/*.json`.

# 5. MODEL DETAILS
- Layer 1 = equal-weight average of 3 members, renormalized: (a) XGBClassifier multi:softprob, 200 trees, depth 4, lr 0.1, 6 features (elo_diff, form GF/GA/win-rate diffs, rank_points_diff, neutral); (b) LogisticRegression on [elo_diff, neutral] only; (c) FIFA heuristic `1/(1+10^(-rank_diff/200))` with FIXED 25% draw rate (`heuristic.py`).
- Baseline for comparison = heuristic member alone (un-blended).
- Layer 2 = Monte Carlo (not a model): bracket tree built bottom-up from actual completed results (`bracket.py`, expects 64 matches, 32-team format; penalty winners from shootouts.csv).
- Backtest results (data/backtest/*.json): champion P(win) post-group→post-SF: 2018 France .051→.173→.330→.659; 2022 Argentina .197→.197→.460→.593. Avg model−baseline: Brier −0.0003, log-loss −0.0524 (model better on avg; lost to baseline at 2018 post-SF checkpoint).

# 6. WHAT IS IMPLEMENTED
- Phase 0 backtest end-to-end, passing agreed success bar
- Odds API ingestion: h2h odds, outright winner market (de-vig = mean implied price, normalized), `/scores` results
- Cumulative live results log with dedup; leakage-safe feature pipeline
- Manual daily update script (verified live 2026-07-02: 8 results, 11 fixtures scored, 23 teams logged)
- Dashboard: neon-themed (Orbitron/Rajdhani, cyan/magenta), animated №10/№7 SVG figures, leaderboard, time-series chart, AI-vs-market fixture cards, results ticker, backtest-proof section, tech-stack section; hydration-safe UTC dates; flag-icons lib. Verified via Playwright screenshots desktop+mobile; builds clean; runs at localhost:3000 (`npm run dev`)
- 6 pytest tests (bracket reconstruction incl. penalty finals, Elo leakage-safety, de-vig, results-store dedup)
- Git pushed to https://github.com/dilipna/wc26-mlops

# 7. WHAT IS PARTIALLY DONE
- `predictions_log.csv`: only 1 day of rows, all bookmaker-baseline — the model's OWN tournament-win numbers are not in it (see #8)
- `api_football.py`: code exists (direct api-sports.io host) but free tier rejects season 2026 on both RapidAPI and direct ("try from 2022 to 2024") — dropped from pipeline, kept for reference
- Dashboard freshness: static-at-build; requires re-running export + rebuild to update (documented in DECISIONS.md)

# 8. WHAT IS MISSING
- Orchestration: NO automation exists; daily_update.py is run by hand (July 4 deadline risk)
- Live Layer 2: bracket.py only reconstructs COMPLETED brackets; 2026 future-round skeleton not encoded → model's own P(champion) not produced live (bookmaker outright stands in, labeled)
- 2026 group-stage results not backfilled into Elo/form (ratings end ~2024 + 8 live results; visible model-vs-market gaps, e.g. USA match)
- Stacked meta-learner (currently plain equal weights); flat 25% heuristic draw rate; flat 50/50 knockout draw split
- All of: Airflow, Docker, MLflow, FastAPI, DVC, Evidently, Prometheus/Grafana, Kubernetes, chatbot (empty dirs / not started)
- Public deploy (Vercel planned), calibration/reliability diagram (Tier 1 requirement for final summary), README screenshot/GIF

# 9. KEY DESIGN DECISIONS (FROM CODE / DECISIONS.md)
- Equal-weight ensemble for Phase 0; meta-learner deferred (logged with revisit note)
- Knockout draws → 50/50 split; heuristic draw rate fixed at 0.25
- Bracket reconstructed from real results, not hand-typed seeding (sidesteps 2026 48-team seeding rules for backtests)
- Train once per tournament; predictions change via as-of features, not retraining
- Trivial baseline = ensemble's own heuristic member alone
- API-Football abandoned (free-tier season lock), Odds API is sole live source; region=uk keeps cost ~2 credits/snapshot of ~500/mo
- Dashboard: Next.js chosen over Streamlit (reversal, logged); no real player photos (copyright/likeness) → original SVG silhouettes; results_log.csv git-tracked because the 3-day API window makes it the only cumulative record
- Secrets in .env (gitignored); .env.example committed

# 10. ENTRY POINTS
```
python scripts/fetch_historical_data.py    # one-time: pull 3 historical CSVs
python scripts/backtest_2018_2022.py       # Phase 0 backtest → data/backtest/*.json + console summary
python scripts/daily_update.py             # THE daily job: results→features→L1 scoring→predictions log
python scripts/export_dashboard_data.py    # logs → dashboard/data/*.json (run after daily_update)
python scripts/fetch_live_snapshot.py      # raw odds/fixtures snapshot (superseded by daily_update)
python -m pytest tests/ -q                 # 6 tests
cd dashboard && npm run dev                # site at localhost:3000
```
Requires: Python 3.10 (pandas, numpy, sklearn, xgboost, requests, python-dotenv, pytest), Node 24, `.env` with ODDS_API_KEY.

# 11. NEXT STEP (CRITICAL)
1. **Airflow DAG wrapping daily_update.py + export_dashboard_data.py** — only truly deadline-bound task (July 4); everything else is manual today.
2. Then, per user-approved plan (see `.claude` memory / next-session-plan): Docker → MLflow (+ stacked meta-learner & heuristic draw-rate fix, both approved) → FastAPI → DVC → Evidently/Prometheus/Grafana → chatbot (needs LLM key, LangSmith-or-Langfuse) → kind/minikube K8s.
3. Higher-prediction-value alternatives explicitly parked, raise with user: 2026 group-stage Elo backfill; encode official 2026 bracket skeleton to turn on live Layer 2.
