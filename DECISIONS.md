# Decisions Log

One entry per non-trivial technical choice, with reasoning. Newest first.

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
