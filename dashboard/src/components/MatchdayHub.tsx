"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LEAGUES,
  getLeague,
  utcDay,
  offsetDay,
  validWindow,
  answerQuestion,
  resultSentence,
  calendarEvent,
  matchBrief,
  type Match,
  type Feed,
  type Answer,
  type LeagueKey,
} from "@/lib/matchday/core";
import { SPOTLIGHTS } from "@/lib/matchday/media";

type Saved = {
  id: string;
  title: string;
  league: LeagueKey;
  date: string;
  sourceUrl: string;
};
const stateNames = {
  scheduled: "Upcoming",
  "in-progress": "In progress · delayed feed",
  finished: "Final",
  postponed: "Postponed",
  cancelled: "Cancelled",
  unknown: "Status unconfirmed",
};
function saveFile(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
function Arena({ sport }: { sport: string }) {
  return (
    <svg className="matchday-arena" viewBox="0 0 600 260" aria-hidden="true">
      <defs>
        <radialGradient id="arena-glow">
          <stop stopColor="#d7ef91" stopOpacity=".3" />
          <stop offset="1" stopColor="#d7ef91" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="320" cy="130" rx="270" ry="150" fill="url(#arena-glow)" />
      {sport === "Motorsport" ? (
        <>
          <path
            className="arena-track"
            d="M100 180 Q80 50 210 60 L410 60 Q530 80 480 150 L385 195 Q345 245 270 180 L190 125 Q135 105 100 180Z"
          />
          <path
            className="arena-route"
            d="M100 180 Q80 50 210 60 L410 60 Q530 80 480 150 L385 195 Q345 245 270 180 L190 125 Q135 105 100 180Z"
          />
        </>
      ) : sport === "Baseball" ? (
        <>
          <path d="M300 230L185 130L300 30L415 130Z" />
          <path d="M300 230L110 70Q300-35 490 70Z" />
          <circle cx="300" cy="130" r="20" />
          {[
            [300, 230],
            [185, 130],
            [300, 30],
            [415, 130],
          ].map(([x, y]) => (
            <rect
              key={`${x}-${y}`}
              x={x - 5}
              y={y - 5}
              width="10"
              height="10"
            />
          ))}
          <circle className="arena-ball" cx="300" cy="130" r="6" />
        </>
      ) : sport === "Cricket" ? (
        <>
          <ellipse
            cx="300"
            cy="130"
            rx="225"
            ry="105"
            fill="none"
            stroke="#c6de9e"
          />
          <ellipse
            cx="300"
            cy="130"
            rx="140"
            ry="70"
            fill="none"
            stroke="#c6de9e"
            strokeDasharray="5 7"
          />
          <rect x="275" y="70" width="50" height="120" />
          <path d="M265 85H335M265 175H335M292 75V87M300 75V87M308 75V87M292 173V185M300 173V185M308 173V185" />
          <circle className="arena-ball" cx="300" cy="130" r="6" />
        </>
      ) : (
        <>
          <rect
            x="70"
            y="30"
            width="460"
            height="200"
            rx={sport === "Ice hockey" ? 85 : 5}
          />
          <path d="M300 30V230" />
          {sport === "American football" ? (
            <>
              {[116, 162, 208, 254, 346, 392, 438, 484].map((x) => (
                <path key={x} d={`M${x} 30V230`} />
              ))}
              <path d="M70 65H530M70 195H530" strokeDasharray="2 8" />
            </>
          ) : sport === "Tennis" ? (
            <path d="M70 65H530M70 195H530M180 65V195M420 65V195M180 130H420" />
          ) : (
            <>
              <circle cx="300" cy="130" r="40" />
              {sport === "Basketball" ? (
                <>
                  <path d="M70 75H140V185H70M530 75H460V185H530" />
                  <path d="M70 45Q255 130 70 215M530 45Q345 130 530 215" />
                </>
              ) : sport === "Ice hockey" ? (
                <>
                  <path d="M195 30V230M405 30V230M120 65V195M480 65V195" />
                  {[
                    [170, 85],
                    [170, 175],
                    [430, 85],
                    [430, 175],
                  ].map(([x, y]) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="22" />
                  ))}
                </>
              ) : (
                <>
                  <path d="M70 70H145V190H70M530 70H455V190H530" />
                  <circle cx="110" cy="130" r="4" />
                  <circle cx="490" cy="130" r="4" />
                </>
              )}
            </>
          )}
          <circle className="arena-ball" cx="300" cy="130" r="9" />
        </>
      )}
    </svg>
  );
}
export default function MatchdayHub({
  initialFeeds,
  initialDay,
}: {
  initialFeeds: Feed[];
  initialDay: string;
}) {
  const [league, setLeague] = useState<LeagueKey>("nba");
  const [day, setDay] = useState(initialDay);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [spoilers, setSpoilers] = useState(false);
  const [auto, setAuto] = useState(false);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<
    { question: string; answer: Answer }[]
  >([]);
  const [media, setMedia] = useState<string | null>(null);
  const [localTime, setLocalTime] = useState(false);
  const pendingId = useRef("");
  const requestRef = useRef<HTMLInputElement>(null);
  const [today, setToday] = useState(initialDay);
  const config = getLeague(league)!;
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem("spops-matchday-v1");
        if (raw && raw.length <= 30000) {
          const p = JSON.parse(raw);
          if (p.schema === 1) {
            if (Array.isArray(p.saved))
              setSaved(
                p.saved
                  .slice(0, 30)
                  .filter(
                    (x: Saved) =>
                      x &&
                      /^tsdb-\d+$|^jolpica-\d{4}-\d{1,2}$/.test(x.id) &&
                      getLeague(x.league) &&
                      typeof x.title === "string" &&
                      x.title.length <= 400 &&
                      /^\d{4}-\d{2}-\d{2}$/.test(x.date),
                  )
                  .map((x: Saved) => ({
                    ...x,
                    sourceUrl: x.id.startsWith("tsdb-")
                      ? `https://www.thesportsdb.com/event/${x.id.slice(5)}`
                      : `https://api.jolpi.ca/ergast/f1/${x.id.split("-")[1]}/${x.id.split("-")[2]}.json`,
                  })),
              );
            setSpoilers(p.spoilers === true);
          }
        }
      } catch {
        setNotice(
          "Saved preferences could not be read. The match feed still works.",
        );
      }
      setToday(utcDay());
      const params = new URLSearchParams(window.location.search);
      const chosen = params.get("league"),
        date = params.get("date"),
        id = params.get("match");
      if (chosen && getLeague(chosen)) setLeague(chosen as LeagueKey);
      setDay(date && validWindow(date) ? date : utcDay());
      if (id && /^(tsdb-\d+|jolpica-\d{4}-\d{1,2})$/.test(id))
        pendingId.current = id;
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        "spops-matchday-v1",
        JSON.stringify({ schema: 1, spoilers, saved }),
      );
    } catch {
      queueMicrotask(() =>
        setNotice(
          "Browser storage is unavailable; watchlist changes will last only for this tab.",
        ),
      );
    }
  }, [spoilers, saved, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    async function load() {
      try {
        const r = await fetch(`/api/matchday?league=${league}&date=${day}`, {
          signal: controller.signal,
        });
        const next = await r.json();
        if (
          next.schema !== 1 ||
          next.league !== league ||
          next.date !== day ||
          !Array.isArray(next.events)
        )
          throw Error("Feed unavailable");
        if (!controller.signal.aborted) {
          setFeed(next);
          setSelectedId(
            next.events.some((e: Match) => e.id === pendingId.current)
              ? pendingId.current
              : next.events[0]?.id || "",
          );
          pendingId.current = "";
        }
      } catch {
        if (!controller.signal.aborted) {
          const fallback = initialFeeds.find(
            (f) => f.league === league && f.date === day,
          );
          setFeed(
            fallback
              ? {
                  ...fallback,
                  state: "snapshot",
                  warning:
                    "Network unavailable. Showing the dated saved snapshot.",
                }
              : {
                  schema: 1,
                  league,
                  date: day,
                  events: [],
                  fetchedAt: null,
                  servedAt: new Date().toISOString(),
                  state: "unavailable",
                  provider:
                    config.provider === "jolpica"
                      ? "Jolpica-F1"
                      : "TheSportsDB",
                  sourceUrls: [],
                  coverage:
                    "Coverage is limited; no result is inferred from a failed request.",
                  warning:
                    "The feed could not be loaded. Try another date or retry.",
                },
          );
          setSelectedId(fallback?.events[0]?.id || "");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [league, day, attempt, hydrated, initialFeeds, config.provider]);
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        setLoading(true);
        setAttempt((a) => a + 1);
      }
    }, 300000);
    return () => clearInterval(timer);
  }, [auto]);
  const currentFeed =
    feed?.league === league && feed?.date === day ? feed : null;
  const events = currentFeed?.events || [];
  const selected = events.find((e) => e.id === selectedId) || null;
  const filtered = events.filter(
    (e) =>
      (filter === "all" ||
        (filter === "saved"
          ? saved.some((s) => s.id === e.id)
          : e.state === filter)) &&
      e.title.toLowerCase().includes(search.toLowerCase()),
  );
  function change(nextLeague: LeagueKey, nextDay = day, id = "") {
    setLeague(nextLeague);
    setDay(nextDay);
    pendingId.current = id;
    setSelectedId("");
    setAnswers([]);
    setFilter("all");
    setLoading(true);
    setAttempt((a) => a + 1);
  }
  function toggleSave(e: Match) {
    if (saved.some((s) => s.id === e.id)) {
      setSaved((s) => s.filter((x) => x.id !== e.id));
      setNotice("Game removed from your device's watchlist.");
    } else if (saved.length >= 30)
      setNotice(
        "Your watchlist holds 30 games. Remove one before saving another.",
      );
    else {
      setSaved((s) => [
        ...s,
        {
          id: e.id,
          league: e.league,
          title: e.title,
          date: e.date,
          sourceUrl: e.sourceUrl,
        },
      ]);
      setNotice(
        "Game saved on this browser. No account or server profile created.",
      );
    }
  }
  function ask(q: string) {
    setQuestion("");
    setAnswers((a) => [
      ...a.slice(-5),
      {
        question: q.slice(0, 400),
        answer: answerQuestion(q, events, selected, spoilers),
      },
    ]);
  }
  const time = (e: Match) =>
    e.startsAt
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: localTime ? undefined : "UTC",
          timeZoneName: "short",
        }).format(new Date(e.startsAt))
      : `${e.date} · time not supplied`;
  return (
    <section className="matchday" aria-labelledby="matchday-title">
      <header className="matchday-header site-nav">
        <Link href="/" className="matchday-brand">
          sp<span>o</span>ps<span className="matchday-brand-dot">.</span>
        </Link>
        <nav aria-label="Platform">
          <a href="#match-center">Matchday</a>
          <a href="#spotlights">Signature plays</a>
          <a href="#model-lab">Model lab</a>
          <Link href="/engineering">The engineering ↗</Link>
        </nav>
        <span className="matchday-edition">INDEPENDENT SPORTS DESK</span>
      </header>
      <div className="matchday-hero">
        <div>
          <p className="matchday-eyebrow">FOR THE LOVE OF THE GAME</p>
          <h1 id="matchday-title">
            Every game.
            <br />
            <em>More context.</em>
          </h1>
          <p>
            Find the match. Ask the score. Keep the moment.
            <br />
            Your sports desk, with the sources attached.
          </p>
          <a className="matchday-hero-link" href="#match-center">
            Find your game <span>↘</span>
          </a>
        </div>
        <div className="matchday-visual">
          <span className="matchday-visual-label">
            IN FOCUS / {config.sport.toUpperCase()}
          </span>
          <Arena sport={config.sport} />
          <div className="matchday-visual-caption">
            <strong>{config.name}</strong>
            <span>
              Real source records.
              <br />
              No invented scorelines.
            </span>
          </div>
          <span className="matchday-visual-number">
            0{LEAGUES.findIndex((l) => l.key === league) + 1}
          </span>
        </div>
      </div>
      <div className="matchday-leagues" aria-label="Choose a competition">
        {LEAGUES.map((l) => (
          <button
            key={l.key}
            aria-label={`Choose ${l.name}`}
            aria-pressed={league === l.key}
            onClick={() => change(l.key)}
          >
            <span aria-hidden="true">{l.mark}</span>
            {l.name}
            <small>{l.sport}</small>
          </button>
        ))}
      </div>
      <section
        id="match-center"
        className="matchday-center"
        aria-labelledby="match-center-title"
      >
        <div className="matchday-section-heading">
          <div>
            <p className="matchday-eyebrow">01 / THE MATCHDAY DESK</p>
            <h2 id="match-center-title">The game, at a glance.</h2>
          </div>
          <span>
            {config.name} / {config.sport}
          </span>
        </div>
        <div className="matchday-controls">
          <div className="matchday-dates">
            <button onClick={() => change(league, offsetDay(today, -1))}>
              Yesterday
            </button>
            <button onClick={() => change(league, today)}>Today</button>
            <button onClick={() => change(league, offsetDay(today, 1))}>
              Tomorrow
            </button>
          </div>
          <label>
            Match date (UTC)
            <input
              type="date"
              aria-label="Match date (UTC)"
              value={day}
              min={offsetDay(today, -7)}
              max={offsetDay(today, 7)}
              onChange={(e) => {
                if (validWindow(e.target.value)) change(league, e.target.value);
              }}
            />
          </label>
          <button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setAttempt((a) => a + 1);
            }}
          >
            ↻ {loading ? "Checking feed…" : "Refresh feed"}
          </button>
        </div>
        <div className="matchday-preferences">
          <label>
            <input
              type="checkbox"
              checked={spoilers}
              onChange={(e) => {
                setSpoilers(e.target.checked);
                setAnswers([]);
              }}
            />{" "}
            Hide results · spoiler protection
          </label>
          <label>
            <input
              type="checkbox"
              checked={localTime}
              onChange={(e) => setLocalTime(e.target.checked)}
            />{" "}
            Show my local start times
          </label>
          <label>
            <input
              type="checkbox"
              checked={auto}
              onChange={(e) => setAuto(e.target.checked)}
            />{" "}
            Auto-refresh every 5 minutes
          </label>
        </div>
        <div className="matchday-feed-state" role="status">
          <span
            className={`matchday-status-dot ${currentFeed?.state === "unavailable" ? "is-down" : ""}`}
          />
          <strong>
            {loading
              ? "Checking source"
              : currentFeed?.state === "snapshot"
                ? "Saved snapshot"
                : currentFeed?.state === "unavailable"
                  ? "Feed unavailable"
                  : "Source snapshot"}
          </strong>
          <span>
            {currentFeed?.fetchedAt
              ? `Fetched ${new Date(currentFeed.fetchedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC`
              : "Waiting for source"}
          </span>
          <small>
            Refreshes are cached for up to 5 minutes; this is not a live
            broadcast.
          </small>
        </div>
        {currentFeed?.warning && (
          <p className="matchday-warning">{currentFeed.warning}</p>
        )}
        <div className="matchday-filter-row">
          <label>
            Find a team or game
            <input
              type="search"
              placeholder="Search these games…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div role="group" aria-label="Filter games">
            {[
              ["all", "All games"],
              ["scheduled", "Upcoming"],
              ["finished", "Final"],
              ["saved", "Saved here"],
            ].map(([value, name]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <div className="matchday-workspace">
          <div
            className="matchday-match-list"
            aria-label="Source match records"
          >
            {!loading && !filtered.length && (
              <div className="matchday-empty">
                <span aria-hidden="true">◌</span>
                <h3>
                  {currentFeed?.state === "unavailable"
                    ? "We couldn't reach the scoreboard."
                    : events.length
                      ? "No games match that filter."
                      : "No events returned for this date."}
                </h3>
                <p>
                  {events.length
                    ? "Try another search or filter."
                    : "The free feed is a limited sample. An empty response does not mean no games are taking place. Try yesterday or another competition."}
                </p>
              </div>
            )}
            {loading && !currentFeed && (
              <p role="status" className="matchday-empty">
                Checking the source for {config.name}…
              </p>
            )}
            {filtered.map((e) => (
              <article
                className={`matchday-match ${selectedId === e.id ? "is-selected" : ""}`}
                key={e.id}
              >
                <div className="matchday-match-meta">
                  <span>{stateNames[e.state]}</span>
                  <span>{time(e)}</span>
                </div>
                <button
                  className="matchday-select-match"
                  aria-pressed={selectedId === e.id}
                  onClick={() => {
                    setSelectedId(e.id);
                    setAnswers([]);
                  }}
                  aria-label={`Inspect ${e.title}`}
                >
                  {e.kind === "race" ? (
                    <>
                      <strong>{e.title}</strong>
                      <span className="matchday-race-winner">
                        {spoilers
                          ? "Classification hidden"
                          : e.podium[0]?.name || "Classification not available"}
                      </span>
                    </>
                  ) : (
                    <>
                      {[
                        [e.home, e.homeScore],
                        [e.away, e.awayScore],
                      ].map(([name, value], i) => (
                        <span className="matchday-team-row" key={i}>
                          <span
                            className="matchday-team-mark"
                            aria-hidden="true"
                          >
                            {initials(String(name))}
                          </span>
                          <strong>{name}</strong>
                          <b>
                            {spoilers ||
                            e.state === "scheduled" ||
                            e.kind === "cricket"
                              ? "—"
                              : (value ?? "—")}
                          </b>
                        </span>
                      ))}
                    </>
                  )}
                </button>
                <div className="matchday-match-footer">
                  <span>
                    {e.kind === "cricket" ? "See provider result" : config.unit}
                  </span>
                  <button
                    aria-label={`${saved.some((s) => s.id === e.id) ? "Unsave" : "Save"} ${e.title}`}
                    onClick={() => toggleSave(e)}
                  >
                    {saved.some((s) => s.id === e.id)
                      ? "★ Saved"
                      : "☆ Save game"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <aside
            className="matchday-detail"
            aria-labelledby="match-detail-title"
          >
            <p className="matchday-eyebrow">THE MATCH FILE</p>
            <h3 id="match-detail-title">
              {selected?.title || "Select a game."}
            </h3>
            {selected && (
              <>
                <p className="matchday-result">
                  {spoilers
                    ? "Results hidden. Enjoy the game on your terms."
                    : resultSentence(selected)}
                </p>
                <dl>
                  <div>
                    <dt>Competition</dt>
                    <dd>{config.name}</dd>
                  </div>
                  <div>
                    <dt>Start</dt>
                    <dd>{time(selected)}</dd>
                  </div>
                  <div>
                    <dt>Venue</dt>
                    <dd>{selected.venue || "Not supplied"}</dd>
                  </div>
                  <div>
                    <dt>Source status</dt>
                    <dd>{selected.providerStatus || "Not supplied"}</dd>
                  </div>
                </dl>
                {!spoilers && selected.kind === "race" && (
                  <ol className="matchday-podium">
                    {selected.podium.map((p) => (
                      <li key={p.position}>
                        <b>P{p.position}</b> {p.name}
                        <span>{p.team}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="matchday-file-actions">
                  <button
                    onClick={() => {
                      if (currentFeed)
                        saveFile(
                          `spops-${selected.id}-brief.md`,
                          matchBrief(selected, currentFeed, spoilers),
                          "text/markdown",
                        );
                      setNotice(
                        "Match brief downloaded with its source, date and freshness.",
                      );
                    }}
                  >
                    ↓ Download match brief
                  </button>
                  {selected.state === "scheduled" && selected.startsAt && (
                    <button
                      onClick={() => {
                        saveFile(
                          `spops-${selected.id}.ics`,
                          calendarEvent(selected),
                          "text/calendar",
                        );
                        setNotice(
                          "Calendar file downloaded. Schedule changes won't update it automatically.",
                        );
                      }}
                    >
                      ＋ Add to calendar
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/?league=${league}&date=${day}&match=${selected.id}#match-center`;
                      try {
                        await navigator.clipboard.writeText(url);
                        setNotice(
                          "Match link copied. Source records can change.",
                        );
                      } catch {
                        setNotice(`Copy this match link: ${url}`);
                      }
                    }}
                  >
                    ↗ Copy match link
                  </button>
                  <button
                    onClick={() => {
                      ask("Who won this game?");
                      requestRef.current?.focus();
                    }}
                  >
                    Ask about this game →
                  </button>
                </div>
                <a
                  className="matchday-source-link"
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open original source ↗
                </a>
              </>
            )}
            <p className="matchday-small">
              {currentFeed?.coverage || "Only source-backed records are shown."}
            </p>
          </aside>
        </div>
        <div className="matchday-source-bar">
          <span>DATA / {currentFeed?.provider || "TheSportsDB"}</span>
          <a
            href={
              config.provider === "jolpica"
                ? "https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md"
                : "https://www.thesportsdb.com/docs_terms_of_use.php"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Source terms & attribution ↗
          </a>
          <span>
            {config.provider === "jolpica"
              ? "CC BY-NC-SA 4.0 · non-commercial portfolio"
              : "TheSportsDB free development API · limited coverage"}
          </span>
        </div>
      </section>
      <div className="matchday-companions">
        <section
          className="matchday-assistant"
          aria-labelledby="matchday-chat-title"
        >
          <p className="matchday-eyebrow">02 / ASK THE DESK</p>
          <h2 id="matchday-chat-title">
            A question. A source.
            <br />A straight answer.
          </h2>
          <p>
            Ask about the games loaded above. This lightweight retrieval
            assistant looks up records; it does not use a language model or
            invent missing results.
          </p>
          <div className="matchday-chat-suggestions">
            {[
              "Who won this game?",
              "When does this game start?",
              "Where is this game?",
            ].map((q) => (
              <button
                key={q}
                disabled={!selected || loading}
                onClick={() => ask(q)}
              >
                {q}
              </button>
            ))}
          </div>
          <div className="matchday-chat-log" aria-live="polite">
            {answers.map((a, i) => (
              <div className="matchday-answer" key={i}>
                <b>{a.question}</b>
                <p>{a.answer.text}</p>
                {a.answer.citations.map((e) => (
                  <a
                    key={e.id}
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Source: {e.title} · {e.date} ↗
                  </a>
                ))}
                <details>
                  <summary>How this answer was checked</summary>
                  <ol>
                    {a.answer.trace.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ol>
                  <p>
                    Scope: {config.name}, {day}. Fetched:{" "}
                    {currentFeed?.fetchedAt || "not available"}. No model call.
                  </p>
                </details>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim() && !loading) ask(question);
            }}
          >
            <label htmlFor="matchday-question">Your sports question</label>
            <div>
              <input
                ref={requestRef}
                id="matchday-question"
                maxLength={400}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={`Ask about ${config.name}…`}
              />
              <button disabled={loading || !question.trim()} type="submit">
                Ask ↗
              </button>
            </div>
          </form>
          {answers.length > 0 && (
            <button className="matchday-clear" onClick={() => setAnswers([])}>
              Clear this discussion
            </button>
          )}
        </section>
        <section
          className="matchday-watchlist"
          aria-labelledby="watchlist-title"
        >
          <p className="matchday-eyebrow">YOUR SIDE OF THE GAME</p>
          <h2 id="watchlist-title">Keep an eye on it.</h2>
          <p>
            Saved on this browser only. Keep up to 30 games without creating an
            account.
          </p>
          {!saved.length && (
            <p className="matchday-watchlist-empty">
              Tap ☆ on a game to build your watchlist.
            </p>
          )}
          {saved.map((s) => (
            <div className="matchday-saved" key={s.id}>
              <button
                onClick={() => {
                  if (validWindow(s.date)) change(s.league, s.date, s.id);
                  else
                    setNotice(
                      "This saved date is outside the current seven-day feed window. Use its original source link.",
                    );
                }}
              >
                <strong>{s.title}</strong>
                <span>
                  {getLeague(s.league)?.name} · {s.date}
                </span>
              </button>
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Source for saved ${s.title}`}
              >
                ↗
              </a>
              <button
                aria-label={`Remove saved ${s.title}`}
                onClick={() => setSaved((x) => x.filter((v) => v.id !== s.id))}
              >
                ×
              </button>
            </div>
          ))}
          {saved.length > 0 && (
            <button
              className="matchday-clear"
              onClick={() => {
                setSaved([]);
                setNotice("Watchlist cleared from this browser.");
              }}
            >
              Clear watchlist
            </button>
          )}
          <p className="matchday-small">
            No cloud sync, background alerts or permanent-retention promise.
            Browser storage can be cleared.
          </p>
        </section>
      </div>
      <section
        id="spotlights"
        className="matchday-spotlights"
        aria-labelledby="spotlights-title"
      >
        <div className="matchday-section-heading">
          <div>
            <p className="matchday-eyebrow">03 / SIGNATURE PLAYS</p>
            <h2 id="spotlights-title">Some things are worth a replay.</h2>
          </div>
          <span>Official publishers. Timeless moments.</span>
        </div>
        <div className="matchday-media-grid">
          {SPOTLIGHTS.map((s, i) => (
            <article
              className="matchday-media-card"
              key={s.id}
              style={{ "--spotlight": s.color } as React.CSSProperties}
            >
              <div className="matchday-media-art">
                <span>{s.sport}</span>
                <strong aria-hidden="true">0{i + 1}</strong>
                <svg viewBox="0 0 220 100" aria-hidden="true">
                  <path
                    d={
                      i === 0
                        ? "M10 90Q105-40 205 30"
                        : i === 1
                          ? "M10 85L70 65L100 20L140 45L210 5"
                          : i === 2
                            ? "M10 70L80 10L140 90L210 25"
                            : "M10 70Q40 5 90 30T200 10Q230 80 140 80T10 70"
                    }
                  />
                  <circle
                    cx="205"
                    cy={i === 0 ? 30 : i === 1 ? 5 : i === 2 ? 25 : 70}
                    r="6"
                  />
                </svg>
              </div>
              <div>
                <p className="matchday-eyebrow">
                  {s.publisher} / {s.year} ARCHIVE
                </p>
                <h3>{s.athlete}</h3>
                <p>{s.signature}</p>
                <button
                  id={`media-${s.id}`}
                  aria-expanded={media === s.id}
                  onClick={() => setMedia(s.id)}
                >
                  ▷ Load official highlight player
                </button>
                <a
                  href={`https://www.youtube.com/watch?v=${s.video}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch on {s.publisher}’s YouTube ↗
                </a>
              </div>
            </article>
          ))}
        </div>
        {media &&
          (() => {
            const s = SPOTLIGHTS.find((x) => x.id === media)!;
            return (
              <div
                className="matchday-video"
                role="region"
                aria-label="Official highlight player"
              >
                <div>
                  <h3>
                    {s.athlete} · {s.title}
                  </h3>
                  <button
                    onClick={() => {
                      setMedia(null);
                      document.getElementById(`media-${s.id}`)?.focus();
                    }}
                  >
                    Close player ×
                  </button>
                </div>
                <iframe
                  title={`${s.athlete}: ${s.title}`}
                  src={`https://www.youtube-nocookie.com/embed/${s.video}?rel=0`}
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
                <p>
                  {s.note} Playback can be restricted by the publisher or your
                  region.{" "}
                  <a
                    href={`https://www.youtube.com/watch?v=${s.video}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open original video ↗
                  </a>
                </p>
              </div>
            );
          })()}
        <p className="matchday-small">
          Players load only after you click, connecting your browser to YouTube.
          No autoplay, rehosting or video downloads. Official publisher
          archives; availability may change. This independent project is not
          affiliated with the leagues or athletes.
        </p>
      </section>
      <div className="matchday-notice" role="status">
        {notice}
      </div>
      <div className="matchday-to-lab">
        <span>THE SCORE IS ONLY THE BEGINNING.</span>
        <a href="#model-lab">
          Go behind the forecast <b>↘</b>
        </a>
        <p>
          Explore historical models, reproduce a prediction, and see the
          experiments that didn’t win.
        </p>
      </div>
    </section>
  );
}
