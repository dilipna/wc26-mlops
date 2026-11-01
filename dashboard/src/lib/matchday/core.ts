export const LEAGUES = [
  {
    key: "nba",
    name: "NBA",
    sport: "Basketball",
    id: "4387",
    mark: "◉",
    unit: "points",
    provider: "sportsdb",
    color: "#e57342",
  },
  {
    key: "epl",
    name: "Premier League",
    sport: "Football",
    id: "4328",
    mark: "◈",
    unit: "goals",
    provider: "sportsdb",
    color: "#afca67",
  },
  {
    key: "nfl",
    name: "NFL",
    sport: "American football",
    id: "4391",
    mark: "◌",
    unit: "points",
    provider: "sportsdb",
    color: "#dbb675",
  },
  {
    key: "mlb",
    name: "MLB",
    sport: "Baseball",
    id: "4424",
    mark: "⦿",
    unit: "runs",
    provider: "sportsdb",
    color: "#8bb5df",
  },
  {
    key: "nhl",
    name: "NHL",
    sport: "Ice hockey",
    id: "4380",
    mark: "◎",
    unit: "goals",
    provider: "sportsdb",
    color: "#a9c7d0",
  },
  {
    key: "atp",
    name: "ATP Tour",
    sport: "Tennis",
    id: "4464",
    mark: "◍",
    unit: "sets (provider score)",
    provider: "sportsdb",
    color: "#d9d16b",
  },
  {
    key: "shield",
    name: "Sheffield Shield",
    sport: "Cricket",
    id: "5530",
    mark: "◒",
    unit: "provider result",
    provider: "sportsdb",
    color: "#b7b0de",
  },
  {
    key: "f1",
    name: "Formula 1",
    sport: "Motorsport",
    id: "f1",
    mark: "⌁",
    unit: "classification",
    provider: "jolpica",
    color: "#e98989",
  },
] as const;
export type LeagueKey = (typeof LEAGUES)[number]["key"];
export type MatchState =
  | "scheduled"
  | "in-progress"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";
export type Match = {
  id: string;
  league: LeagueKey;
  kind: "duel" | "race" | "cricket";
  title: string;
  date: string;
  startsAt: string | null;
  venue: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  state: MatchState;
  providerStatus: string;
  resultText: string;
  podium: { position: number; name: string; team: string }[];
  sourceUrl: string;
};
export type Feed = {
  schema: 1;
  league: LeagueKey;
  date: string;
  events: Match[];
  fetchedAt: string | null;
  servedAt: string;
  state: "fresh" | "cached" | "snapshot" | "unavailable";
  provider: string;
  sourceUrls: string[];
  coverage: string;
  warning: string | null;
};
export const getLeague = (key: string) => LEAGUES.find((l) => l.key === key);
export const text = (value: unknown, max = 180): string =>
  typeof value === "string"
    ? value
        .replace(/<[^>]*>/g, " ")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";
export function validDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}
export const utcDay = (now = Date.now()) =>
  new Date(now).toISOString().slice(0, 10);
export function offsetDay(day: string, offset: number): string {
  return new Date(Date.parse(day + "T12:00:00Z") + offset * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function validWindow(date: string, now = Date.now()): boolean {
  return (
    validDate(date) &&
    Math.abs(Date.parse(date) - Date.parse(utcDay(now))) <= 7 * 86400000
  );
}
const score = (v: unknown) =>
  typeof v === "string" && /^\d{1,4}$/.test(v)
    ? Number(v)
    : typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 10000
      ? v
      : null;
const asObject = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function normalizeSportsDB(
  raw: unknown,
  key: LeagueKey,
  date: string,
): Match[] {
  const league = getLeague(key);
  if (!league || league.provider !== "sportsdb")
    throw Error("Unsupported league");
  const payload = asObject(raw);
  if (
    !("events" in payload) ||
    (payload.events !== null && !Array.isArray(payload.events))
  )
    throw Error("Unexpected provider schema");
  const seen = new Set<string>();
  const input = (payload.events as unknown[] | null) || [];
  const output = input.slice(0, 100).flatMap((value) => {
    const e = asObject(value);
    if (
      String(e.idLeague) !== league.id ||
      e.dateEvent !== date ||
      !/^\d{1,12}$/.test(String(e.idEvent))
    )
      return [];
    const home = text(e.strHomeTeam),
      away = text(e.strAwayTeam);
    if (!home || !away || seen.has(String(e.idEvent))) return [];
    seen.add(String(e.idEvent));
    const providerStatus = text(e.strStatus, 50);
    const status = providerStatus.toUpperCase();
    const state: MatchState = [
      "FT",
      "AET",
      "AP",
      "MATCH FINISHED",
      "FINISHED",
    ].includes(status)
      ? "finished"
      : ["PST", "POSTPONED"].includes(status)
        ? "postponed"
        : ["CANC", "CANCELLED", "CANCELED"].includes(status)
          ? "cancelled"
          : ["NS", "NOT STARTED"].includes(status)
            ? "scheduled"
            : /^(1H|2H|HT|Q[1-4]|[1-4]Q|OT|IN PLAY|LIVE|IN PROGRESS)$/.test(
                  status,
                )
              ? "in-progress"
              : "unknown";
    const time = text(e.strTime, 8);
    const timestamp = /^\d{2}:\d{2}:\d{2}$/.test(time)
      ? `${date}T${time}Z`
      : "";
    return [
      {
        id: `tsdb-${e.idEvent}`,
        league: key,
        kind: key === "shield" ? "cricket" : "duel",
        title: `${home} vs ${away}`,
        date,
        startsAt:
          timestamp && Number.isFinite(Date.parse(timestamp))
            ? timestamp
            : null,
        venue: text(e.strVenue),
        home,
        away,
        homeScore: score(e.intHomeScore),
        awayScore: score(e.intAwayScore),
        state,
        providerStatus,
        resultText: text(e.strResult, 500),
        podium: [],
        sourceUrl: `https://www.thesportsdb.com/event/${e.idEvent}`,
      } as Match,
    ];
  });
  if (input.length && !output.length)
    throw Error("Provider records failed league/date/identity validation");
  return output;
}
export function normalizeRace(
  schedule: unknown,
  result: unknown,
  date: string,
): Match[] {
  const races = asObject(asObject(schedule).MRData).RaceTable;
  const entries = asObject(races).Races;
  if (!Array.isArray(entries)) throw Error("Unexpected race schedule schema");
  const resultRaces = asObject(
    asObject(asObject(result).MRData).RaceTable,
  ).Races;
  if (result !== null && !Array.isArray(resultRaces))
    throw Error("Unexpected race result schema");
  return entries
    .filter((v) => asObject(v).date === date)
    .slice(0, 4)
    .flatMap((value) => {
      const r = asObject(value),
        season = String(r.season),
        round = String(r.round);
      if (!/^\d{4}$/.test(season) || !/^\d{1,2}$/.test(round)) return [];
      const rr = Array.isArray(resultRaces)
        ? resultRaces.find(
            (v) =>
              String(asObject(v).round) === round &&
              String(asObject(v).season) === season &&
              asObject(v).date === date,
          )
        : null;
      const rows = asObject(rr).Results;
      const podium = Array.isArray(rows)
        ? rows
            .flatMap((value) => {
              const row = asObject(value),
                driver = asObject(row.Driver),
                team = asObject(row.Constructor);
              const position = Number(row.position),
                name = text(
                  `${text(driver.givenName)} ${text(driver.familyName)}`,
                );
              return Number.isInteger(position) &&
                position >= 1 &&
                position <= 3 &&
                name
                ? [{ position, name, team: text(team.name) }]
                : [];
            })
            .sort((a, b) => a.position - b.position)
        : [];
      if (new Set(podium.map((p) => p.position)).size !== podium.length)
        throw Error("Ambiguous race classification");
      const start = `${date}T${text(r.time, 9)}`;
      return [
        {
          id: `jolpica-${season}-${round}`,
          league: "f1",
          kind: "race",
          title: text(r.raceName),
          date,
          startsAt: Number.isFinite(Date.parse(start)) ? start : null,
          venue: text(asObject(r.Circuit).circuitName),
          home: "",
          away: "",
          homeScore: null,
          awayScore: null,
          state: podium.some((p) => p.position === 1) ? "finished" : "unknown",
          providerStatus: podium.length
            ? "Classification returned"
            : "Result not returned",
          resultText: "",
          podium,
          sourceUrl: `https://api.jolpi.ca/ergast/f1/${season}/${round}${podium.some((p) => p.position === 1) ? "/results" : ""}.json`,
        } as Match,
      ];
    });
}
export function resultSentence(event: Match): string {
  if (event.state !== "finished")
    return event.state === "scheduled"
      ? "This game has not finished; no winner is available."
      : `No confirmed winner is available (${event.state.replaceAll("-", " ")}).`;
  if (event.kind === "race") {
    const winner = event.podium.find((p) => p.position === 1);
    return winner
      ? `${winner.name} won ${event.title}${winner.team ? ` for ${winner.team}` : ""}.`
      : "The race winner is not available in this record.";
  }
  if (event.kind === "cricket")
    return event.resultText
      ? `Provider result: ${event.resultText}`
      : "The provider has not supplied a cricket result summary. Runs alone cannot determine this result.";
  const a = event.homeScore,
    b = event.awayScore;
  if (a === null || b === null)
    return "The game is marked finished, but a complete score is not available.";
  if (a === b)
    return ["epl", "nfl"].includes(event.league) &&
      event.providerStatus !== "AP"
      ? `The game finished tied, ${a}–${b}.`
      : "Scores are level; a decisive winner is not included in this record.";
  return `${a > b ? event.home : event.away} won ${Math.max(a, b)}–${Math.min(a, b)} against ${a > b ? event.away : event.home}.`;
}
export type Answer = {
  text: string;
  citations: Match[];
  intent: string;
  trace: string[];
};
export function answerQuestion(
  question: string,
  events: Match[],
  selected: Match | null,
  spoilers: boolean,
  now = Date.now(),
): Answer {
  const q = question.normalize("NFKC").trim().slice(0, 400).toLowerCase();
  const trace = ["Classify request", "Search loaded source records"];
  const response = (
    text: string,
    citations: Match[],
    intent: string,
  ): Answer => ({
    text,
    citations,
    intent,
    trace: [
      ...trace,
      citations.length
        ? "Check status and cite records"
        : "Abstain: insufficient evidence",
    ],
  });
  if (!q)
    return response(
      "Ask about a loaded match, a result, or its start time.",
      [],
      "empty",
    );
  if (
    /\b(?:predict\w*|bet(?:ting|s)?|odds|guarantee\w*)\b|\bwill\b.*\bwin\b/.test(
      q,
    )
  )
    return response(
      "This assistant reports source records; it does not predict winners or recommend bets. The historical Model Lab is separate.",
      [],
      "prediction",
    );
  if (/who.*won|winner|score|result|beat|won.*game/.test(q) && spoilers)
    return response(
      "Spoiler protection is on. Turn it off before asking for a result.",
      [],
      "spoiler",
    );
  const explicitDates: string[] = q.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
  const years: string[] = q.match(/\b(?:19|20)\d{2}\b/g) || [];
  const relativeDay = /\byesterday\b/.test(q)
    ? offsetDay(utcDay(now), -1)
    : /\btomorrow\b/.test(q)
      ? offsetDay(utcDay(now), 1)
      : /\btoday\b/.test(q)
        ? utcDay(now)
        : null;
  if (
    (explicitDates.length &&
      !events.some((e) => explicitDates.includes(e.date))) ||
    (years.length && !events.some((e) => years.includes(e.date.slice(0, 4)))) ||
    (relativeDay && !events.some((e) => e.date === relativeDay))
  )
    return response(
      "That date is outside the loaded records. Change the match date first; I will not answer a past or future question using a different day's result.",
      [],
      "date-mismatch",
    );
  const tokens =
    q
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter(
        (t) =>
          t.length >= 3 &&
          ![
            "what",
            "when",
            "where",
            "which",
            "this",
            "that",
            "game",
            "match",
            "please",
            "tell",
            "about",
            "score",
            "result",
            "winner",
            "won",
            "who",
            "the",
            "did",
            "does",
            "start",
            "play",
            "against",
            "versus",
            "time",
            "was",
            "were",
            "final",
            "between",
            "and",
            "from",
            "with",
            "selected",
            "are",
          ].includes(t),
      ) || [];
  const ranked = events
    .map((e) => ({
      e,
      n: tokens.filter((t) =>
        `${e.title} ${e.home} ${e.away}`.toLowerCase().includes(t),
      ).length,
    }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const targets = ranked.length
    ? ranked.filter((x) => x.n === ranked[0].n).map((x) => x.e)
    : tokens.length
      ? []
      : selected
        ? [selected]
        : [];
  if (
    /(?:what|which).*(today|games)|schedule|upcoming|fixtures/.test(q) &&
    !ranked.length
  ) {
    const upcoming = events.filter((e) => e.state === "scheduled").slice(0, 3);
    return response(
      upcoming.length
        ? upcoming
            .map((e) => `${e.title}: ${e.startsAt || e.date} (UTC).`)
            .join("\n")
        : "No upcoming games are present in the loaded records. This limited feed does not establish that no games are scheduled.",
      upcoming,
      "schedule",
    );
  }
  if (!targets.length)
    return response(
      "I could not match that question to the loaded games. Select a match or switch its league/date. I cannot infer missing results.",
      [],
      "unknown",
    );
  if (targets.length > 1)
    return response(
      "More than one loaded match matches that question. Select the intended game, then ask “Who won this game?”",
      targets.slice(0, 3),
      "clarify",
    );
  const e = targets[0];
  if (/when|start|kick.?off|time/.test(q))
    return response(
      `${e.title}: ${e.startsAt || `${e.date}, time not supplied`} (UTC). Status: ${e.state}.`,
      [e],
      "time",
    );
  if (/where|venue|stadium/.test(q))
    return response(
      e.venue
        ? `${e.title} is listed at ${e.venue}.`
        : "The source does not include a venue for this game.",
      [e],
      "venue",
    );
  if (/who.*won|winner|score|result|beat|won.*game/.test(q))
    return response(
      `${resultSentence(e)} Recorded date: ${e.date}.`,
      [e],
      "result",
    );
  return response(
    "I can answer who won, the score, start time, venue, or which games are loaded. I only use the current league/date records; I do not generate unverified sports commentary.",
    [],
    "unsupported",
  );
}
const escapeICS = (v: string) =>
  v
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function calendarEvent(event: Match, now = new Date()): string {
  if (!event.startsAt || event.state !== "scheduled")
    throw Error(
      "Only a scheduled game with a known start time can be exported",
    );
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SpOps//Matchday//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}@spops.local`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `SUMMARY:${escapeICS(event.title)}`,
    `LOCATION:${escapeICS(event.venue)}`,
    `DESCRIPTION:${escapeICS(`Source: ${event.sourceUrl}. Data: ${event.league === "f1" ? "Jolpica-F1, CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/)" : "TheSportsDB free development API (https://www.thesportsdb.com/docs_terms_of_use.php)"}. Schedule may change. This export does not update automatically.`)}`,
    `URL:${event.sourceUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .join("\r\n")
    .split("\r\n")
    .map((line) => {
      let folded = "",
        length = 0;
      for (const c of line) {
        const size = new TextEncoder().encode(c).length;
        if (length + size > 73) {
          folded += "\r\n ";
          length = 1;
        }
        folded += c;
        length += size;
      }
      return folded;
    })
    .join("\r\n");
}
export function matchBrief(
  event: Match,
  feed: Feed,
  spoilers: boolean,
): string {
  return `# ${event.title}\n\nCompetition: ${getLeague(event.league)?.name}\nDate (UTC): ${event.date}\nStart: ${event.startsAt || "Not supplied"}\nVenue: ${event.venue || "Not supplied"}\nStatus: ${event.state}\n\n${spoilers ? "Result hidden by spoiler protection." : resultSentence(event)}\n\nSource: ${event.sourceUrl}\nFetched at: ${feed.fetchedAt || "Unavailable"}\nFeed state: ${feed.state}\nCoverage: ${feed.coverage}\nData attribution: ${event.league === "f1" ? "Jolpica-F1; CC BY-NC-SA 4.0; https://creativecommons.org/licenses/by-nc-sa/4.0/" : "TheSportsDB; https://www.thesportsdb.com/docs_terms_of_use.php"}\n\nSource results may be delayed or corrected. This is a source-linked note, not a forecast.\n`;
}
