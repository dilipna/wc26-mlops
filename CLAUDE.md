# Project: WC26-MLOps — Tournament Winner Prediction System

## Mission

Portfolio project for an MLOps / AI Engineer job search. The deliverable
that matters most is a daily-updating "who wins the World Cup" probability
tracker, automated end to end, with a dashboard that shows the prediction
evolving day by day against the eventual real result. Every decision should
be filtered through "would this convince an MLOps hiring manager," not
"is this the most accurate possible forecast."

## Non-negotiable timeline

Today: July 1, 2026.
- Round of 16: July 4–7 — live ingestion MUST be running before this.
- Quarterfinals: July 9–11. Semifinals: July 14–15.
- Third-place match: July 18. Final: **July 19, 2026** — hard stop.

## Methodology — read carefully, this is precise on purpose

**Layer 1 — match-level win probability (stacked ensemble):**
XGBoost + an Elo/logistic-regression baseline + a simple team-strength
heuristic, blended (weighted average or a small meta-learner). Do not ship
XGBoost alone and call it "an ensemble" — stack it properly.

**Layer 2 — Monte Carlo bracket simulation:**
Run 10,000+ simulations of the *actual remaining bracket* using Layer 1's
probabilities recursively. Output: P(wins World Cup) for every team still
alive. This is what actually answers "who wins the whole tournament" — a
match model alone cannot.

**Time series — used precisely, not as a buzzword:**
Each team's Elo/rating and recent form (goals for/against, xG if available)
is modeled as an evolving trajectory (rolling averages / exponential
smoothing, or a simple state-space rating update) and fed into Layer 1 as
features. Separately, log every day's Layer 2 output — (date, team,
win_probability, model_version) — as a timestamped series. THIS is the
genuine time series and it is the dashboard's centerpiece: a "prediction
market" style line chart, probability over time, actual champion
highlighted once known.

**Daily cadence:**
After each day with completed matches: update ratings/features → re-run
Layer 1 on newly-known fixtures → re-run Layer 2 over the current actual
bracket → append one row per remaining team to the predictions log.

**Validate before trusting live output:**
Backtest this exact two-layer pipeline against the 2018 and/or 2022 World
Cups. Check whether it assigns rising probability to the actual eventual
champion as those tournaments progress. Do this in Phase 0, before wiring
up live 2026 data — it's the cheapest possible sanity check.

## Scope tiers — build in this order, do not skip ahead

**Tier 1 — must have, this is the actual story:**
- Ingestion (API-Football, Odds API, historical results)
- Feature engineering incl. time-series form/rating trajectories
- Layer 1 stacked ensemble + Layer 2 Monte Carlo simulation
- Daily automation via an Airflow DAG
- Timestamped predictions store (a Postgres table or even a Parquet log is
  enough — do not over-engineer storage)
- Dashboard: win-probability-over-time chart + a final accuracy/calibration
  summary written after July 19
- A trivial baseline (e.g. higher-FIFA-ranking-wins, or bookmaker-implied
  favorite) logged alongside the model on every run — the dashboard must
  show lift over this baseline, not just the model's own numbers in
  isolation
- A calibration/reliability diagram (predicted probability vs. actual
  outcome frequency) as part of the final summary, not just a single
  Brier score number
- Docker for containerizing training/serving/Airflow
- MLflow for experiment tracking + model registry
- Deploy the dashboard publicly (Streamlit Community Cloud, Vercel, or
  Render free tier) — a clickable link beats a repo someone has to clone
  and run

**Tier 2 — strong additions once Tier 1 fully works end to end:**
- Kubernetes — a local cluster (kind or minikube) is expected and fine for
  a portfolio project; don't burn time/money on a real cloud cluster unless
  you already have free credits
- GitHub Actions CI (tests + lint on every push)
- Evidently AI for feature/data drift monitoring
- SHAP values on Layer 1 to explain individual probability shifts (e.g.
  "Argentina's title probability jumped after beating X, driven mostly by
  the updated rating and rest-day advantage") — genuine interpretability,
  not required for Tier 1 to be complete

**Tier 3 — stretch, only with days to spare after Tier 1 and 2 are solid:**
- Prometheus + Grafana for infra/ops metrics (separate from the
  recruiter-facing prediction dashboard — different audience, different
  purpose)
- Feast feature store
- Terraform IaC
- One deliberately induced failure + a short postmortem note

A fully-working Tier 1 beats a half-working Tier 1+2+3. If a Tier 1 item is
at risk by July 19, say so immediately — don't silently keep building
infra on a shaky core.

## Data sources

- **API-Football** (RapidAPI, free tier) — fixtures, live scores, lineups,
  stats. Verify current rate limits before designing polling cadence.
- **The Odds API** (free tier) — live bookmaker odds. Track model
  calibration (log loss / Brier score) against implied bookmaker
  probabilities as a benchmark — this is a strong, recognizable signal.
- **Historical match data** — Kaggle international results datasets,
  FBref/Wikipedia for completed group stage and prior tournaments (2018,
  2022) used for the Phase 0 backtest.

## Working agreement for Claude Code

- Keep a `DECISIONS.md` log — one entry per non-trivial technical choice,
  with reasoning. This becomes interview material later.
- Write tests alongside each phase, not retroactively.
- Commit incrementally with clear messages.
- Push back explicitly, in writing, if something in this file is
  ambiguous, wrong, or at risk given the timeline. Honest pushback is more
  valuable than agreement.
- Ask before adding infra not listed above, or before deviating from the
  Layer 1 / Layer 2 methodology.
- Secrets go in `.env`, never committed. Add `.env.example`.
- If a live API turns out unusable (rate limits, no WC 2026 coverage),
  flag it immediately with a proposed alternative — don't silently fall
  back to mocked data.

## Repo structure (starting point)

```
wc26-mlops/
├── CLAUDE.md
├── DECISIONS.md
├── .env.example
├── data/
│   ├── historical/          # group stage + 2018/2022 backtest data
│   └── live/                # polled knockout match data
├── src/
│   ├── ingestion/            # API-Football, Odds API clients
│   ├── features/              # rolling form, Elo trajectory, ratings
│   ├── models/
│   │   ├── layer1_ensemble/    # XGBoost + Elo baseline + heuristic, blended
│   │   └── layer2_simulation/  # Monte Carlo bracket simulator
│   ├── orchestration/          # Airflow DAGs
│   ├── serving/                  # FastAPI app (if/when needed)
│   └── monitoring/                # Evidently drift jobs (Tier 2)
├── dashboard/                       # win-probability-over-time app
├── tests/
└── k8s/                                # Tier 2, local kind/minikube manifests
```

## First task — Phase 0 (vertical slice, no infra yet)

1. Pull completed 2026 group-stage results + 2018/2022 historical data.
2. Build Layer 1 (stacked ensemble) and Layer 2 (Monte Carlo simulation)
   as plain Python, no orchestration yet.
3. Backtest against 2018 and/or 2022: does predicted P(win) for the actual
   champion trend upward as the tournament progresses? Save results as
   structured data (JSON), not a written report — this data will feed a
   "Model Validation" section on the live dashboard later, so it becomes
   actual demo content instead of a throwaway document. Give a short
   pass/fail summary against the agreed success bar in chat, 2-3
   sentences, not an essay.
4. Only after Phase 0 works end to end and is reviewed: move to Airflow
   automation, Docker, and the dashboard (Tier 1 remainder), then Tier 2.

Report back with what's done, what's blocked, and whether Tier 1 is
realistically on track for July 4 (live ingestion) and July 19 (final).

## The public dashboard is the primary recruiter-facing deliverable

If a time trade-off ever comes up between infra ceremony (e.g. Airflow
polish, Kubernetes) and dashboard polish, the dashboard wins — that's
what a recruiter actually opens. Infra should be real and working, but it
does not need to be gold-plated at the expense of a live, publicly
deployed, good-looking site with regular GitHub commits and a clean
README (architecture summary, screenshot/GIF, validation numbers).
