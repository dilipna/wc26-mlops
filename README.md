# WC26-MLOps — World Cup Winner Prediction System

A daily-updating "who wins the World Cup" probability tracker for the 2026 tournament,
built as an end-to-end MLOps portfolio project.

**Status:** Phase 0 (methodology validation) in progress. No live dashboard yet.

## Methodology

- **Layer 1 — match-level win probability:** a stacked ensemble of XGBoost, an
  Elo/logistic-regression baseline, and a simple team-strength heuristic.
- **Layer 2 — tournament-level:** a Monte Carlo simulation (10,000+ runs) of the actual
  remaining bracket, using Layer 1's probabilities recursively, to produce P(wins World Cup)
  for every team still alive.
- **Validation:** the pipeline is backtested against the 2018 and 2022 World Cups before
  being trusted on live 2026 data — see `data/backtest/`.

Full methodology and scope are documented in [CLAUDE.md](CLAUDE.md). Non-trivial technical
decisions and their reasoning are logged in [DECISIONS.md](DECISIONS.md).

## Repo structure

```
wc26-mlops/
├── data/
│   ├── historical/   # match history, FIFA rankings, 2018/2022 bracket data
│   ├── backtest/      # Phase 0 backtest output (JSON)
│   └── live/            # polled 2026 knockout data (Tier 1)
├── src/
│   ├── ingestion/       # API-Football, Odds API clients (Tier 1)
│   ├── features/        # Elo, rolling form
│   ├── models/
│   │   ├── layer1_ensemble/
│   │   └── layer2_simulation/
│   └── orchestration/   # Airflow DAGs (Tier 1)
├── dashboard/            # Streamlit app (Tier 1)
├── scripts/              # one-off / backtest entry points
└── tests/
```

## Validation numbers

_Populated after the Phase 0 backtest runs — see `data/backtest/2018.json` and
`data/backtest/2022.json`._

## Dashboard

_Link goes here once deployed (Tier 1)._
