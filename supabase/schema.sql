-- WC26-MLOps durable predictions/results store.
-- Run once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- after creating a free-tier project. See DECISIONS.md for the reasoning
-- (durability for the "model vs reality" proof tracker) and
-- src/ingestion/supabase_store.py for the writer.

-- Completed match results (mirrors data/live/results_log.csv).
create table if not exists match_results (
    id bigserial primary key,
    match_date date not null,
    home_team text not null,
    away_team text not null,
    home_score integer not null,
    away_score integer not null,
    inserted_at timestamptz not null default now(),
    unique (match_date, home_team, away_team)
);

-- Pre-kickoff model + bookmaker match probabilities. Append-only: one
-- snapshot per daily_update.py run per fixture, so the same fixture can
-- have several rows logged at different times before commence_time --
-- that history is the raw material for the proof tracker.
create table if not exists match_predictions (
    id bigserial primary key,
    commence_time timestamptz not null,
    home_team text not null,
    away_team text not null,
    model_home_win double precision not null,
    model_draw double precision not null,
    model_away_win double precision not null,
    bookmaker_home_win double precision,
    bookmaker_draw double precision,
    bookmaker_away_win double precision,
    logged_at timestamptz not null default now()
);

-- Daily P(wins World Cup) per team (mirrors data/predictions/predictions_log.csv).
create table if not exists tournament_predictions (
    id bigserial primary key,
    prediction_date date not null,
    team text not null,
    win_probability double precision not null,
    model_version text not null,
    inserted_at timestamptz not null default now(),
    unique (prediction_date, team, model_version)
);

create index if not exists idx_match_predictions_fixture
    on match_predictions (home_team, away_team, commence_time);
create index if not exists idx_match_results_teams
    on match_results (home_team, away_team);
create index if not exists idx_tournament_predictions_team
    on tournament_predictions (team);
create index if not exists idx_tournament_predictions_date
    on tournament_predictions (prediction_date);
