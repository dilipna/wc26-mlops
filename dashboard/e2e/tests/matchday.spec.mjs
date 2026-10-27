import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { stubMatchday } from "../matchday-fixture.mjs";
const today = () => new Date().toISOString().slice(0, 10);
test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", (r) =>
    new URL(r.request().url()).origin === baseURL ? r.continue() : r.abort(),
  );
  await stubMatchday(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
for (const width of [1440, 768, 360])
  test(`matchday source-backed user journey at ${width}px`, async ({
    page,
  }, info) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Every game. More context." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Inspect Fixture North vs Fixture South",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const chat = page.locator(".matchday-assistant");
    await chat
      .getByRole("button", { name: "Who won this game?", exact: true })
      .click();
    await expect(chat.locator(".matchday-answer").last()).toContainText(
      "Fixture South won 101–95",
    );
    await expect(chat.locator(".matchday-answer a").first()).toHaveAttribute(
      "href",
      "https://www.thesportsdb.com/event/9999991",
    );
    await page
      .getByRole("button", {
        name: "Save Fixture North vs Fixture South",
        exact: true,
      })
      .click();
    await expect(page.locator(".matchday-saved")).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".matchday-saved")).toHaveCount(1);
    await page.getByLabel("Hide results · spoiler protection").check();
    await chat
      .getByRole("button", { name: "Who won this game?", exact: true })
      .click();
    await expect(chat.locator(".matchday-answer").last()).toContainText(
      "Spoiler protection is on",
    );
    expect(
      (await page.locator(".matchday-team-row b").allTextContents()).every(
        (x) => x === "—",
      ),
    ).toBe(true);
    const [brief] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "↓ Download match brief", exact: true })
        .click(),
    ]);
    const note = await fs.readFile(await brief.path(), "utf8");
    expect(note).toContain("Result hidden by spoiler protection");
    expect(note).not.toContain("101–95");
    await page.getByLabel("Hide results · spoiler protection").uncheck();
    await page
      .getByRole("button", { name: "Inspect Fixture East vs Fixture West" })
      .click();
    const [calendar] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByRole("button", { name: "＋ Add to calendar", exact: true })
        .click(),
    ]);
    const ics = await fs.readFile(await calendar.path(), "utf8");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:Fixture East vs Fixture West");
    await calendar.saveAs(info.outputPath("scheduled-match.ics"));
    await brief.saveAs(info.outputPath("spoiler-protected-brief.md"));
    await page.getByRole("button", { name: "Final", exact: true }).click();
    await expect(page.locator(".matchday-match")).toHaveCount(1);
    await page.getByLabel("Find a team or game").fill("not-a-team");
    await expect(page.getByText("No games match that filter.")).toBeVisible();
    await page.getByLabel("Find a team or game").clear();
    await page.locator(".matchday-hero").scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: info.outputPath(`matchday-${width}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
test("all eight competition tabs switch explicit records and race/cricket semantics", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of [
    "Premier League",
    "NFL",
    "MLB",
    "NHL",
    "ATP Tour",
    "Sheffield Shield",
    "Formula 1",
    "NBA",
  ]) {
    await page
      .getByRole("button", { name: `Choose ${name}`, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Choose ${name}`, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: /Inspect Fixture/ }).first(),
    ).toBeVisible();
    if (name === "Formula 1")
      await expect(page.locator(".matchday-result")).toContainText(
        "Fixture Driver won Fixture Grand Prix",
      );
    if (name === "Sheffield Shield")
      await expect(page.locator(".matchday-result")).toContainText(
        "Provider result: Fixture South won by 3 wickets",
      );
  }
});
test("unknown and mismatched-date questions abstain and the discussion can be cleared", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /Inspect Fixture North/ }),
  ).toBeVisible();
  const q = page.getByLabel("Your sports question"),
    chat = page.locator(".matchday-assistant");
  for (const [question, answer] of [
    ["Who won the Lakers game?", "could not match"],
    ["Who won North in 2024?", "date is outside"],
    ["Give me betting odds", "does not predict winners"],
  ]) {
    await q.fill(question);
    await chat.getByRole("button", { name: "Ask ↗", exact: true }).click();
    await expect(chat.locator(".matchday-answer").last()).toContainText(answer);
  }
  await chat.getByRole("button", { name: "Clear this discussion" }).click();
  await expect(chat.locator(".matchday-answer")).toHaveCount(0);
});
test("empty coverage is explicit and retry restores a failed feed", async ({
  page,
}) => {
  await stubMatchday(page, {
    events: [],
    state: "unavailable",
    fetchedAt: null,
    warning: "Fixture feed unavailable",
  });
  await page.goto("/");
  await expect(
    page.getByText("We couldn't reach the scoreboard."),
  ).toBeVisible();
  await stubMatchday(page);
  await page
    .getByRole("button", { name: "↻ Refresh feed", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Inspect Fixture North/ }),
  ).toBeVisible();
});
test("media makes no player request until clicked, closes cleanly and retains publisher link", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "▷ Load official highlight player",
      exact: true,
    })
    .first()
    .click();
  await expect(
    page
      .getByRole("region", { name: "Official highlight player" })
      .locator("iframe"),
  ).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/P5_xgip67ac/);
  await expect(
    page.getByRole("link", { name: "Open original video ↗", exact: true }),
  ).toHaveAttribute("href", "https://www.youtube.com/watch?v=P5_xgip67ac");
  await page.getByRole("button", { name: "Close player ×" }).click();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator("#media-curry")).toBeFocused();
});
test("deep link selects the requested game and saved data is removable", async ({
  page,
}) => {
  await page.goto(`/?league=nfl&date=${today()}&match=tsdb-9999992`);
  await expect(page.locator("#match-detail-title")).toHaveText(
    "Fixture East vs Fixture West",
  );
  await page
    .getByRole("button", {
      name: "Save Fixture East vs Fixture West",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "Remove saved Fixture East vs Fixture West",
      exact: true,
    })
    .click();
  await expect(page.locator(".matchday-saved")).toHaveCount(0);
});
test("API rejects arbitrary league URLs, invalid dates, duplicate parameters and write methods", async ({
  request,
}) => {
  for (const query of [
    "league=https://evil.test&date=" + today(),
    "league=nba&date=2026-02-30",
    "league=nba&league=nfl&date=" + today(),
    "league=nba&date=" + today() + "&url=https://evil.test",
  ])
    expect((await request.get("/api/matchday?" + query)).status()).toBe(400);
  expect((await request.post("/api/matchday")).status()).toBe(405);
});
