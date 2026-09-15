# Our World Cup model vs Nate Silver's PELE: summary

2026 FIFA World Cup, match-level forecasts. Scored with the Ranked Probability Score (RPS) over win / draw / loss; **lower is better**.

## Headline

| Track | Matches | Ours | PELE | Bookmakers | Ours − PELE | p |
|---|---|---|---|---|---|---|
| **Live**: both forecasts public before kickoff | 21 knockout | **0.139** | 0.149 | 0.156 | −0.010 | 0.47 |
| **Full tournament**: leakage-safe replay | 102 (group → final) | 0.155 | **0.149** | — | +0.005 | 0.48 |

**Neither track shows a real difference.** Detecting the full-tournament gap at 80% power would take about **1,545 matches, roughly 15 World Cups**. A single tournament can only rule out large gaps: the 95% CI for ours − PELE is [−0.009, +0.019].

## Leakage bug found in audit, and the fix

For matches without a known kickoff time, the rule was to use PELE's last forecast published before 15:00 UTC on PELE's own date label. PELE dates matches in US Eastern time, so late Pacific kickoffs carry the *next* day's label. For Australia–Turkey that let in a PELE version published about 10 hours after the match; three group matches were affected. The deadline now uses the earlier of PELE's label and the local match date, with a regression test. Every PELE forecast is now at least 0.4 h before kickoff. The fix *worsened* PELE's score, from 0.1479 to 0.1492.

## Three claims withdrawn

| Withdrawn claim | Why the data doesn't support it |
|---|---|
| "PELE is better calibrated" | ECE is 0.055 (PELE) vs 0.073 (ours), but the 95% bootstrap CI of the difference is [−0.021, +0.059], which includes zero. |
| "Our model is too timid on favorites" | We gave favorites 59.0% and they won 64.7%. That gap's 95% CI is [−3.1, +14.7] points, which includes zero. |
| "Blending helps because the models make different mistakes" | Per-match scores correlate at 0.83, so they mostly miss the same games. The 50/50 blend beats ours on log loss only (p = 0.045; RPS p = 0.19) and does not beat PELE (p = 0.43). |

## How the comparison was kept fair

- **PELE side:** Silver Bulletin's real pre-kickoff numbers, recovered from Datawrapper's version history (127 versions, each with a publish timestamp).
- **Our live side:** forecasts committed to the public git repo before kickoff.
- **Our replay side:** trained only on data before the opening match. It reproduces our live forecasts to within 1.1 percentage points.
- **Scoring:** draws are scored as a real outcome (3-outcome scoring, not binary). Knockout results include extra time; a shootout counts as a draw.

Code: [`scripts/compare_vs_pele.py`](../scripts/compare_vs_pele.py) · Data: [`data/benchmarks/pele_comparison.json`](../data/benchmarks/pele_comparison.json) · Live page: [fifa2026mlops.vercel.app/#pele](https://fifa2026mlops.vercel.app/#pele)

---

## Appendix: the test behind every p-value

Every p-value on this page comes from **one test**:

- **Test:** a paired sign-flip randomization test (permutation test for paired data), two-tailed.
- **Data:** for each match, compute *d* = score(A) − score(B). Both forecasters are scored on the same matches.
- **Statistic:** the mean of *d*.
- **Null hypothesis:** A and B are exchangeable on every match, so each *d* is equally likely to be +*d* or −*d*.
- **Procedure:** randomly flip the sign of each *d* 10,000 times, with a fixed seed, and record the mean each time. The p-value is (1 + number of |flipped mean| ≥ |observed mean|) / 10,001.
- **Why not a paired t-test:** per-match differences are skewed by upsets, and n is as small as 14. The randomization test makes no normality assumption.

The 95% CIs are percentile bootstrap intervals of the mean difference: 10,000 resamples of matches with replacement.

| p | A vs B | Metric | Matches | Test | Tails |
|---|---|---|---|---|---|
| 0.47 | Ours vs PELE, live track | RPS | 21 | paired sign-flip randomization | two |
| 0.48 | Ours vs PELE, full replay | RPS | 102 | paired sign-flip randomization | two |
| 0.35 | Ours vs PELE, group stage | RPS | 72 | paired sign-flip randomization | two |
| 0.84 | Ours vs PELE, knockouts | RPS | 30 | paired sign-flip randomization | two |
| 0.045 | 50/50 blend vs ours | log loss | 102 | paired sign-flip randomization | two |
| 0.19 | 50/50 blend vs ours | RPS | 102 | paired sign-flip randomization | two |
| 0.15 | 50/50 blend vs ours | Brier | 102 | paired sign-flip randomization | two |
| 0.43 | 50/50 blend vs PELE | log loss | 102 | paired sign-flip randomization | two |
| 0.83 | Ours with host home advantage vs ours neutral (co-host matches) | RPS | 14 | paired sign-flip randomization | two |
| 0.63 | Ours vs PELE (co-host matches) | RPS | 14 | paired sign-flip randomization | two |

Numbers without a p-value use different methods:

- **ECE-difference and favorite-gap CIs:** percentile bootstrap over matches, 2,000 resamples. The whole statistic is recomputed on each resample.
- **"1,545 matches":** normal-approximation sample size, *n* = ((1.960 + 0.842) × SD(*d*) / |mean(*d*)|)², for α = 0.05 two-tailed and 80% power, using the observed mean and SD of the per-match RPS differences.

**Caveats to say out loud:**

1. **No multiple-comparison correction.** The only p < 0.05 (blend vs ours, log loss, 0.045) is one of three metrics tested for that pair. Under a Bonferroni correction (threshold 0.017) it would not be significant.
2. **The p-values are Monte Carlo estimates.** With 10,000 sign flips the simulation error is about ±0.002 at p ≈ 0.05.
3. **Matches aren't fully independent.** The same teams appear repeatedly, which the test treats as independent. This would, if anything, make the p-values slightly too small, not too large.
