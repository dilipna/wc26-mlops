# PROJECT_BRAIN.md — READ THIS FIRST

This file is the single source of truth for this project across sessions. If you are a
fresh Claude session starting from this file alone (no prior conversation): read this
whole file before touching any code, then restate back to Dilip: (1) the mission, (2)
current status, (3) what you're about to work on — before doing anything else. Then read
`DECISIONS.md` for the full dated reasoning behind any specific choice mentioned here.
`CLAUDE.md` holds the original project spec (methodology, scope tiers, hard dates) and
still governs the underlying prediction system; this file governs everything about
*making that system provably good engineering to an outside observer*, which is now the
actual point of the project (see Mission).

**Do not start writing feature code on your first action.** Read this file, confirm
status with Dilip, then proceed. At the end of every session, update this file's
"Current status," "Known fragility points," and append to the "Session log" — this is a
working rule, not optional housekeeping.

---

## 1. Mission

This project exists for one reason: **to show employers, in an interview setting, that
Dilip can build and operate real MLOps systems.** It is not primarily a football
prediction product — the World Cup angle is the vehicle, not the point. Every decision
should be filtered through "would this convince an MLOps hiring manager," not "is this
the most accurate possible forecast" (this framing is also in `CLAUDE.md`).

As of 2026-07-04, a full audit (see §4 and §7) found the project falls short of that goal
in two specific, named ways, and fixing both is now the top priority — above any further
feature/Tier-2/Tier-3 build-out:

1. **Presentation.** The public dashboard reads as a generic consumer sports-prediction
   site. An interviewer looking at it cannot tell there is real engineering underneath —
   the pipelines, tracking, registry, CI/CD, and monitoring that actually exist are
   invisible or reduced to unlinked text labels.
2. **Longevity / revivability.** In ~6 months, when Dilip actually needs to demo this to
   an employer, the pipeline should not be broken, and reviving it should not require
   remembering an undocumented sequence of steps or holding still-valid paid API
   credentials. The demo must be fully self-documented and runnable offline, in one
   command, on a fresh laptop.

Everything in §7 (Known fragility points) and §8 (Backlog) exists to close these two gaps.
Nothing else should take priority over them until both are closed.

---

## 2. Architecture — what each piece proves to an employer

```
historical CSVs (1872+, git-committed) + The Odds API (live 2026 scores/odds)
  -> Elo/form feature timelines (leakage-safe as-of snapshots)              [feature engineering]
  -> Layer 1: stacked ensemble (XGBoost + Elo/logreg + FIFA heuristic)      [modeling: real ensembling,
                                                                              not "XGBoost + marketing"]
  -> Layer 2: Monte Carlo over the REAL remaining 2026 bracket              [simulation, not just a
                                                                              per-match classifier]
  -> predictions log (CSV + Supabase Postgres, durable)                     [a real data store, not
                                                                              just files on a laptop]
  -> verify_predictions.py: grades finished fixtures vs pre-kickoff calls   [model monitoring / proof
                                                                              of honesty over time]
  -> check_drift.py: Evidently feature-drift check vs historical baseline  [production ML monitoring,
                                                                              the thing most portfolio
                                                                              projects skip entirely]
  -> export_dashboard_data.py -> dashboard/data/*.json                      [reproducible, static build
                                                                              artifact — no live infra
                                                                              needed to view the demo]
  -> Next.js dashboard, statically built, deployed on Vercel (PUBLIC)       [the actual deliverable a
                                                                              recruiter opens]

In parallel:
  -> FastAPI serving layer (src/serving/app.py): score any fixture on       [a real model-serving API,
     demand, current P(champion) per team. Dockerized, Render-deployable.   not just a notebook]
  -> Airflow DAG (3 tasks, 06:00 UTC daily)                                 [pipeline orchestration]
  -> MLflow (experiment tracking + model registry)                         [experiment tracking +
                                                                              model registry, not
                                                                              "I trained it once"]
  -> GitHub Actions CI (pytest + dashboard lint/build on every push)        [CI/CD discipline]
```

**The gap this project has right now: everything on the right-hand column above is real
and true, but almost none of it is visible anywhere a hiring manager would actually look
(the live dashboard).** Closing that gap is Backlog Step 2 (§8).

---

## 3. Current status

Legend: ✅ done and verified · 🚧 built but incomplete/unverified/needs work · ⬜ not started

**Core prediction system (Tier 1, CLAUDE.md scope)**
- ✅ Ingestion (historical CSVs + Odds API live results/odds)
- ✅ Feature engineering (leakage-safe Elo + rolling form + FIFA rank)
- ✅ Layer 1 stacked ensemble (XGBoost + Elo/logreg + FIFA heuristic, meta-learned blend)
- ✅ Layer 2 Monte Carlo over the real 2026 bracket (self-correcting shootout resolution)
- ✅ Phase 0 backtest (2018/2022) — model beats baseline on average (Brier −0.0035, log-loss −0.0987)
- ✅ Daily automation via Airflow DAG (3 tasks, Docker, 06:00 UTC)
- ✅ Timestamped predictions store (CSV + Supabase Postgres)
- ✅ Dashboard live and public: https://fifa2026mlops.vercel.app — **redesigned 2026-07-05**
  into an ops-console-style ML platform UI (see §6/§7/§8 for the new IA)
- ✅ Trivial baseline logged alongside the model on every run (heuristic member + bookmaker odds)
- 🚧 Calibration/reliability diagram — per-run buckets exist (Proof Tracker); the *final*
  full-season version is due after July 19, not before
- ✅ Docker for training/serving/Airflow
- ✅ MLflow experiment tracking + model registry (real, not decorative — see §9), now with
  a `get_registry_info()`/`relative_member_influence()` pair surfacing the real registered
  version, run params/metrics, and a derived ensemble-member-influence stat on the dashboard
- ✅ Public deploy (Vercel, auto-deploy on push)

**Tier 2**
- 🚧 Kubernetes — `k8s/` is empty; explicitly **deferred** to backlog, not urgent (see §8)
- ✅ GitHub Actions CI (pytest + dashboard lint/build on every push, real fresh installs)
- ✅ Evidently drift monitoring — built 2026-07-04, now with a **daily-accumulating history
  CSV** (`data/monitoring/drift_history.csv`, added 2026-07-05) and a dedicated **Drift
  Monitoring** dashboard section (current snapshot + trend chart) — the "zero dashboard
  presence" gap noted 2026-07-04 is closed
- ⬜ SHAP values on Layer 1 — still not built; the dashboard's "Ensemble member influence"
  stat is an honest, coarser stand-in derived from real meta-learner coefficients, explicitly
  labeled as not-SHAP (see Model Card copy)

**Tier 3** — not started, not prioritized until Tier 1/2 + the two mission gaps are closed.

**FastAPI serving layer** (built beyond the original CLAUDE.md scope, in service of the
"real serving API" story)
- ✅ Built, Dockerized, tested, live-verified locally (health/predict/champions all correct)
- ✅ **2026-07-05**: request-ID + server-latency middleware (`X-Request-ID`/
  `X-Response-Time-Ms` headers), a real `model_version` field on every response, and scoped
  CORS (`DEFAULT_DASHBOARD_ORIGINS`, override via `DASHBOARD_ORIGINS` env var) so the
  dashboard's Live Inference Console can call this API directly from the browser. Verified
  end-to-end: a real cross-origin POST from `Origin: http://localhost:3000` returns 200 with
  a genuine request ID, latency, and model version.
- 🚧 Render deploy — first attempt (2026-07-04) failed on a dependency conflict (now fixed
  and pushed, commit `3e704ae`). **Needs: retry the deploy on Render, then verify the live
  URL** (and that `DASHBOARD_ORIGINS`/CORS is set correctly for the production dashboard
  origin once it is retried).

**Chatbot** (floating widget, FIFA/match Q&A backed by this system's own data)
- ⬜ Not built. No longer blocked — Anthropic API key received from Dilip 2026-07-04,
  saved to `.env` as `ANTHROPIC_API_KEY` (gitignored; placeholder in `.env.example`).

**Mission-critical gaps (2026-07-04 audit — see §7 for detail, §8 for the fix plan)**
- ✅ Presentation: **CLOSED 2026-07-05** — the dashboard was fully redesigned from a
  consumer sports-prediction site into an ops-console-style ML platform UI, per Dilip's
  explicit direction (this went considerably further than the original Step 2 plan; see
  §7/§8 for the full new IA). Real engineering (MLflow registry, drift monitoring, Airflow
  DAG, CI/CD, a live inference console hitting the real deployed API) is now the lead
  story, not an afterthought.
- ✅ Longevity: Backlog Step 1 (all 5 items) done 2026-07-05 — Odds API now fails
  gracefully, dependency lock file exists and is wired into serving/CI (deliberately
  NOT airflow, see §7), Docker base images pinned by digest, `make demo`/`make
  backend`/`make test` exist, health checks added to mlflow/serving/airflow-webserver.
  Verified live: full `docker-compose.airflow.yml` stack brought up and confirmed
  all four healthchecked services report `healthy`.

---

## 4. How to run

**One command per use case (Makefile added 2026-07-05):**
```
make demo      # dashboard only, from committed data, zero cloud creds, zero Docker — THIS is
               # the interview-safe path (cd dashboard && npm install && npm run dev)
make backend   # full docker-compose stack, for demoing the pipeline actually running live
make test      # pytest
```
Note: `make` itself isn't installed by default on Windows (verified 2026-07-05 on Dilip's
machine — no `make` in PATH). Works out of the box on Mac/Linux/CI; on Windows either
install it (choco/scoop) or run the underlying commands directly (below). Not fixing this
further — the target audience (recruiters, CI) is Mac/Linux, and Dilip's own dev loop
doesn't depend on `make`.

**Underlying commands, if not using `make`:**
```
cd dashboard && npm install && npm run dev        # dashboard alone, from committed JSON — no
                                                    # creds/Docker needed, localhost:3000
docker compose -f docker-compose.airflow.yml up -d # full backend stack (Airflow/MLflow/serving)
python scripts/daily_update.py                     # requires a valid ODDS_API_KEY; now fails
                                                    # gracefully (fixed 2026-07-05) instead of
                                                    # crashing if it's missing/invalid
python scripts/verify_predictions.py
python scripts/export_dashboard_data.py
```
**The dashboard-only path already works today** with zero credentials — see §7, this is the
project's strongest asset, don't let backlog work accidentally break it.

---

## 5. How to revive after months of dormancy (runbook)

If you're reading this after a long gap and something doesn't work, check these in order
— they are the exact failure modes the 2026-07-04 audit found (some may be fixed by the
time you read this; check §3/§8 status first):

1. **`daily_update.py` fails to fetch new data.** As of 2026-07-05 it no longer crashes:
   `main()` checks `ODDS_API_KEY` up front and wraps the first live call, printing a clear
   message and returning cleanly if the key is missing/invalid/expired instead of raising.
   **You do not need this script to work to view the dashboard** — it's fully static,
   built from committed JSON. Only re-run it if you want *new* predictions.
2. **`pip install` fails or silently resolves to different versions than before.**
   `requirements-lock.txt` (added 2026-07-05, resolved inside `python:3.10-slim` — do not
   regenerate it from a native Windows venv, see the file's own header) is wired into the
   **serving** Dockerfile and CI. It is deliberately **not** wired into the airflow
   Dockerfile — verified 2026-07-05 that forcing the full lock file's transitive pins
   (Flask 3.1.3, SQLAlchemy 2.0.51, Werkzeug 3.1.8) into the `apache/airflow` base image
   breaks the webserver's FAB auth manager (`flask.json.JSONEncoder` removed in Flask
   2.3+); airflow's Dockerfile stays on top-level `requirements.txt`, which lets pip's
   resolver pick versions compatible with Airflow's own pins. Regenerate the lock file
   with the docker command in its header comment after any `requirements.txt` change.
3. **Docker images fail to build or behave differently than before.** Base images are now
   digest-pinned (`python:3.10-slim@sha256:5f992...`, `apache/airflow:2.9.3-python3.10@
   sha256:1f395...`, pinned 2026-07-05) so this shouldn't drift silently; if it still does,
   the digest itself may need updating (Docker Desktop required to resolve a fresh one).
4. **The dashboard looks broken / data is stale.** It's a static Next.js build from
   `dashboard/data/*.json`, which are all committed to git. `npm install && npm run dev`
   should always work from a clean clone with zero external services. If it doesn't,
   that's a real regression — check `dashboard/package-lock.json` is in sync (`npm ci`
   should succeed; see DECISIONS.md's earlier package-lock incident).
5. **MLflow/Supabase/Airflow don't come up.** All three are optional/best-effort by
   design — nothing in the *dashboard* demo path depends on them being reachable. Only
   needed if you want to demo the pipeline actually running live (`make backend` once it
   exists, or `docker compose -f docker-compose.airflow.yml up -d` today).
6. **Render deploy is down/asleep.** Free tier spins down after 15 min idle — the first
   request after a sleep will be slow (cold start + local training, ~10s). Not a bug.

---

## 6. Interview demo script

*(Rewritten 2026-07-05 for the ops-console redesign — section order/IDs below match
`dashboard/src/app/page.tsx` as of this session.)*

1. **Open https://fifa2026mlops.vercel.app.** Say: "This predicts World Cup 2026 outcomes,
   but that's the vehicle, not the point — this is a production MLOps system, and the
   dashboard is built to prove that, not to look like a sports betting site."
2. Scroll to **Live Inference** (`#inference`). Pick two teams, click "Run prediction."
   Say: "This just called the actual deployed FastAPI serving layer from your browser —
   that request ID, latency, and model version are the real HTTP response, not mocked
   numbers." (Honest cold-start note: if Render's free tier has been idle, the first call
   takes ~10s — the UI says so.)
3. Scroll to **Registry** (`#registry`). Say: "The pipeline re-registers a new model
   version in MLflow every day — this is that registry's actual current state: version
   number, run ID, training window, and the relative influence of each ensemble member,
   derived from the real fitted meta-learner coefficients, not SHAP (that's still Tier 2,
   and the Model Card says so explicitly)."
4. Scroll to **Pipeline** (`#pipeline`) and **Drift** (`#drift`). Say: "This is the Airflow
   DAG's real task chain and schedule, and this is Evidently's actual feature-drift check
   against the historical training distribution — labeled honestly as running in the local
   docker-compose stack, not a fake 'live' status for infra that isn't continuously hosted."
5. Scroll to **Performance** (`#performance`, Proof Tracker) and **Backtest** (`#backtest`,
   Model Validation). Say: "Every prediction is logged before kickoff and graded once the
   match finishes — Brier score and calibration, not accuracy alone, because this outputs a
   3-outcome probability distribution, not a binary label. Before ever touching 2026 data,
   the same two-layer pipeline was backtested on the 2018 and 2022 World Cups." (If Proof
   Tracker shows 0 graded matches, say so plainly — correct until knockout matches finish.)
6. Scroll to **Archive** (`#archive`). Say: "Every logged prediction is filterable here by
   team, model series, and date — so any claim above can be checked against the raw log,
   not just trusted."
7. Scroll to **Model Card** (`#model-card`) and **CI/CD** (`#cicd`). Say: "This is the
   architecture, features, and known limitations in one place, and every infra item here
   links to its actual source file on GitHub — Dockerfiles, the CI workflow, the DAG,
   `requirements-lock.txt` — not unlinked tech-stack pills."
8. Open the **GitHub repo** (footer link). Show `DECISIONS.md` (dated engineering log),
   `.github/workflows/ci.yml`, `tests/` (34 tests, genuinely passing).
9. If backend is up (`make backend` / docker-compose): open the **MLflow UI**
   (localhost:5000) and the **Airflow UI** (localhost:8080, admin/admin).
10. Close with the honest fragility story (§7) if asked "what would you do differently" —
    this project's own audit trail (this file + DECISIONS.md) *is* the answer to that
    question, which is itself a strong signal.

---

## 7. Known fragility points + mitigations (2026-07-04 audit)

A full read-only audit (3 parallel investigations: reproducibility/fragility, component
verification against claimed status, dashboard UI honesty) found the following. Each
maps to a backlog item in §8.

**Hard blocker — FIXED 2026-07-05:**
- `scripts/daily_update.py` had zero error handling around the Odds API (`_api_key()`
  raised an unhandled `RuntimeError`). Now `main()` checks `ODDS_API_KEY` up front and
  wraps the first live call in try/except, printing a clear message and returning cleanly
  — matches the best-effort pattern already used for Supabase/MLflow. Verified: running
  with `ODDS_API_KEY=` unset exits 0 with a clear message instead of a traceback.

**Real, softer risks — ALL FIXED 2026-07-05 (backlog Step 1 complete):**
- ~~No dependency lock file~~ — `requirements-lock.txt` added, resolved inside
  `python:3.10-slim` (not a native venv — see finding below on why that distinction
  matters). Wired into the **serving** Dockerfile and CI only; **deliberately not**
  airflow's Dockerfile (see next point) or mlflow's (which never installed from
  `requirements.txt` to begin with — it's a one-line `pip install mlflow==3.2.0`, already
  exact-pinned, and forcing the full lock file in would balloon that image with
  numpy/pandas/xgboost for zero benefit).
- **New finding, not in the original audit:** the full lock file is actively unsafe for
  the airflow image. Verified by building both ways: installing `requirements-lock.txt`
  into `apache/airflow:2.9.3-python3.10` forces Flask 3.1.3/SQLAlchemy 2.0.51/Werkzeug
  3.1.8 (whatever python:3.10-slim resolved in isolation), which breaks the FAB auth
  manager (`airflow version` logs `cannot load CLI commands from auth manager: module
  'flask.json' has no attribute 'JSONEncoder'` and warns the webserver won't start).
  Installing plain `requirements.txt` into the same image does **not** touch Flask/
  SQLAlchemy/Werkzeug at all — pip's resolver is free to pick versions compatible with
  Airflow's own pins when not forced by an exact transitive lock. Airflow's Dockerfile
  stays on `requirements.txt`. Lesson: a single lock file resolved outside a target
  image's existing dependency floor is not safe to force into every image that shares
  some of the same top-level packages.
- ~~All three Dockerfiles pin base images by tag, not digest~~ — pinned 2026-07-05
  (`python:3.10-slim@sha256:5f9928ea...`, `apache/airflow:2.9.3-python3.10@
  sha256:1f395499...`).
- ~~No single command brings up the full demo~~ — root `Makefile` added
  (`make demo`/`make backend`/`make test`). Note: `make` isn't installed by default on
  Windows (confirmed on Dilip's machine) — fine for the Mac/Linux/CI audience this is
  aimed at, but worth knowing before assuming `make demo` "just works" everywhere.
- ~~No health checks~~ — added to `mlflow`, `serving`, `airflow-webserver` in
  `docker-compose.airflow.yml` (python:3.10-slim has neither curl nor wget, so those two
  use a `python -c "urllib.request.urlopen(...)"` check instead of `curl`; airflow's image
  does have curl, so that one uses `curl -f .../health`). Verified live: full stack
  brought up, all four healthchecked services (postgres/mlflow/serving/airflow-webserver)
  reached `healthy`.
- `src/serving/app.py` has no CORS/auth/rate-limiting — fine for a portfolio demo, but
  worth naming explicitly rather than leaving undocumented. **Not on the critical path;
  noted here so it's a deliberate choice, not an oversight.**

**Presentation gap — CLOSED 2026-07-05 (full ops-console redesign, see §8 Step 2):**
The 2026-07-04 findings below are kept for history; all were addressed by the redesign.
- ~~The only "MLOps" mention... unlinked text pills~~ — `TechStack.tsx` deleted, replaced
  by `CicdSection.tsx`: every infra item links to its real source file on GitHub.
- ~~Evidently drift monitoring has zero dashboard presence~~ — `DriftDashboard.tsx` (new)
  shows the real current snapshot plus a daily-accumulating trend (`drift_history.csv`,
  new; `check_drift` wired into the Airflow DAG as an independent parallel branch).
- ~~The two sections with real engineering substance sit near the bottom~~ — full IA
  reorder: Live Inference → Registry → Pipeline → Drift → Performance → Backtest →
  Archive → Model Card → CI/CD now lead, ahead of the fan-facing Leaderboard/Country/
  Chart/Fixtures sections (kept, reskinned, moved down).
- ~~Real computed data nobody sees~~ — `model_registry.json`/`drift.json` (new exports)
  surface MLflow version/run/params/metrics and per-feature drift scores directly.
- ~~No CI badge, no architecture diagram~~ — both added (`StatusBar.tsx`'s live CI badge,
  `ArchitectureDiagram.tsx`).
- ~~Warm editorial palette built for a sports/prediction-market audience~~ — full visual
  system replacement: dark ops-console theme (validated categorical/status palette via
  the dataviz skill's `validate_palette.js` against this project's actual `#0d0c0a`
  surface), monospace-forward, status pills, no spinning globe/italic headline.
- **New capability that didn't exist before**: a **Live Inference Console** hitting the
  real deployed serving API from the browser (request ID, latency, model version, all
  genuine round-trip data) — this is the strongest "not a mockup" signal on the site.

**What's already solid — do not accidentally break these while fixing the above:**
- The dashboard is fully static, built from 7 committed JSON files — needs zero live
  credentials to view or redeploy. This is the project's strongest reproducibility asset.
- All historical/backtest/prediction data is git-committed — no dependency on a volatile
  external refetch to reproduce results.
- Training is ~9s from committed CSVs — no stale-model-artifact risk.
- MLflow tracking/registry is real (not decorative) and gracefully degrades when
  unreachable — confirmed by reading `src/models/layer1_ensemble/tracking.py` directly.
- CI does a genuine fresh install + full test run on every push (26/26 passing, reverified
  2026-07-04) — a real safety net, not aspirational.
- No hardcoded absolute paths or machine-specific assumptions found anywhere in `src/`,
  `scripts/`, or `dashboard/`.

---

## 8. Backlog — the phased plan to close both mission gaps

This is the authoritative, only version of the plan — do not maintain a separate plan
doc. Work through it in order; update the checkboxes and §3/§7 as items land.

### Step 1 — Longevity fixes — ALL DONE 2026-07-05
- [x] **1. Fix the Odds API hard-crash.** `scripts/daily_update.py`'s `main()` now checks
  `ODDS_API_KEY` up front and wraps the first live call in try/except, printing a clear
  message and returning cleanly instead of letting `RuntimeError` propagate. Matches the
  best-effort pattern used for Supabase/MLflow. Verified: `ODDS_API_KEY= python
  scripts/daily_update.py` exits 0 with a clear message.
- [x] **2. Add a real dependency lock file.** `requirements-lock.txt` generated via
  `pip freeze` from a genuinely clean install **inside a `python:3.10-slim` container**
  (not a native Windows venv — that pulled in `pywin32`, which doesn't exist on the Linux
  images this feeds). Regenerate with:
  ```
  docker run --rm -v "$(pwd):/work" -w /work python:3.10-slim bash -c \
    "pip install --no-cache-dir --upgrade pip -q && \
     pip install --no-cache-dir -r requirements.txt -q && pip freeze" \
    > requirements-lock.txt
  ```
  Wired into `docker/serving/Dockerfile` and `.github/workflows/ci.yml`. **Deliberately
  NOT** wired into `docker/airflow/Dockerfile` (stays on `requirements.txt`) or
  `docker/mlflow/Dockerfile` (never used `requirements.txt`, already exact-pinned) — see
  §7 for why the airflow one specifically breaks if you do this.
- [x] **3. Pin Docker base images by digest.** `python:3.10-slim@sha256:5f9928ea39771e8dd
  f4fb9a96ab24f65f087793635614405a1dc9384f040852e` (mlflow + serving Dockerfiles),
  `apache/airflow:2.9.3-python3.10@sha256:1f395499be0fbc834e0a8a634754715a3938b08ca161b11
  cf9c837e4372aa9d2` (airflow Dockerfile). Resolved via `docker pull <image> && docker
  inspect --format='{{index .RepoDigests 0}}' <image>`.
- [x] **4. One-command demo.** Root `Makefile` added: `make demo` (dashboard only, zero
  creds/Docker), `make backend` (full docker-compose stack), `make test` (pytest). Note:
  `make` isn't installed by default on Windows (confirmed on Dilip's dev machine) — works
  natively on Mac/Linux/CI, the intended audience; not treating this as a gap worth
  chasing further.
- [x] **5. Basic health checks** added to `mlflow`, `serving`, `airflow-webserver` in
  `docker-compose.airflow.yml`. `mlflow`/`serving` use a `python -c
  "urllib.request.urlopen(...)"` check (their `python:3.10-slim` base has neither curl nor
  wget); `airflow-webserver` uses `curl -f http://localhost:8080/health` (that image does
  have curl). Verified live: `docker compose -f docker-compose.airflow.yml up -d --build`
  brought up all services, all four healthchecked ones reached `healthy`.

### Step 2 — Make the MLOps engineering visible — DONE 2026-07-05, scope expanded well
beyond the original 4 items below at Dilip's explicit direction (full ops-console
redesign, not just a reorder + drift card). Original items kept struck through for
history; see §7 for the "what changed" summary and §11 session log for the full list.
- [x] ~~1. Reorder dashboard sections~~ — done, and went further: a full new IA (Live
  Inference → Registry → Pipeline → Drift → Performance → Backtest → Archive → Model
  Card → CI/CD, then the kept fan-facing sections).
- [x] ~~2. Replace the static "MLOps Infrastructure" text pills~~ — done
  (`CicdSection.tsx`), plus a real Drift dashboard, MLflow registry card, and Airflow
  pipeline timeline as full dedicated sections, not just a signal folded into a pills grid.
- [x] ~~3. A simple static architecture diagram~~ — done (`ArchitectureDiagram.tsx`,
  embedded in the CI/CD section).
- [x] ~~4. Rewrite Methodology + Tech Stack copy~~ — done; `MethodologySection.tsx` and
  `TechStack.tsx` deleted outright, folded into `ModelCard.tsx` and `CicdSection.tsx`
  respectively with concrete, number-backed copy.
- **Kubernetes manifests stay deferred** — not part of this pass. Presentation +
  longevity are the stated priority; the site already labels k8s honestly as "Coming
  Next," which is true and fine for now.

### Step 3 — Close the loop — DONE 2026-07-05
- [x] Updated this file's §3, §6, §7, §8 to match what actually got built.
- [x] Appended a session log entry (§11).
- [x] Verified live, not just by reading code:
  - Full test suite passes (34/34, up from 26 — new tests for `tracking.py`'s
    `get_registry_info`/`relative_member_influence` and `serving/app.py`'s middleware/CORS).
  - `docker-compose.airflow.yml` brought up with `--build`; all four healthchecked services
    (postgres/mlflow/serving/airflow-webserver) reached `healthy`.
  - `npm run lint` and `npm run build` both clean.
  - Ran the actual dashboard dev server + a real local `uvicorn`, confirmed via the
    rendered HTML (no browser tool available in this environment, so verified via curl'd
    SSR output + a direct cross-origin `/predict` call with the dashboard's real `Origin`
    header) that every new section renders real data and the Live Inference Console's
    request-ID/latency/model-version round trip genuinely works.
  - Did not re-test the ".env hidden -> daily_update.py fails cleanly" scenario this
    session (verified in the 2026-07-04 session; behavior unchanged).

**Deferred, explicitly not urgent (don't re-propose without a reason to reprioritize):**
- kind/minikube K8s manifests (Tier 2) — was in progress before this mission reset;
  resume only after Steps 1-3 above are done.
- Chatbot widget — key is available, not blocking, but not more urgent than the two
  mission gaps.
- Calibration/reliability diagram final version — due after July 19 by design.
- SHAP, Prometheus/Grafana, Feast, Terraform — Tier 2/3, not prioritized.
- KServe, Redis, DVC, a full ~211-country dropdown, Fly.io — previously explicitly
  rejected, see DECISIONS.md; don't re-propose without new information.

---

## 9. Reference: core pipeline logic + model details

- **Ingestion:** `fetch_historical_data.py` (one-time). `daily_update.py` pulls Odds API
  `/scores` (rolling 3-day window) -> appends new completed matches to
  `data/live/results_log.csv` -> mirrors to Supabase `match_results` (best-effort).
- **Features:** `team_timeline.build_timelines()` -- per-team Elo (K=32, home adv 100) +
  rolling 10-match form, leakage-safe as-of snapshots (tested). FIFA rank via bisect lookup.
- **Training:** `Layer1Ensemble` trains fresh each run on 1992->cutoff (two symmetric rows
  per match). Can also load a pre-fit stack from the MLflow registry instead (serving layer).
- **Layer 2 (live):** `live_bracket.py` encodes the actual 2026 remaining-bracket skeleton,
  resolves it against real results (self-corrects shootout ambiguity), Monte Carlo
  (10,000 sims, seeded) using Layer 1's match probabilities.
- **Daily output:** scores upcoming fixtures, writes a pre-kickoff snapshot to Supabase
  `match_predictions` (append-only) + local JSON, appends THREE tournament-winner series
  to `predictions_log.csv`/Supabase `tournament_predictions`: `stacked_l2_montecarlo_v1`
  (the model's own P(champion)), `heuristic_l2_montecarlo_v1` (baseline),
  `bookmaker_outright_baseline_v1` (market).
- **Grading:** `verify_predictions.py` joins each fixture's last pre-kickoff Supabase
  snapshot against its completed result once known; running accuracy/Brier/calibration.
- **Drift:** `check_drift.py` / `src/monitoring/drift_report.py` — Evidently
  `DataDriftPreset` over Layer 1's 5 numeric features, reference = 2016->2026 matches,
  current = 2026 matches so far. Pinned `evidently==0.4.40` (not latest 0.7.x, which pulls
  in a litestar UI stack that conflicts with a pre-existing `python-multipart` install).
  As of 2026-07-05, `check_drift.py` also appends a row to `data/monitoring/
  drift_history.csv` on every run (`append_history()`) — the real trend source for the
  dashboard's Drift Monitoring chart — and runs as an independent parallel Airflow task
  (`daily_update >> check_drift`, not chained into the predictions path, so a drift-check
  failure never blocks tomorrow's predictions).
- **Model registry queries (2026-07-05):** `tracking.get_registry_info()` — best-effort
  `MlflowClient` lookup of the highest registered version for `wc26-layer1-stacked-ensemble`,
  its run params/metrics, and the `meta_learner_weights.json` artifact. `tracking.
  relative_member_influence()` derives a simple, honest per-member "influence" stat from
  those real logistic-regression coefficients (NOT SHAP — see Model Card). Both used by
  `src/serving/app.py` (exposes `model_version` on every response) and
  `export_dashboard_data.py`'s `export_model_registry()`.
- **Export:** `export_dashboard_data.py` -> `dashboard/data/*.json`, now including
  `model_registry.json` (`export_model_registry()`) and `drift.json`
  (`export_drift()`, current snapshot + accumulated history).

**Model details:**
- Layer 1 = stacked meta-learner (sklearn `StackingClassifier`, 5-fold CV, logistic final
  estimator) over: XGBoost (6 features: elo_diff, form GF/GA/win-rate diffs, rank_diff,
  neutral), Elo/logreg baseline (elo_diff + neutral only), FIFA heuristic (closed-form,
  Gaussian-decay draw rate). Baseline for comparison = heuristic member alone.
- Layer 2 = Monte Carlo (not a model): `bracket.py` for backtests, `live_bracket.py` for
  the real 2026 bracket in progress.
- **Backtest numbers (post-stacking, default hyperparams, verified 2026-07-04):** 2018
  France post-group->post-SF: .061/.128/.306/.622. 2022 Argentina: .216/.211/.495/.65.
  Avg model-baseline: Brier −0.0035, log-loss −0.0987 (negative = model beats baseline).
- Optuna tuning (`scripts/tune_layer1.py`) exists and runs, but honestly does **not**
  currently beat the default hyperparams (improved isolated XGBoost CV log-loss but made
  the real backtest metric marginally worse — a proxy-metric-vs-true-objective mismatch).
  The regressing tuned-params file was deleted; the pipeline runs on `DEFAULT_XGB_PARAMS`.
  Don't assume the model is "tuned" — it isn't, yet.
- Known, not fixed, low priority: no `random_state` on `XGBClassifier`/`StackingClassifier`,
  so re-running the backtest produces slightly different per-team probabilities each time.
- MLflow: experiment `wc26-layer1-ensemble`, registry `wc26-layer1-stacked-ensemble`.
  Best-effort (1.5s TCP preflight, never blocks the pipeline).

**Historical/live match double-counting bug (found + fixed 2026-07-04):**
`data/historical/results.csv` is periodically refreshed upstream and had already absorbed
74 of the 87 real 2026 WC matches the live ingestion log also tracked; three call sites
merged historical+live with no dedup, double-counting Elo/training rows (measured: Elo
overstated +12 to +35 points for teams with several 2026 results). Fixed via
`live_results_store.load_combined_matches()`, a single deduped loader now used everywhere.
See DECISIONS.md for the full writeup.

**Key design decisions (see DECISIONS.md for full reasoning on each):**
- Stacked meta-learner (not equal-weight averaging) for Layer 1.
- Heuristic draw rate: Gaussian decay in the rank gap, not flat 25%.
- Bracket reconstructed from real results, not hand-typed seeding.
- Train fresh each `daily_update.py` run (~9s, cheap) rather than train-once; MLflow
  versions each day's model. Serving layer can instead load a registered model.
- Trivial baseline = the ensemble's own heuristic member alone, logged alongside the model.
- API-Football abandoned (season lock); Odds API is the sole live source.
- Dashboard: Next.js over Streamlit; no unlicensed stock imagery anywhere.
- Secrets in `.env` (gitignored); `.env.example` committed.
- Every optional-infra integration is best-effort: fails fast, never blocks the pipeline.
- Render over Fly.io for the serving deploy (no CLI installer needed).
- Vercel SSO/deployment-protection disabled by explicit user confirmation.
- KServe, Redis, DVC/Terraform/GitOps, Fly.io, a full ~211-country dropdown: explicitly
  rejected — see DECISIONS.md, don't re-propose.

---

## 10. Reference: codebase structure + entry points

```
CLAUDE.md            # original project spec: methodology, tiers, hard dates
DECISIONS.md         # dated log of every non-trivial decision + full reasoning
Makefile             # make demo / make backend / make test (added 2026-07-05)
requirements.txt     # top-level pins; requirements-lock.txt # full transitive lock,
                     # resolved inside python:3.10-slim (see its own header) -- wired
                     # into serving Dockerfile + CI only, deliberately NOT airflow (§7)
render.yaml          # Render Blueprint for the FastAPI serving layer
docker-compose.airflow.yml  # Postgres+Airflow, MLflow, and serving containers, all
                     # with health checks (added 2026-07-05)
data/historical/     # results.csv (1872+), fifa_ranking.csv (1992-2024), shootouts.csv
data/backtest/       # 2018.json, 2022.json -- Phase 0 validation output
data/live/           # results_log.csv (cumulative, git-tracked) + timestamped
                     # odds/prediction snapshots (gitignored, transient)
data/predictions/    # predictions_log.csv -- (date, team, win_probability, model_version)
data/tuning/         # Optuna output if present; empty on purpose (see §9)
data/monitoring/     # drift_report.json + drift_history.csv (both git-tracked, latter
                     # added 2026-07-05) + drift_report.html (gitignored, ~3MB)
src/features/        # data loading, FIFA-ranking as-of lookups, incremental Elo + rolling form
src/ingestion/       # Odds API client, live results store, Supabase client, team-name canonicalization
src/models/layer1_ensemble/  # feature rows, FIFA heuristic, stacked ensemble, MLflow tracking
                     # (get_registry_info, relative_member_influence -- added 2026-07-05), tuning
src/models/layer2_simulation/  # bracket reconstruction (backtest) + live bracket (2026) + Monte Carlo
src/verification/    # proof_tracker.py -- pure grading/calibration logic (tested)
src/monitoring/      # drift_report.py -- Evidently data-drift check (tested)
src/serving/         # FastAPI app (request-ID/latency middleware + CORS, added 2026-07-05)
                     # + OpenTelemetry instrumentation
src/orchestration/dags/  # Airflow DAG -- 4 tasks as of 2026-07-05 (check_drift added,
                     # independent parallel branch, see §9)
scripts/             # all runnable entry points, see below
dashboard/           # Next.js 16 App Router site, statically generated from dashboard/data/*.json
                     # LIVE at https://fifa2026mlops.vercel.app -- ops-console redesign 2026-07-05
                     # (see §6/§7/§8); src/components/ has ~20 components, no dead code from the
                     # old warm-editorial design (Hero/TechStack/MethodologySection/Nav all
                     # rewritten or deleted, not left orphaned)
docker/{airflow,mlflow,serving}/Dockerfile  # base images digest-pinned 2026-07-05
tests/               # 10 pytest files, 34 tests, all passing
k8s/                 # still EMPTY -- deferred (see §8)
.env                 # ODDS_API_KEY, SUPABASE_URL/KEY, ANTHROPIC_API_KEY, DASHBOARD_ORIGINS
                     # (optional, CORS override, added 2026-07-05), (API_FOOTBALL_KEY unused)
dashboard/.env.local # NEXT_PUBLIC_SERVING_API_URL (added 2026-07-05, see dashboard/.env.example)
.obsidian/, graphify-out/, Untitled.md, "WC26 Dark*.{html,pdf}"  # NOT part of this system --
                     # Dilip's own tooling / the design mockup source file. Leave alone.
```

```
python scripts/fetch_historical_data.py     # one-time: pull 3 historical CSVs
python scripts/backtest_2018_2022.py        # Phase 0 backtest -> data/backtest/*.json + console summary
python scripts/daily_update.py              # THE daily job: results->features->L1 scoring->L2 Monte Carlo->predictions log
python scripts/backfill_2026_group_stage.py # one-time (already run): Wikipedia group-stage backfill
python scripts/verify_predictions.py        # grades finished fixtures -> dashboard/data/proof_tracker.json
python scripts/export_dashboard_data.py     # logs -> dashboard/data/*.json, incl. model_registry.json
                                             # + drift.json (added 2026-07-05); run after
                                             # daily_update + verify_predictions + check_drift
python scripts/tune_layer1.py               # Optuna tuning pass (see §9: hasn't beaten defaults yet)
python scripts/check_drift.py               # Evidently drift check -> data/monitoring/drift_report.json
                                             # + drift_history.csv (appended every run) + .html
python scripts/fetch_live_snapshot.py       # raw odds/fixtures snapshot (superseded by daily_update)
python -m pytest tests/ -q                  # 34 tests
uvicorn src.serving.app:app --port 8000     # FastAPI serving layer -- docs at localhost:8000/docs
cd dashboard && npm run dev                 # local dev server at localhost:3000 (needs
                                             # NEXT_PUBLIC_SERVING_API_URL for the Live Inference
                                             # Console; falls back to "unreachable" pill without it)
make demo / make backend / make test        # see Makefile -- `make` not on Windows PATH by default

docker compose -f docker-compose.airflow.yml up -d   # Postgres + Airflow + MLflow + serving, all local
# Airflow UI: localhost:8080 (admin/admin) -- wc26_daily_pipeline DAG, 06:00 UTC daily
# MLflow UI: localhost:5000 -- experiment "wc26-layer1-ensemble", registry "wc26-layer1-stacked-ensemble"

# LIVE PUBLIC URLS:
# Dashboard: https://fifa2026mlops.vercel.app (also https://dashboard-hazel-kappa-52.vercel.app)
# FastAPI serving: pending Render deploy retry (fix pushed, commit 3e704ae -- see §3 item)
```
Requires: Python 3.10 (pandas, numpy, sklearn, xgboost, mlflow, fastapi, uvicorn,
opentelemetry-*, optuna, evidently, supabase -- see requirements.txt or requirements-lock.txt),
Node 24, `.env` with `ODDS_API_KEY`/`SUPABASE_URL`/`SUPABASE_KEY`/`ANTHROPIC_API_KEY`, Docker
Desktop (for local Airflow/MLflow/serving only -- NOT required for the live Vercel dashboard,
which is fully static except for the Live Inference Console's client-side call to the
serving API).

---

## 11. Session log

**2026-07-04 (session: Evidently + audit + mission reset).**
- Built Evidently drift monitoring (`src/monitoring/drift_report.py`,
  `scripts/check_drift.py`), pinned `evidently==0.4.40` to avoid a litestar/multipart
  import conflict. Found and fixed a real historical/live match double-counting bug in
  the process (Elo was overstated +12 to +35 points for several teams). Committed as
  `d480846`.
- Render's first real deploy attempt failed on a `requests`/`evidently` dependency
  conflict (requirements.txt had no lock file, so the conflict wasn't caught locally).
  Fixed (`requests==2.32.4`), verified with a genuine from-scratch venv install matching
  the Dockerfile exactly, committed and pushed as `3e704ae`. Render deploy retry still
  needed (Dilip to click retry).
- Dilip provided an Anthropic API key for the planned chatbot widget — saved to `.env`
  (gitignored), placeholder added to `.env.example`. Chatbot itself not yet built.
- **Mission reset**: Dilip reframed the project's actual purpose (showcase MLOps skill to
  employers) and named two concrete failure modes: presentation (engineering invisible on
  the dashboard) and longevity (pipeline won't survive 6 months of dormancy). Ran a full
  3-agent read-only audit; findings are in §7 above. Drafted the phased remediation plan
  in §8. **Nothing in §8 has been executed yet** — this file was rewritten to carry the
  full plan into the next session, per Dilip's explicit request, before any fixes were
  made. Next session should start at Backlog Step 1, item 1.

**2026-07-05 (session: Backlog Step 1 — longevity fixes, all 5 items).**
- All five Step 1 items done and verified live (not just by reading code); details and
  exact commands are in §7/§8 above, summary here:
  1. Odds API hard-crash fixed — `daily_update.py` now checks `ODDS_API_KEY` up front,
     fails gracefully. Verified: exits 0 with a clear message when unset.
  2. `requirements-lock.txt` added, resolved inside `python:3.10-slim` (not a native venv
     — first attempt on Windows pulled in `pywin32`, caught before it shipped). Wired into
     serving Dockerfile + CI only.
  3. **Real finding beyond the original audit scope**: wiring the same lock file into the
     airflow Dockerfile breaks Airflow's webserver — the lock's exact transitive pins
     (Flask 3.1.3, SQLAlchemy 2.0.51, Werkzeug 3.1.8) conflict with Airflow 2.9.3's own
     pins and its FAB auth manager fails to load (`flask.json.JSONEncoder` removed in
     Flask 2.3+). Proved this by building the airflow image both ways (lock file vs.
     plain `requirements.txt`) and running `airflow version` against each — only the
     lock-file version logged the auth-manager warning. Airflow's Dockerfile stays on
     `requirements.txt` by design, not by oversight.
  4. Docker base images pinned by digest (python:3.10-slim, apache/airflow:2.9.3-python3.10).
  5. Root `Makefile` added (`make demo`/`backend`/`test`) — noted `make` isn't on Windows
     PATH by default on Dilip's machine, not treated as a blocker (Mac/Linux/CI is the
     real target audience).
  6. Health checks added to mlflow/serving/airflow-webserver in docker-compose. Verified
     live: brought up the full stack, all four healthchecked services reached `healthy`.
- Also re-ran the full test suite (26/26 passing) both natively and inside a fresh
  `python:3.10-slim` container installing from the new lock file, and smoke-tested the
  rebuilt serving image's `/health` endpoint in a running container.
- **Next session: Backlog Step 2** (make the MLOps engineering visible on the dashboard —
  reorder sections, replace TechStack pills with real evidence/links, add a drift card,
  architecture diagram, number-backed copy). See §8 Step 2 for the full item list.

**2026-07-05 (session: full ops-console dashboard redesign, same day, later session).**
- Dilip reframed the ask well beyond the queued Step 2: transform the site from a consumer
  football-prediction look into something that reads as an internal ML ops console
  (Grafana/Datadog/MLflow-adjacent), with every section answering a specific "can this
  person build production ML systems" question. Chose "build everything now" (not phased)
  and "exclude ROI" (avoids reinforcing betting-site framing) when asked.
- **Backend additions** (all with new tests, 34/34 passing):
  - `src/serving/app.py`: request-ID + server-latency middleware (`X-Request-ID`/
    `X-Response-Time-Ms` headers), a real `model_version` field on every response, scoped
    CORS (`DASHBOARD_ORIGINS` env var) so the dashboard can call it directly from the
    browser. Verified with a genuine cross-origin `/predict` call.
  - `src/models/layer1_ensemble/tracking.py`: `get_registry_info()` (best-effort MLflow
    registry version/run/params/metrics/meta-learner-weights lookup) and
    `relative_member_influence()` (derives an honest per-ensemble-member influence stat
    from the real meta-learner coefficients — explicitly not SHAP).
  - `src/monitoring/drift_report.py`/`scripts/check_drift.py`: `data/monitoring/
    drift_history.csv` now accumulates one row per run — real trend data instead of a
    single overwritten snapshot.
  - `src/orchestration/dags/wc26_daily_pipeline.py`: added `check_drift` as an independent
    parallel branch off `daily_update` (not chained into the predictions path — a drift
    failure must never block tomorrow's predictions).
  - `scripts/export_dashboard_data.py`: new `export_model_registry()` and `export_drift()`
    → `dashboard/data/model_registry.json` / `drift.json`.
- **Frontend**: full IA rewrite (`dashboard/src/app/page.tsx`) — Live Inference Console →
  Model Registry → Training Pipeline → Drift Monitoring → Performance Monitoring →
  Backtest → Historical Archive → Model Card → CI/CD, then the kept fan-facing sections
  (Leaderboard/Country/Chart/Fixtures/Results) reskinned but deprioritized. New dark
  "ops-console" visual system replacing the warm-editorial one (`globals.css` rewritten;
  categorical/status palette chosen and validated via the dataviz skill's
  `validate_palette.js` against this project's actual `#0d0c0a` surface — PASS on
  lightness/chroma/contrast, WARN (legal, floor band) on adjacent CVD separation, mitigated
  by direct labels/legends per the skill's own rule). Deleted `Hero.tsx`'s globe treatment
  (rewritten as an exec-summary strip, same filename), `MethodologySection.tsx` and
  `TechStack.tsx` (folded into new `ModelCard.tsx`/`CicdSection.tsx`), `Nav.tsx` (folded
  into new `StatusBar.tsx`). 9 new components total.
- **Correction, not an incident**: an Explore agent initially flagged `dashboard/AGENTS.md`
  (which tells agents to read `node_modules/next/dist/docs/` before coding, since this
  project runs Next.js 16.2.10 — newer than this assistant's training data) as a likely
  prompt injection. Verified directly by reading that path: it's real, legitimate Next.js
  16 documentation, not an injection. Retracted the flag rather than let a wrong security
  alarm stand, and did read the relevant v16 docs (env vars, the v16 upgrade guide) before
  writing frontend code.
- Verified live: full docker-compose stack rebuilt (`serving` image picked up the new
  middleware), all four healthchecked services `healthy`; `npm run lint`/`npm run build`
  clean; dashboard dev server + a local `uvicorn` both run, cross-origin `/predict` call
  confirmed genuine request-ID/latency/model-version end to end. No browser tool available
  in this environment, so layout/visual polish was not eyeballed — only verified via SSR
  HTML output, lint, and build. **Recommend Dilip open http://localhost:3000 (or the
  redeployed Vercel URL) and visually sanity-check the new design before considering this
  fully done.**
- **Not done this session**: Render hasn't been redeployed with the new CORS/middleware
  code, so the production dashboard's Live Inference Console will fail against the stale
  Render deployment until that redeploy happens; `DASHBOARD_ORIGINS` should be confirmed
  set correctly for the real Vercel origin at that point.

**2026-07-05 (session: recruiter-lens trim + football-first reorder, third session today).**
- Dilip's feedback on the ops-console redesign: too much information, wants it to feel
  human-made (reference: manucossu.com — minimal, sparse copy, few sections), and wants
  the **football content first, engineering proof second** — reversing the IA from the
  previous session. Researched what recruiters actually scan (~30-40s: what is it, a live
  demo to click, an architecture diagram, outcome-framed copy; NOT dense tables/insider
  metrics) and trimmed accordingly.
- **Cut entirely**: Historical Archive section + `HistoricalArchive.tsx` (200-row audit
  table — noise at recruiter altitude; the raw log stays in the repo), StatsStrip from the
  page (numbers folded into copy; component file kept, still used by ProofTracker),
  registry card's run ID/CV folds/train-set log-loss rows, the drift trend chart until
  `drift_history.csv` has >=3 points (a 1-point line chart read as filler), 4 of the 10
  CI/CD link cards, and every long defensive paragraph.
- **Reordered** (`page.tsx`): Hero ("Who wins the 2026 World Cup?", first person) ->
  Leaderboard -> Probability chart -> Fixtures -> Country lookup -> Results ticker -> a
  short first-person divider ("Everything above comes from a system I built end to
  end...") -> Proof Tracker -> Backtest -> Live Inference Console -> How it works
  (ModelCard condensed to four short cards + one limitations line) -> Engineering
  (registry + pipeline + drift + trimmed CI/CD under one heading).
- **Humanized copy** throughout: first person, sentence case, shorter subtitles; page
  title now "Who Wins the 2026 World Cup? — daily ML predictions"; footer "Built by
  Dilip · code on GitHub".
- Verified: lint + production build clean, dev server renders the new order, archive
  gone, hero/footer copy present. Render redeploy still pending (carried over).
