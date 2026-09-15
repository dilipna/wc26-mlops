"use client";

import type { ReactNode } from "react";
import { pelePage } from "@/lib/pele/data";
import { GITHUB_URL } from "@/lib/site";
import { Card, CardTitle, Eyebrow } from "./ui";

const code = (path: string) => `${GITHUB_URL}/blob/main/${path}`;

function FileLink({ path }: { path: string }) {
  return (
    <a className="font-mono text-[12px] text-accent hover:underline" href={code(path)} target="_blank" rel="noreferrer">
      {path}
    </a>
  );
}

function Block({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <Card>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] text-accent">{n}</span>
        <CardTitle>{title}</CardTitle>
      </div>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-foreground/70">{children}</div>
    </Card>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="font-mono overflow-x-auto rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-[12px] text-foreground/85">{children}</div>;
}

// Architecture diagram: plain SVG (no image assets), boxes are the real
// files/stages; it scrolls horizontally on narrow screens instead of shrinking.
function Architecture() {
  const box = (x: number, y: number, w: number, title: string, sub: string, accent = false) => (
    <g key={title}>
      <rect x={x} y={y} width={w} height={58} rx={10} fill="var(--card-alt)" stroke={accent ? "var(--accent)" : "rgba(255,255,255,0.18)"} />
      <text x={x + 12} y={y + 24} fill="var(--foreground)" fontSize="13" fontWeight="600" fontFamily="var(--font-space-grotesk)">
        {title}
      </text>
      <text x={x + 12} y={y + 43} fill="var(--secondary)" fontSize="11" fontFamily="var(--font-plex-mono)">
        {sub}
      </text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} markerEnd="url(#pele-arrow)" />
  );
  return (
    <div className="overflow-x-auto">
      <svg viewBox="0 0 1040 330" className="h-auto w-full min-w-[860px]" role="img" aria-label="Data flow from Silver Bulletin's Datawrapper charts and our git history, through Python scripts, to the statically built Next.js page and the in-browser statistics engine">
        <defs>
          <marker id="pele-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.5)" />
          </marker>
        </defs>
        <text x="10" y="16" fill="var(--secondary)" fontSize="11" fontFamily="var(--font-plex-mono)">OFFLINE · PYTHON (run once, outputs committed)</text>
        <text x="10" y="236" fill="var(--secondary)" fontSize="11" fontFamily="var(--font-plex-mono)">BUILD + BROWSER · TYPESCRIPT</text>
        {box(10, 30, 230, "Datawrapper version CDN", "3bTOr/<v>, pS7DN/<v> + Last-Modified")}
        {box(10, 110, 230, "Our git history", "upcoming_matches.json commits")}
        {box(10, 170, 230, "Match results + Elo", "results.csv + results_log.csv")}
        {box(290, 30, 230, "fetch_pele_forecasts.py", "→ data/external/pele/*.csv")}
        {box(290, 120, 230, "compare_vs_pele.py", "Layer 1 replay, scoring, tests", true)}
        {box(570, 75, 210, "pele_comparison.json", "data/benchmarks/")}
        {box(820, 75, 210, "export_pele_page.py", "+ version histories, ratings")}
        {box(820, 250, 210, "pele_page.json", "static import at build time")}
        {box(570, 250, 210, "Next.js /pele (static)", "client components, Recharts")}
        {box(290, 250, 230, "stats.ts in your browser", "bootstrap, sign-flip, LOO-CV", true)}
        {arrow(240, 59, 290, 59)}
        {arrow(240, 139, 290, 149)}
        {arrow(240, 199, 290, 159)}
        {arrow(405, 88, 405, 120)}
        {arrow(520, 149, 570, 110)}
        {arrow(780, 104, 820, 104)}
        {arrow(925, 133, 925, 250)}
        {arrow(820, 279, 780, 279)}
        {arrow(570, 279, 520, 279)}
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  const versions = pelePage.sources.pele_data.charts;
  const liveN = pelePage.matches.filter((m) => m.live).length;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <Eyebrow>Architecture</Eyebrow>
        <CardTitle>From a public chart CDN to statistics running in your browser</CardTitle>
        <p className="mb-4 max-w-4xl text-[14px] leading-relaxed text-foreground/70">
          The expensive, model-dependent work (retrieving PELE&apos;s history, re-running our model, scoring, significance tests) runs offline in Python, and its
          outputs are committed to the repository. The page is a statically generated Next.js route that imports one JSON file at build time. Everything
          interactive (every test, fit and chart on this page) is recomputed in the browser from per-match probabilities by a small TypeScript engine. There is no
          server, API or database behind this page, and no large language model anywhere in it.
        </p>
        <Architecture />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block n="01" title="Getting PELE's numbers as they were before kickoff">
          <p>
            Silver Bulletin publishes PELE&apos;s match forecasts as a Datawrapper table (chart <span className="font-mono">3bTOr</span>) and team ratings as
            another (<span className="font-mono">pS7DN</span>). Datawrapper keeps every published version at an immutable URL and serves each with an HTTP{" "}
            <span className="font-mono">Last-Modified</span> header. <FileLink path="scripts/fetch_pele_forecasts.py" /> walks version numbers until it hits a
            gap, and recovers {versions["3bTOr"]?.versions ?? "—"} forecast-table versions and {versions["pS7DN"]?.versions ?? "—"} ratings versions. It keeps
            only World Cup rows, maps each team code to our naming, and fails loudly on any unknown code rather than dropping the row.
          </p>
          <p>
            For each match the benchmark uses PELE&apos;s <em>last version published before a deadline</em>: the exact kickoff when our fixture feed recorded it,
            otherwise 15:00 UTC on the earlier of PELE&apos;s US-Eastern date label and the venue-local match date. Every 2026 kickoff was at or after 16:00 UTC on its
            local date, so that is always pre-kickoff. The label-only version of this rule leaked one post-match forecast (see the audit above); it is fixed and
            pinned by a regression test in <FileLink path="tests/test_pele_benchmark.py" />.
          </p>
        </Block>

        <Block n="02" title="Our side: two tracks that are never mixed">
          <p>
            <strong className="text-foreground">Live ({liveN} matches).</strong> Our daily pipeline committed its forecasts to{" "}
            <span className="font-mono">dashboard/data/upcoming_matches.json</span>. The comparison reads every historical version with{" "}
            <span className="font-mono">git log</span> / <span className="font-mono">git show</span> and uses the newest commit made before kickoff. Local log
            files are deliberately ignored: they are gitignored, so their timestamps prove nothing to anyone else.
          </p>
          <p>
            <strong className="text-foreground">Replay ({pelePage.matches.length} matches).</strong> Our Layer 1 model is re-run with the same code and features, but
            trained once, only on matches from 1992-01-01 to 2026-06-11 (production retrained daily). It is a scikit-learn stacking classifier over three members (XGBoost with 200 trees, depth 4, learning rate
            0.1; a logistic regression on Elo difference and venue; a FIFA-ranking heuristic), blended by a logistic meta-learner with 5-fold stacking. Its six
            features (Elo difference, rolling goals for/against and win-rate differences, FIFA points difference, neutral venue) (including FIFA ranking points) are looked up strictly
            before each match date, so no match can see its own result. On the {liveN} live matches the replay lands within {(pelePage.headline.live.replay_fidelity_mean_abs_diff * 100).toFixed(1)}{" "}
            probability points of what was actually published, which is the fidelity check for the replay.
          </p>
        </Block>

        <Block n="03" title="Scoring: proper rules for three ordered outcomes">
          <p>
            Every forecast is a probability vector p = (home win, draw, away win) and every result is one of those three, so draws are a real outcome, not dropped
            or split. Knockout results use the recorded score including extra time; a shootout counts as a draw. The headline metric is the Ranked Probability
            Score, which respects the ordering (calling a home win a draw costs less than calling it an away win):
          </p>
          <Formula>RPS = ½ · Σₖ₌₁² ( Σᵢ≤ₖ pᵢ − Σᵢ≤ₖ oᵢ )²   Brier = Σᵢ (pᵢ − oᵢ)²   log loss = −ln max(p_outcome, 10⁻⁶)</Formula>
          <p>All three are strictly proper: a forecaster minimizes its expected score only by reporting its true beliefs.</p>
        </Block>

        <Block n="04" title="Statistics: paired, distribution-free, and powered">
          <p>
            Both forecasters are scored on the same matches, so every test works on per-match differences d = score(A) − score(B). The p-value comes from a
            two-sided <strong className="text-foreground">sign-flip randomization test</strong>: under the null that A and B are interchangeable, each dᵢ is
            equally likely to be +dᵢ or −dᵢ. 10,000 random sign vectors give the null distribution of the mean, and p = (1 + #|flipped mean| ≥ |observed mean|) /
            10,001. The 95% interval is a percentile <strong className="text-foreground">bootstrap</strong> over matches (10,000 resamples). A paired t-test was
            rejected because upsets make the differences heavily skewed and some subsets have only 14 matches.
          </p>
          <Formula>n_required = ⌈ ((z₁₋α/₂ + z_power) · SD(d) / gap)² ⌉</Formula>
          <p>
            Caveats stated up front: no multiple-comparison correction is applied; matches share teams, so they are not fully independent; p-values are Monte
            Carlo estimates (about ±0.002 near p = 0.05).
          </p>
        </Block>

        <Block n="05" title="The in-browser engine, and how it was verified">
          <p>
            <FileLink path="dashboard/src/lib/pele/stats.ts" /> is a dependency-free TypeScript port of <FileLink path="src/benchmarks/scoring.py" />: the three
            scoring rules, the paired bootstrap and sign-flip test, decile reliability with expected calibration error, Spearman correlation with tie-averaged
            ranks, an inverse-normal (Acklam) for the power formula, and the grid-search / leave-one-out fitter used by the Model Lab. Randomness comes from a
            seeded Mulberry32 generator, so the same settings always show the same numbers.
          </p>
          <p>
            Before any UI was built, the compiled engine was run against the same data as the Python benchmark. Mean score differences, ECE, and the
            leave-one-out blend and temperature fits matched to floating-point precision; bootstrap interval ends and p-values differed only by Monte Carlo error
            (for example p = 0.484 in the browser vs 0.479 in Python for the full-tournament RPS test), because the two languages use different random generators.
            One 10,000-resample test took roughly 50 ms on a laptop, so it runs synchronously on each control change without a Web Worker.
          </p>
        </Block>

        <Block n="06" title="The ML in the Model Lab, and why it is cross-validated">
          <p>
            <strong className="text-foreground">Forecast combination</strong> is a linear opinion pool, w·ours + (1−w)·PELE, over w ∈ {"{0, 0.05, …, 1}"}.{" "}
            <strong className="text-foreground">Temperature scaling</strong> maps each probability to pᵢ^(1/T) and renormalizes, over T ∈ {"{0.50, 0.55, …, 1.50}"}.
            Both are fit by grid search on the selected metric.
          </p>
          <p>
            Choosing a knob on the same 102 matches you then score is optimistic, so the lab also reports{" "}
            <strong className="text-foreground">leave-one-out cross-validation</strong>: for each match i, the knob is chosen on the other 101 matches and match i is
            scored with it; the reported LOO score is the mean over all 102 held-out matches. The scores for every grid value are computed once, and each fold
            reuses them by subtracting the held-out match, so the whole LOO fit takes a few milliseconds. The lab also lists which values the folds chose, which
            shows how stable the optimum is.
          </p>
        </Block>

        <Block n="07" title="Frontend implementation">
          <p>
            The page is a Next.js 16 App Router route (<span className="font-mono">src/app/pele/page.tsx</span>), prerendered as static HTML at build time. It
            reuses the site&apos;s own <span className="font-mono">Nav</span>, <span className="font-mono">SectionHeading</span> and{" "}
            <span className="font-mono">Footer</span>, the existing design tokens and glass cards, Recharts for every chart and framer-motion for the same entrance
            animations the rest of the site uses. Sections are client components with local React state and memoized derivations; nothing is fetched at runtime.
          </p>
          <p>
            The PELÉ tab sits next to the existing sport tabs but is deliberately <em>not</em> an entry in <span className="font-mono">sports_config.json</span>:
            PELE is a benchmark, not a sport, and that config also drives sport routing, the completed-sports showcase and a backend retrospective script. The tab
            is a separate link rendered after the config-driven sport tabs, with the same styling.
          </p>
          <p>
            Charts follow a validated palette (forecaster colors and the home/away outcome pair pass a colorblind-separation check against the dark card), draws
            are dashed gray so identity never relies on color alone, low-confidence calibration bins (n &lt; 10) are drawn hollow, and controls are native buttons,
            ranges and selects with ARIA roles.
          </p>
        </Block>

        <Block n="08" title="Reproduce everything">
          <Formula>
            python scripts/fetch_pele_forecasts.py &nbsp;# refresh PELE history (network)
            <br />
            python scripts/compare_vs_pele.py &nbsp;&nbsp;&nbsp;# replay + scoring + tests (~1 min)
            <br />
            python scripts/export_pele_page.py &nbsp;&nbsp;# build dashboard/data/pele_page.json
            <br />
            python -m pytest tests/test_pele_benchmark.py
          </Formula>
          <p>
            Every PELE number on the page links to the exact Datawrapper CSV it came from, and every live forecast of ours links to the commit that published it.
            A one-page summary with the test behind each p-value is in <FileLink path="docs/pele-benchmark-summary.md" />.
          </p>
          <p className="text-foreground/55">
            Limitations: one tournament, so no gap between the models is detectable; PELE&apos;s method column above paraphrases its published methodology; the
            replay is a faithful re-run of our model, not a record of what we published for the group stage; team-strength inputs come from results only.
          </p>
        </Block>
      </div>
    </div>
  );
}
