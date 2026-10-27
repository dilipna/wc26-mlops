# Cohesive SpOps product redesign

User request: replace the visually disconnected opening page with a polished sports platform whose pages belong together, using Kalshi's browsing clarity as a product reference. No exchange, account, trading feature, invented market volume or fabricated live odds is added.

## Delivered locally

A single navigation and footer live in the Next root layout and wrap every page, including model workbenches, football archive, engineering records, Pelé study and read-only platform records. Per-page duplicate shells and the homepage-only header are removed. Shared white/slate/green tokens, local typography, compact cards and responsive spacing bridge the previously separate editorial/scorebook/dark themes.

The homepage becomes an operating sports desk rather than a long landing page: compact introduction, competition navigation, visible loaded-feed/watchlist counts, game cards and selected-match details, date/status/search controls, source/freshness labels, question assistant, local watchlist, official highlight cards and compact model-lab entry cards. A dedicated /models hub makes the historical tools discoverable without putting a second giant hero below the current-score desk.

The shared search is an actual GET form with an explicit competition selector. Queries are bounded to 160 characters and applied only to that competition's loaded date/feed. Sorting supports source order, start time and team/event title. Reset clears search/status/sort without fetching data again. Browser-local watchlist links and model breadcrumbs remain functional. Native form navigation and keyboard controls are retained.

## Preserved contracts

Eight provider adapters, current window, source timestamps, cache limits, deterministic cited Q&A/abstention, spoof/input defenses, watchlist persistence and deletion, spoiler controls, source links, Markdown/ICS exports, click-to-load official video players, historical model algorithms/evaluations/artifact bytes and model governance evidence. No new data source, package, paid API, scheduler or backend host.

All current sporting scores remain limited/delayed free snapshots. Historical model outputs remain separately dated; no current bookmaker probability, Kalshi price, trade, volume, account balance, simulated customer traction or predictive superiority is invented. The project is independent of Kalshi and sports organizations.

## Verification and release

Keep all 35 prior browser cases and add six new cases covering the shared shell/model hub at desktop/tablet/mobile, native cross-page competition search/reset, sort/selected-detail consistency, and saved/model navigation. These 41 cases run on GitHub only; local execution/desktop control remain prohibited. Fixture records test UI behavior and must not be presented as real sport results. The local production HTTP check covers real feed behavior separately.

Types, ESLint, production build, matchday/hosting-policy tests, dependency audit and original Python regressions remain required. The source is local until exact-release approval; no existing production site is changed merely by preparing this redesign. After approval, publish to existing PR1 with confined corrections, full CI, existing asmq333/dashboard staging, actual stage browser and screenshot review, promotion, public identity/HTTP/browser checks and recovery evidence. No main merge or hosting/account setting changes.
