// In-browser statistics engine for the /pele page. A line-for-line port of
// src/benchmarks/scoring.py (scoring rules, paired bootstrap, sign-flip
// randomization test, reliability) plus the forecast-combination and
// temperature-scaling tools the Model Lab uses. Pure functions, no DOM, no
// dependencies -- so every number the page shows is recomputed from the
// raw per-match probabilities, not read from a pre-baked summary.
//
// Outcome order everywhere: [home win, draw, away win].

export type Triple = [number, number, number];
export type MetricKey = "rps" | "brier" | "log_loss";

export const METRIC_LABEL: Record<MetricKey, string> = {
  rps: "RPS",
  brier: "Brier",
  log_loss: "Log loss",
};

const EPS = 1e-6; // same clip as scoring.py's log_loss

export function rps(p: Triple, outcome: number): number {
  let cumP = 0;
  let cumA = 0;
  let total = 0;
  for (let i = 0; i < 2; i++) {
    cumP += p[i];
    cumA += i === outcome ? 1 : 0;
    total += (cumP - cumA) ** 2;
  }
  return total / 2;
}

export function brier(p: Triple, outcome: number): number {
  let s = 0;
  for (let i = 0; i < 3; i++) s += (p[i] - (i === outcome ? 1 : 0)) ** 2;
  return s;
}

export function logLoss(p: Triple, outcome: number): number {
  return -Math.log(Math.max(p[outcome], EPS));
}

export const METRICS: Record<MetricKey, (p: Triple, outcome: number) => number> = {
  rps,
  brier,
  log_loss: logLoss,
};

export function normalize(p: readonly number[]): Triple {
  const s = p[0] + p[1] + p[2];
  return [p[0] / s, p[1] / s, p[2] / s];
}

export function mean(xs: readonly number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return xs.length ? s / xs.length : NaN;
}

// Mulberry32: a tiny, fast, seedable 32-bit PRNG. Seeded so every run of
// the lab with the same settings shows the same numbers (reproducible, like
// the Python side's fixed seeds). The generator differs from Python's
// Mersenne Twister, so resampled quantities (CI ends, p-values) agree with
// Python only to within Monte Carlo error -- means agree exactly.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PairedResult = {
  n: number;
  meanDiff: number;
  sdDiff: number;
  ci95: [number, number];
  pValue: number;
  aBetter: number;
  bBetter: number;
  bootMeans: Float64Array; // sorted
  nullMeans: Float64Array; // sign-flip distribution of the mean
  matchesFor80Power: number | null;
};

// Two-sided paired sign-flip randomization test + percentile bootstrap CI of
// the mean per-match difference a - b. Mirrors scoring.paired_comparison.
export function pairedComparison(a: readonly number[], b: readonly number[], nBoot = 10_000, seed = 7): PairedResult {
  const n = a.length;
  const d = a.map((x, i) => x - b[i]);
  const m = mean(d);
  const rng = mulberry32(seed);

  const boot = new Float64Array(nBoot);
  for (let k = 0; k < nBoot; k++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += d[Math.floor(rng() * n)];
    boot[k] = s / n;
  }
  boot.sort();

  const nulls = new Float64Array(nBoot);
  let extreme = 0;
  for (let k = 0; k < nBoot; k++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += rng() < 0.5 ? d[j] : -d[j];
    const fm = s / n;
    nulls[k] = fm;
    if (Math.abs(fm) >= Math.abs(m) - 1e-12) extreme++;
  }

  let ss = 0;
  for (const x of d) ss += (x - m) ** 2;
  const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;

  return {
    n,
    meanDiff: m,
    sdDiff: sd,
    ci95: [boot[Math.floor(0.025 * nBoot)], boot[Math.floor(0.975 * nBoot) - 1]],
    pValue: (extreme + 1) / (nBoot + 1),
    aBetter: d.filter((x) => x < 0).length,
    bBetter: d.filter((x) => x > 0).length,
    bootMeans: boot,
    nullMeans: nulls,
    matchesFor80Power: m !== 0 ? requiredN(sd, Math.abs(m), 0.05, 0.8) : null,
  };
}

// ---- power ---------------------------------------------------------------

// Inverse standard-normal CDF (Acklam's rational approximation, |error| < 1.2e-9).
export function normInv(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - lo) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// Matches needed to detect a true mean paired difference `delta` with a
// two-sided test at level `alpha` and the given power, normal approximation:
// n = ((z_{1-alpha/2} + z_{power}) * sd / delta)^2. Matches scoring.py.
export function requiredN(sd: number, delta: number, alpha = 0.05, power = 0.8): number {
  return Math.ceil((((normInv(1 - alpha / 2) + normInv(power)) * sd) / delta) ** 2);
}

// ---- calibration -----------------------------------------------------------

export type Bin = { lo: number; hi: number; n: number; meanPredicted: number; observed: number; lowConfidence: boolean };

// Pooled one-vs-rest reliability over all 3 outcome probabilities per match,
// equal-width bins, plus expected calibration error. Mirrors scoring.reliability.
export function reliability(forecasts: readonly Triple[], outcomes: readonly number[], nBins = 10, lowN = 10): { bins: Bin[]; ece: number } {
  const acc = Array.from({ length: nBins }, (_, i) => ({ lo: i / nBins, hi: (i + 1) / nBins, n: 0, sumP: 0, hits: 0 }));
  forecasts.forEach((f, m) => {
    for (let i = 0; i < 3; i++) {
      const b = acc[Math.min(Math.floor(f[i] * nBins), nBins - 1)];
      b.n++;
      b.sumP += f[i];
      b.hits += outcomes[m] === i ? 1 : 0;
    }
  });
  const total = forecasts.length * 3;
  let ece = 0;
  const bins: Bin[] = [];
  for (const b of acc) {
    if (b.n === 0) continue;
    const mp = b.sumP / b.n;
    const obs = b.hits / b.n;
    ece += (b.n / total) * Math.abs(mp - obs);
    bins.push({ lo: b.lo, hi: b.hi, n: b.n, meanPredicted: mp, observed: obs, lowConfidence: b.n < lowN });
  }
  return { bins, ece };
}

// ---- forecast combination & temperature scaling ---------------------------

// Linear opinion pool: w * ours + (1 - w) * PELE (already normalized inputs,
// so the result sums to 1).
export function blend(ours: Triple, other: Triple, w: number): Triple {
  return [w * ours[0] + (1 - w) * other[0], w * ours[1] + (1 - w) * other[1], w * ours[2] + (1 - w) * other[2]];
}

// Power / temperature transform p_i^(1/T), renormalized. T < 1 sharpens
// (more confident), T > 1 flattens.
export function temper(p: Triple, T: number): Triple {
  const e = 1 / T;
  return normalize([p[0] ** e, p[1] ** e, p[2] ** e]);
}

export type GridFit = {
  grid: number[];
  inSample: number[]; // mean metric at each grid value, all matches
  bestInSample: { value: number; score: number };
  loo: { score: number; chosen: number[] }; // leave-one-out CV score + value picked for each held-out match
  identityScore: number; // score at the "do nothing" setting (w = 1 or T = 1)
};

// Fit a one-parameter forecast transform by grid search, and report an honest
// out-of-sample estimate with leave-one-out cross-validation: for each match
// i, pick the grid value that minimizes the mean metric on the OTHER n-1
// matches, then score match i with it. In-sample optima on 102 matches are
// optimistic; the LOO score is what a pre-registered choice would have got.
export function fitGrid(
  grid: number[],
  identity: number,
  transform: (matchIndex: number, value: number) => Triple,
  outcomes: readonly number[],
  metric: MetricKey,
): GridFit {
  const fn = METRICS[metric];
  const n = outcomes.length;
  // scores[g][i] = metric for match i at grid value g
  const scores = grid.map((v) => {
    const row = new Float64Array(n);
    for (let i = 0; i < n; i++) row[i] = fn(transform(i, v), outcomes[i]);
    return row;
  });
  const totals = scores.map((row) => row.reduce((s, x) => s + x, 0));
  const inSample = totals.map((t) => t / n);
  let bestG = 0;
  inSample.forEach((s, g) => {
    if (s < inSample[bestG]) bestG = g;
  });

  const chosen: number[] = [];
  let looSum = 0;
  for (let i = 0; i < n; i++) {
    let g = 0;
    let best = Infinity;
    for (let k = 0; k < grid.length; k++) {
      const s = (totals[k] - scores[k][i]) / (n - 1);
      if (s < best - 1e-15) {
        best = s;
        g = k;
      }
    }
    chosen.push(grid[g]);
    looSum += scores[g][i];
  }

  const idG = grid.findIndex((v) => Math.abs(v - identity) < 1e-9);
  return {
    grid,
    inSample,
    bestInSample: { value: grid[bestG], score: inSample[bestG] },
    loo: { score: looSum / n, chosen },
    identityScore: idG >= 0 ? inSample[idG] : fnMean(n, (i) => fn(transform(i, identity), outcomes[i])),
  };
}

function fnMean(n: number, f: (i: number) => number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += f(i);
  return s / n;
}

export function histogram(values: ArrayLike<number>, nBins: number, lo?: number, hi?: number) {
  let min = lo ?? Infinity;
  let max = hi ?? -Infinity;
  if (lo === undefined || hi === undefined) {
    for (let i = 0; i < values.length; i++) {
      min = Math.min(min, values[i]);
      max = Math.max(max, values[i]);
    }
  }
  const width = (max - min) / nBins || 1;
  const counts = new Array(nBins).fill(0);
  for (let i = 0; i < values.length; i++) {
    counts[Math.min(nBins - 1, Math.max(0, Math.floor((values[i] - min) / width)))]++;
  }
  return counts.map((c, i) => ({ x0: min + i * width, x1: min + (i + 1) * width, mid: min + (i + 0.5) * width, count: c }));
}

// Spearman rank correlation with average ranks for ties (PELE publishes
// whole-number ratings, so ties occur) -- i.e. Pearson correlation of the
// tie-averaged ranks, the same definition as scipy.stats.spearmanr.
export function averageRanks(v: readonly number[]): number[] {
  const order = v.map((val, i) => [val, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(v.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = r;
    i = j + 1;
  }
  return ranks;
}

export function pearson(x: readonly number[], y: readonly number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export function spearman(x: readonly number[], y: readonly number[]): number {
  return pearson(averageRanks(x), averageRanks(y));
}
