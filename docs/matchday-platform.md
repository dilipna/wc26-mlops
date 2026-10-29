# Matchday platform — source and engineering boundaries

The October 26 expansion adds a current matchday desk alongside the preserved historical Model Lab. The homepage contains the new desk; the original WC26 archive is at `/football`. Existing `/basketball`, `/nfl`, `/cricket`, `/engineering`, `/admin`, `/pele` and `/nascar` routes remain available.

## User features

Eight explicitly selected competitions: NBA, Premier League, NFL, MLB, NHL, ATP Tour, Sheffield Shield and Formula 1. UTC date selection within seven days of today; search and status filters; source timestamps; manual refresh and opt-in five-minute refresh only while the tab is visible. A provider's empty response is never described as proof that no games are taking place.

Match files show the source's actual status, score units, venue and start time, with optional local time formatting. Race classifications use driver positions; cricket uses the provider's result summary rather than inferring a winner from runs. Finished games missing complete evidence abstain. No current predictions are derived from the old Elo datasets.

The question assistant uses deterministic intent selection and retrieval from the loaded league/date records. It answers results, start time, venue and available upcoming games, citing the actual record. It rejects unsupported requests, ambiguous names, mismatched dates and betting/prediction questions. It is not an LLM, generative commentary system or full ReAct agent. Answers and source-check steps remain visible; questions do not trigger provider calls or transmit personal text to a model.

Browser-only watchlist (30 games), remove/clear controls, spoiler protection covering the scoreboard, chat and exported notes, shareable match links, Markdown match briefs with freshness/source information and RFC5545-style UTC calendar files for scheduled games with known starts. Exports do not update automatically. Browser data may be cleared and is not synced across devices.

Original animated court/field/circuit graphics change by sport and respect reduced-motion preferences. Four athlete/signature-play spotlights use verified official NBA/NFL/ATP Tour/FORMULA 1 YouTube videos. Players load only after a click, without autoplay or rehosting; publisher links remain available if embedding is blocked. Playback depends on the publisher and region. No third-party athlete photographs or team-logo assets are copied into the project.

## Free data, current coverage and attribution

[TheSportsDB documentation](https://www.thesportsdb.com/documentation) documents the public v1 development key, 30 requests/minute and free schedule-day sampling (up to three events). [Terms](https://www.thesportsdb.com/docs_terms_of_use.php) permit development-project lookups and distinguish their rights from third-party artwork. This non-commercial portfolio uses factual records, not provider artwork. The free tier is not a full live-score feed: scores and schedules can be delayed, incomplete or corrected. Tennis/cricket can return valid empty records on a particular date; no fixtures are invented.

[Jolpica-F1](https://github.com/jolpica/jolpica-f1) supplies race schedules and published classifications, not live lap timing. Its [data terms](https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md) specify non-commercial CC BY-NC-SA 4.0 use. [Rate limits](https://github.com/jolpica/jolpica-f1/blob/main/docs/rate_limits.md) currently document 4 requests/second and 500/hour. Jolpica-derived normalized records and exports retain source and license attribution. This independent portfolio is not affiliated with any league, athlete or provider.

`dashboard/data/matchday-seed.json` is a manual, dated real-data fallback. Its per-feed `fetchedAt` is never replaced with the time a stale snapshot is served. Capture script `node dashboard/scripts/capture-matchday.mjs` is explicit/manual only; neither build nor CI executes it. No scheduler, account, paid feed or external model is added.

## Architecture and controls

`GET /api/matchday?league=nba&date=YYYY-MM-DD` is a same-origin read-only Next.js route. Strict league/date allowlists prevent arbitrary-URL fetching. Unknown/duplicate query parameters and out-of-window dates return 400; write methods are not implemented. Upstream requests use fixed HTTPS hosts, redirect rejection, an eight-second timeout, bounded streaming response bodies (512KB) and explicit schema/record validation. HTML is never rendered from provider text.

Five-minute process cache with same-key single-flight coalescing; bounded 128 entries; explicit fetch time versus serve time; Upstream fetches explicitly bypass framework raw-response caching; complete normalized feed responses (including the original fetch timestamp) are cached at the CDN for up to five minutes. Unavailable responses are not cached. The process-level upstream request budget is 20/minute. This is a per-instance protection, not a globally durable distributed quota or uptime SLA. Provider 429/errors retain a clearly labeled dated snapshot if available; otherwise the API returns 503/unavailable, not a fabricated empty success.

UI contract tests use explicitly labeled synthetic records and block external browser traffic. They verify application behavior, not provider truth or successful video playback. Real provider captures, HTTP smoke checks and official YouTube oEmbed metadata are retained separately under local validation/release evidence. Browser execution remains GitHub-only under the user's no-desktop-control restriction.

## Extension ideas

The useful additions draw on typed routing, bounded retrieval, source-check trajectories, graceful degradation, request coalescing and inspectable architecture. Existing governance/evaluation work remains intact. No claim is made that all fifteen agent projects, a generative RAG chatbot, a live-shadow experiment or a global cost kill switch has been implemented.

## Acceptance

Run `node --test scripts/hosting-policy.test.mjs tests/matchday.test.mjs`, TypeScript, ESLint and the production build from `dashboard/`. Full Python and source/staged/production browser workflows remain required by the established release process. Browser tests cover the old model pages plus current-sports selection, chat abstention/citations, spoilers, storage persistence, note/calendar downloads, media consent, date links and invalid API requests. No release is complete until current Linux CI, actual staged verification, promotion and public-source/browser verification succeed.
