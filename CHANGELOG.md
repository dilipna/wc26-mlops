# Changelog

Dated record of changes. Newest first. Timestamps come from `git log` (committer date, US Eastern / UTC).

## 2026-09-15: website restored to pre-session state; Pelé page added

- All website files changed on 2026-09-14 (hero, home page, nav, data layer, `summary.json`, `teams.json`, `predictions_timeseries.json`) and `scripts/export_dashboard_data.py` restored byte-for-byte to `f51f1f2`, at the owner's request. The home page again shows the original live tracker (Spain as favorite). Backend bug fixes from 2026-09-14 are kept but no longer feed the site.
- Added a **Pelé** tab next to the NASCAR LIVE tab and a standalone `/pele` page: benchmark scoreboard, in-browser statistics lab (bootstrap + sign-flip tests), model lab (blend and temperature scaling with leave-one-out CV), match explorer with PELE version history and provenance links, ratings comparison, power calculator, audit, and How It Works. Data: `scripts/export_pele_page.py` → `dashboard/data/pele_page.json`.
- Correction to the 2026-09-14 entry: three matches carried a next-day PELE label, but only Australia–Turkey actually received a post-match forecast under the old rule.
- Verified: pre-existing routes (`/`, `/nfl`, `/nascar`) render identical text apart from the new tab, and nav controls keep identical positions and nav height at 25 widths from 320 to 1920 px. The in-browser engine matched the Python benchmark (means, ECE and LOO fits exactly; p-values within Monte Carlo error).

## 2026-09-14: PELE benchmark, post-tournament integrity fixes, audit

**Commits** (`git log --format='%h %cI %s'`):

| Commit | Committed (EDT) | Committed (UTC) | Summary |
|---|---|---|---|
| `3c786c7` | 2026-09-14 20:29:37 | 2026-09-15 00:29:37 | fix: frozen live bracket; dedup double-counted WC matches |
| `1cc7d41` | 2026-09-14 20:29:38 | 2026-09-15 00:29:38 | feat: benchmark Layer 1 against Nate Silver's PELE |
| `9930bc7` | 2026-09-14 20:42:37 | 2026-09-15 00:42:37 | fix(benchmark): close PELE deadline leak; ground all claims in output |
| `4f69dae` | 2026-09-14 20:53:09 | 2026-09-15 00:53:09 | chore: disable daily pipeline schedule; add one-page summary |

The four commits span 23 minutes 32 seconds. That span covers *committing* only: the investigation and building happened earlier the same evening and were committed together in `3c786c7`/`1cc7d41`. The previous commit on `main` was the automated daily pipeline run `f51f1f2` at 2026-09-14 11:52:57 UTC. Committer dates come from the local machine clock; the matching GitHub push times can be checked in the repository's activity log.

**Context:** Prof. Regan asked whether the model had been compared against Nate Silver's PELE. It had not.

### Entries, in the order the work happened

1. **Dashboard bug: live tracker stuck on "Spain 61%"** (`3c786c7`)
   - Knockout draws were resolved by finding the shootout winner in *upcoming* fixtures only.
   - Once Argentina–Switzerland (QF, 2026-07-12) had been played, the Switzerland–Colombia R16 slot reverted to unresolved. That froze half the bracket.
   - From 2026-07-12 until this fix, the public site showed live title odds for a finished tournament (Spain 61.4%, with Colombia and Switzerland still "alive").
   - **Fix:** inference also uses later *played* knockout results, restricted to matches dated after the draw. The real 2026 bracket now resolves to Spain. `daily_update.py` stops logging title odds once a champion is determined.
   - **Chart history:** days 2026-07-12 to 07-19 were recomputed by `scripts/replay_bracket_incident.py`, retraining as of each day. The recomputed rows are overlaid at export time. `data/predictions/predictions_log.csv` itself was not modified.
   - **Corrected final-day forecast:** Argentina 52.4% / Spain 47.6%. The stuck version had shown Spain 59.7%.
   - Regression tests added.

2. **Elo double-counting** (`3c786c7`)
   - `load_combined_matches` deduplicated on exact `(date, home, away)`.
   - Five 2026 World Cup matches appeared in both the historical CSV and the live log, with home/away swapped or dates shifted by one day (UTC vs local). Each was applied twice to Elo and form.
   - **Fix:** dedup on the unordered team pair plus per-team score, within ±1 day. Regression test added.

3. **PELE benchmark built from scratch** (`1cc7d41`)
   - **Data** (`scripts/fetch_pele_forecasts.py`): downloads every published version of Silver Bulletin's PELE Datawrapper tables, 127 forecast-table versions and 133 ratings versions. The publish time of each version is taken from its HTTP `Last-Modified` header. Normalized copies are stored in `data/external/pele/`.
   - **Comparison** (`scripts/compare_vs_pele.py`, `src/benchmarks/`):
     - Scoring rules: RPS, Brier and log loss, all over 3 outcomes.
     - Statistics: paired bootstrap CIs, paired sign-flip randomization tests, and a power calculation.
     - Two tracks:
       - *Live*: 21 knockout matches where both forecasts were public before kickoff. Ours comes from git commit history, PELE's from Datawrapper versions.
       - *Replay*: all 102 scorable matches, with our model trained only on pre-tournament data.
   - **Dashboard:** new `#pele` section; hero switched to a tournament-complete state.

4. **Audit: leakage bug found and fixed** (`9930bc7`)
   - For matches without a known kickoff, the PELE deadline was 15:00 UTC on PELE's date label. PELE labels by US Eastern date, so late Pacific kickoffs carry the next day's label.
   - This admitted a PELE forecast published about 10 hours *after* Australia–Turkey; three matches carried a next-day label, but only Australia–Turkey actually received a post-match version.
   - **Fix:** the deadline uses the earlier of PELE's label and the venue-local match date. Regression test added. The minimum lead of any PELE forecast before kickoff is now 0.4 h.
   - **Effect:** PELE's full-tournament RPS went from 0.1479 to **0.1492**, so the fix made PELE's score *worse*. The bug had favored the benchmark, not our model.
   - Also added in this commit: decile calibration with per-bin n and a low-confidence flag (n < 10), match/drop accounting, and bootstrap CIs for the diagnostic statistics.

5. **Audit: three claims withdrawn** (`9930bc7`). Each had been published in `1cc7d41` and removed once tested:

   | Claim | Result of test |
   |---|---|
   | PELE is better calibrated | ECE 0.055 vs 0.073. The 95% bootstrap CI of the difference, [−0.021, +0.059], includes 0. |
   | Our model is too timid on favorites | Predicted 59.0%, observed 64.7%. The 95% CI of the gap, [−3.1, +14.7] points, includes 0. |
   | The two models make different mistakes, so blending helps | Per-match RPS correlation is 0.83. The blend beats ours on log loss only (p = 0.045; RPS p = 0.19) and does not beat PELE (p = 0.43). |

   A fourth statement was also corrected. Norway's PELE-vs-Elo rank gap had been attributed to squad-value information. The ratings are nearly equal (1952 vs 1946); the rank gap comes from differences in rating scale.

6. **Daily GitHub Action disabled** (`4f69dae`)
   - The `schedule` trigger in `.github/workflows/daily_pipeline.yml` is commented out. The tournament ended 2026-07-19, and the daily run only consumed Odds API quota.
   - `workflow_dispatch` is kept. The local Airflow DAG is unchanged; it runs only when Docker is up locally.

7. **One-page summary** (`4f69dae`): [docs/pele-benchmark-summary.md](docs/pele-benchmark-summary.md), linked from the README and `#pele`. It covers the headline results, the leakage fix, the withdrawn claims, and the test behind every p-value.

### Results as of `9930bc7` (RPS, lower is better)

| Track | n | Ours | PELE | Bookmakers | Ours − PELE (95% CI) | p |
|---|---|---|---|---|---|---|
| Live, pre-kickoff | 21 | 0.1386 | 0.1491 | 0.1563 | −0.0105 [−0.0385, +0.0129] | 0.47 |
| Full-tournament replay | 102 | 0.1545 | 0.1492 | — | +0.0053 [−0.0093, +0.0193] | 0.48 |

- Neither difference is significant. Detecting the full-tournament gap at 80% power would take about 1,545 matches, roughly 15 World Cups.
- Test suite: 72 tests pass.
- Reasoning for each decision is in [DECISIONS.md](DECISIONS.md) (2026-09-14).
