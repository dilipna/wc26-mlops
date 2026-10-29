// Explicit synthetic UI records. They test interaction contracts, not provider correctness.
export async function stubMatchday(page, overrides = {}) {
  await page.route(/\/api\/matchday\?/, async (route) => {
    const url = new URL(route.request().url()),
      league = url.searchParams.get("league"),
      date = url.searchParams.get("date");
    const duel = (id, home, away, state, homeScore, awayScore) => ({
      id,
      league,
      kind: league === "shield" ? "cricket" : "duel",
      title: `${home} vs ${away}`,
      date,
      startsAt: `${date}T20:00:00Z`,
      venue: "Fixture Arena",
      home,
      away,
      homeScore,
      awayScore,
      state,
      providerStatus:
        state === "finished" ? "FT" : state === "scheduled" ? "NS" : "PST",
      resultText: league === "shield" ? "Fixture South won by 3 wickets" : "",
      podium: [],
      sourceUrl: `https://www.thesportsdb.com/event/${id.slice(5)}`,
    });
    const events =
      league === "f1"
        ? [
            {
              ...duel("jolpica-2026-18", "", "", "finished", null, null),
              kind: "race",
              title: "Fixture Grand Prix",
              podium: [
                { position: 1, name: "Fixture Driver", team: "Fixture Racing" },
              ],
              sourceUrl: "https://api.jolpi.ca/ergast/f1/2026/18/results.json",
            },
          ]
        : [
            duel(
              "tsdb-9999991",
              "Fixture North",
              "Fixture South",
              "finished",
              95,
              101,
            ),
            duel(
              "tsdb-9999992",
              "Fixture East",
              "Fixture West",
              "scheduled",
              null,
              null,
            ),
            duel(
              "tsdb-9999993",
              "Fixture City",
              "Fixture United",
              "postponed",
              null,
              null,
            ),
          ];
    const body = {
      schema: 1,
      league,
      date,
      events,
      fetchedAt: `${date}T10:00:00Z`,
      servedAt: new Date().toISOString(),
      state: "snapshot",
      provider: "Synthetic UI fixture",
      sourceUrls: [],
      coverage: "SYNTHETIC UI TEST FIXTURE — not a real sports result.",
      warning: null,
      ...overrides,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
