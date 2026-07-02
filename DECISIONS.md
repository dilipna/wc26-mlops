# Decisions Log

One entry per non-trivial technical choice, with reasoning. Newest first.

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
