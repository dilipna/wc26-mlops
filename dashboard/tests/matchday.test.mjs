import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSportsDB,
  normalizeRace,
  resultSentence,
  answerQuestion,
  calendarEvent,
  matchBrief,
  validDate,
  validWindow,
  offsetDay,
  LEAGUES,
} from "../src/lib/matchday/core.ts";
import { createFeedService } from "../src/lib/matchday/server.ts";
const DAY = "2026-10-26",
  NOW = Date.parse(DAY + "T12:00:00Z");
const raw = {
  idEvent: "101",
  idLeague: "4387",
  dateEvent: DAY,
  strHomeTeam: "North",
  strAwayTeam: "South",
  strTime: "20:00:00",
  strStatus: "FT",
  intHomeScore: "95",
  intAwayScore: "101",
  strVenue: "Test Arena",
};
const event = normalizeSportsDB({ events: [raw] }, "nba", DAY)[0];
const feed = {
  schema: 1,
  league: "nba",
  date: DAY,
  events: [event],
  fetchedAt: DAY + "T10:00:00Z",
  servedAt: DAY + "T10:00:00Z",
  state: "fresh",
  provider: "TheSportsDB",
  sourceUrls: [],
  coverage: "Limited sample",
  warning: null,
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
const ask = (q, events = [event], selected = event, spoilers = false) =>
  answerQuestion(q, events, selected, spoilers, NOW);

test("calendar dates reject rollover, malformed dates and out-of-window queries", () => {
  for (const date of ["2026-02-30", "2026-13-01", "2026-1-01", "hello"])
    assert.equal(validDate(date), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(validWindow("2026-11-02", NOW), true);
  assert.equal(validWindow("2026-11-03", NOW), false);
  assert.equal(offsetDay("2026-12-31", 1), "2027-01-01");
});
test("feed rejects unexpected schema but accepts an explicit empty response", () => {
  assert.throws(() => normalizeSportsDB({}, "nba", DAY));
  assert.deepEqual(normalizeSportsDB({ events: null }, "nba", DAY), []);
});
test("normalization rejects wrong leagues, wrong dates and duplicate IDs", () => {
  const r = normalizeSportsDB(
    {
      events: [
        raw,
        raw,
        { ...raw, idEvent: "102", idLeague: "4391" },
        { ...raw, idEvent: "103", dateEvent: "2026-10-25" },
      ],
    },
    "nba",
    DAY,
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "tsdb-101");
});
test("zero is a score, missing and malformed scores are not zero", () => {
  const get = (v) =>
    normalizeSportsDB({ events: [{ ...raw, intHomeScore: v }] }, "nba", DAY)[0]
      .homeScore;
  assert.equal(get("0"), 0);
  for (const v of [null, "", "-3", "NaN", "12345", "<b>10</b>"])
    assert.equal(get(v), null);
});
test("provider content is text, never executable HTML", () => {
  const e = normalizeSportsDB(
    {
      events: [
        {
          ...raw,
          strHomeTeam: "<script>bad</script> North\n",
          strVenue: "<img src=x> Arena",
        },
      ],
    },
    "nba",
    DAY,
  )[0];
  assert.equal(e.home, "bad North");
  assert.equal(e.venue, "Arena");
  assert.match(e.sourceUrl, /^https:\/\/www.thesportsdb.com\/event\/101$/);
});
test("finished winner uses complete actual scores", () => {
  assert.equal(resultSentence(event), "South won 101–95 against North.");
  assert.match(
    resultSentence({ ...event, homeScore: null }),
    /complete score is not available/,
  );
});
for (const state of [
  "scheduled",
  "in-progress",
  "postponed",
  "cancelled",
  "unknown",
])
  test(`never infer a winner from ${state} scores`, () =>
    assert.doesNotMatch(resultSentence({ ...event, state }), /South won/));
test("football ties and missing shootout winners stay distinct", () => {
  assert.match(
    resultSentence({ ...event, league: "epl", homeScore: 1, awayScore: 1 }),
    /tied/,
  );
  assert.match(
    resultSentence({
      ...event,
      league: "epl",
      providerStatus: "AP",
      homeScore: 1,
      awayScore: 1,
    }),
    /winner is not included/,
  );
  assert.match(
    resultSentence({ ...event, homeScore: 95, awayScore: 95 }),
    /winner is not included/,
  );
});
test("cricket never treats aggregate runs as a match winner", () => {
  assert.match(
    resultSentence({ ...event, kind: "cricket", resultText: "" }),
    /Runs alone cannot determine/,
  );
  assert.equal(
    resultSentence({
      ...event,
      kind: "cricket",
      resultText: "North won by 3 wickets",
    }),
    "Provider result: North won by 3 wickets",
  );
});
const schedule = {
  MRData: {
    RaceTable: {
      Races: [
        {
          season: "2026",
          round: "18",
          raceName: "Test GP",
          date: DAY,
          time: "19:00:00Z",
          Circuit: { circuitName: "Test Circuit" },
        },
      ],
    },
  },
};
const raceResult = {
  MRData: {
    RaceTable: {
      Races: [
        {
          season: "2026",
          round: "18",
          date: DAY,
          Results: [
            {
              position: "1",
              Driver: { givenName: "Alex", familyName: "Driver" },
              Constructor: { name: "Team One" },
            },
          ],
        },
      ],
    },
  },
};
test("race adapter uses classified P1 rather than a duel score", () => {
  const e = normalizeRace(schedule, raceResult, DAY)[0];
  assert.equal(e.kind, "race");
  assert.match(resultSentence(e), /Alex Driver won Test GP for Team One/);
  assert.equal(e.homeScore, null);
});
test("missing, wrong-round and duplicate race classifications cannot produce a winner", () => {
  const empty = normalizeRace(schedule, null, DAY)[0];
  assert.equal(empty.state, "unknown");
  assert.throws(() => normalizeRace(schedule, {}, DAY));
  const bad = structuredClone(raceResult);
  bad.MRData.RaceTable.Races[0].round = "17";
  assert.equal(normalizeRace(schedule, bad, DAY)[0].state, "unknown");
  const dupe = structuredClone(raceResult);
  dupe.MRData.RaceTable.Races[0].Results.push(
    dupe.MRData.RaceTable.Races[0].Results[0],
  );
  assert.throws(() => normalizeRace(schedule, dupe, DAY));
});
test("results answers cite their loaded record and date", () => {
  const a = ask("Who won this game?");
  assert.match(a.text, /South won 101–95/);
  assert.match(a.text, /2026-10-26/);
  assert.equal(a.citations[0].id, event.id);
  assert.equal(a.intent, "result");
});
test("spoilers protect chat as well as result text", () => {
  const a = ask("Who won this game?", [event], event, true);
  assert.equal(a.intent, "spoiler");
  assert.equal(a.citations.length, 0);
  assert.doesNotMatch(a.text, /101/);
});
test("unknown teams and betting/prediction requests abstain", () => {
  assert.equal(ask("Who won the Lakers game?").intent, "unknown");
  assert.equal(ask("Who will win tomorrow?").intent, "prediction");
  assert.equal(ask("Give me betting odds").citations.length, 0);
});
test("ambiguous teams require selecting the intended match", () => {
  const a = ask(
    "Who won North?",
    [event, { ...event, id: "tsdb-102", away: "West" }],
    null,
  );
  assert.equal(a.intent, "clarify");
  assert.doesNotMatch(a.text, /South won/);
});
test("past year, explicit day and relative day cannot reuse another day result", () => {
  for (const q of [
    "Who won North in 2024?",
    "Who won North on 2026-10-25?",
    "Who won North yesterday?",
  ])
    assert.equal(ask(q).intent, "date-mismatch");
});
test("venue and time answers never invent missing fields", () => {
  assert.match(
    ask("Where is this game?", [{ ...event, venue: "" }], {
      ...event,
      venue: "",
    }).text,
    /does not include a venue/,
  );
  assert.match(ask("When does this game start?").text, /20:00:00Z/);
});
test("missing upcoming records do not imply no scheduled games worldwide", () =>
  assert.match(
    ask("What games are today?").text,
    /does not establish that no games are scheduled/,
  ));
test("calendar export rejects unknown starts and finished games", () => {
  assert.throws(() => calendarEvent(event));
  assert.throws(() =>
    calendarEvent({ ...event, state: "scheduled", startsAt: null }),
  );
});
test("calendar file escapes injected fields and folds UTF-8 lines", () => {
  const c = calendarEvent(
    {
      ...event,
      state: "scheduled",
      title: "A, B; C\nBEGIN:VALARM",
      venue: "é".repeat(80),
    },
    new Date(NOW),
  );
  assert.match(c, /SUMMARY:A\\, B\\; C\\nBEGIN:VALARM/);
  assert.equal(c.match(/^BEGIN:VEVENT$/gm).length, 1);
  assert.ok(c.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
  assert.match(c, /DTSTART:20261026T200000Z/);
});
test("match brief respects spoiler protection and includes provenance", () => {
  const s = matchBrief(event, feed, true);
  assert.doesNotMatch(s, /101–95/);
  assert.match(s, /Source: https/);
  assert.match(s, /Fetched at: 2026-10-26/);
});
test("every competition has its own stable provider mapping", () => {
  assert.equal(new Set(LEAGUES.map((l) => l.key)).size, 8);
  assert.equal(LEAGUES.filter((l) => l.provider === "jolpica").length, 1);
});

test("cache coalesces parallel requests and preserves actual fetch time", async () => {
  let calls = 0,
    clock = NOW;
  const service = createFeedService({
    now: () => clock,
    fetcher: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return json({ events: [raw] });
    },
  });
  const [a, b] = await Promise.all([
    service.load("nba", DAY),
    service.load("nba", DAY),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(a, b);
  clock += 60000;
  const c = await service.load("nba", DAY);
  assert.equal(c.state, "cached");
  assert.equal(c.fetchedAt, a.fetchedAt);
  assert.notEqual(c.servedAt, c.fetchedAt);
  assert.equal(calls, 1);
});
test("service bounds input before any upstream request", async () => {
  let calls = 0;
  const s = createFeedService({
    now: () => NOW,
    fetcher: async () => {
      calls++;
      return json({ events: [] });
    },
  });
  for (const [key, date] of [
    ["https://evil.test", DAY],
    ["nba", "2026-11-30"],
    ["nba", "2026-02-30"],
  ])
    await assert.rejects(s.load(key, date));
  assert.equal(calls, 0);
});
test("outage uses explicitly dated fallback, not a new fetch timestamp", async () => {
  const s = createFeedService({
    now: () => NOW,
    seed: [feed],
    fetcher: async () => {
      throw Error("offline");
    },
  });
  const r = await s.load("nba", DAY);
  assert.equal(r.state, "snapshot");
  assert.equal(r.fetchedAt, feed.fetchedAt);
  assert.match(r.warning, /not a fresh score/);
  assert.equal(r.events.length, 1);
});
test("outage without evidence is unavailable, not an empty successful schedule", async () => {
  const r = await createFeedService({
    now: () => NOW,
    fetcher: async () => json({}, 503),
  }).load("nba", DAY);
  assert.equal(r.state, "unavailable");
  assert.equal(r.fetchedAt, null);
});
test("valid null event responses and JSON without content-type remain valid", async () => {
  const s = createFeedService({
    now: () => NOW,
    fetcher: async () => new Response('{"events":null}'),
  });
  const r = await s.load("atp", DAY);
  assert.equal(r.state, "fresh");
  assert.equal(r.events.length, 0);
});
test("oversized, malformed and wrong-schema payloads fail closed", async () => {
  for (const response of [
    new Response("x".repeat(512 * 1024 + 1)),
    new Response("<html>Error</html>"),
    json({ unexpected: [] }),
  ]) {
    const r = await createFeedService({
      now: () => NOW,
      fetcher: async () => response,
    }).load("nba", DAY);
    assert.equal(r.state, "unavailable");
  }
});
test("provider 429 produces no fabricated results", async () => {
  const r = await createFeedService({
    now: () => NOW,
    fetcher: async () => json({}, 429),
  }).load("nba", DAY);
  assert.equal(r.state, "unavailable");
  assert.match(r.warning, /rate limit/);
});
test("expired cache failure retains old snapshot without pretending freshness", async () => {
  let clock = NOW,
    calls = 0;
  const s = createFeedService({
    now: () => clock,
    fetcher: async () =>
      ++calls === 1 ? json({ events: [raw] }) : json({}, 503),
  });
  const a = await s.load("nba", DAY);
  clock += 360000;
  const b = await s.load("nba", DAY);
  assert.equal(b.state, "snapshot");
  assert.equal(b.fetchedAt, a.fetchedAt);
  assert.equal(calls, 2);
});
test("per-instance upstream budget limits fan-out and resets after a minute", async () => {
  let clock = NOW,
    calls = 0;
  const s = createFeedService({
    now: () => clock,
    fetcher: async () => {
      calls++;
      return json({}, 503);
    },
  });
  for (let i = 0; i < 22; i++) await s.load("nba", DAY);
  assert.equal(calls, 20);
  clock += 60001;
  await s.load("nba", DAY);
  assert.equal(calls, 21);
});

test("a nonempty payload of invalid records is an error, not an empty schedule", () => {
  assert.throws(
    () =>
      normalizeSportsDB(
        { events: [{ ...raw, idLeague: "wrong" }] },
        "nba",
        DAY,
      ),
    /validation/,
  );
  assert.throws(
    () =>
      normalizeSportsDB(
        { events: [{ ...raw, idEvent: "9".repeat(100) }] },
        "nba",
        DAY,
      ),
    /validation/,
  );
});

test("between is ordinary match wording, not a betting request", () => {
  const answer = ask("Who won between North and South?");
  assert.equal(answer.intent, "result");
  assert.match(answer.text, /South won 101–95/);
});
test("ordinary final-score phrasing uses the selected record", () => {
  assert.equal(ask("What was the final score?").intent, "result");
});
test("which-games wording uses the bounded schedule intent", () => {
  assert.equal(ask("Which games are today?").intent, "schedule");
});
