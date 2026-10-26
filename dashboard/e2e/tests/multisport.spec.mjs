import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === baseURL
      ? route.continue()
      : route.abort(),
  );
});
for (const sport of ["basketball", "nfl", "cricket"])
  for (const width of [1440, 768, 360])
    test(`${sport}: dated matchup, replay and receipt at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/" + sport);
      await expect(
        page.getByRole("button", {
          name: "Download prediction receipt",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("No live feed or paid API", { exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .getByLabel("Side A", { exact: true })
        .selectOption({ index: 0 });
      await page
        .getByLabel("Side B", { exact: true })
        .selectOption({ index: 0 });
      await expect(page.getByRole("alert")).toContainText(
        "Choose two different sides",
      );
      await page
        .getByLabel("Side B", { exact: true })
        .selectOption({ index: 1 });
      const waiting = page.waitForEvent("download");
      await page
        .getByRole("button", {
          name: "Download prediction receipt",
          exact: true,
        })
        .click();
      const file = await waiting;
      const target = info.outputPath(`${sport}-${width}-receipt.json`);
      await file.saveAs(target);
      const receipt = JSON.parse(await fs.readFile(target, "utf8"));
      expect(receipt.sport).toBe(sport);
      expect(receipt.side_a).not.toBe(receipt.side_b);
      expect(receipt.probability_a + receipt.probability_b).toBeCloseTo(1, 12);
      expect(receipt.probability_a).toBeCloseTo(
        1 /
          (1 +
            10 **
              ((receipt.rating_b - receipt.rating_a - receipt.home_advantage) /
                receipt.parameters.scale)),
        12,
      );
      await page
        .getByRole("button", { name: "Reveal archived result", exact: true })
        .click();
      await expect(page.getByText(/^Winner: /)).toBeVisible();
      await page.locator(".replay-match summary").click();
      await expect(page.locator(".replay-hash").first()).toContainText(
        "Pre-date state",
      );
      await page
        .getByLabel("Archived evaluation match", { exact: true })
        .focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByText(/^Winner: /)).toHaveCount(0);
      if (sport === "cricket")
        await expect(page.locator(".replay-verdict")).toContainText(
          "constant baseline performed better",
        );
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.screenshot({
        path: info.outputPath(`${sport}-${width}.png`),
        fullPage: true,
      });
    });
test("tampered replay fails closed", async ({ page }) => {
  await page.route("**/replays/basketball.json", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()) + " " });
  });
  await page.goto("/basketball");
  await expect(page.getByRole("alert")).toContainText("integrity check failed");
  await expect(
    page.getByRole("button", {
      name: "Download prediction receipt",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("snapshot retries and keyboard date selection changes exported provenance", async ({
  page,
}) => {
  let tries = 0;
  await page.route("**/replays/nfl.json", (route) =>
    ++tries === 1
      ? route.fulfill({ status: 503, body: "Unavailable" })
      : route.continue(),
  );
  await page.goto("/nfl");
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await page.getByRole("button", { name: "Retry snapshot" }).click();
  await expect(
    page.getByRole("button", {
      name: "Download prediction receipt",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Ratings as-of date", { exact: true }).focus();
  await page.keyboard.press("Home");
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Download prediction receipt", exact: true })
      .click(),
  ]);
  const receipt = JSON.parse(await fs.readFile(await file.path(), "utf8"));
  expect(receipt.as_of).toBe("2010-01-03");
});
for (const route of ["/", "/admin", "/pele", "/nascar", "/engineering"])
  for (const width of [1440, 360])
    test(`${route} archive at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(route);
      expect(response.status()).toBe(200);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      await page.screenshot({
        path: info.outputPath("archive.png"),
        fullPage: true,
      });
    });
test("home exposes real workbenches and no NASCAR live badge", async ({
  page,
}) => {
  await page.goto("/");
  for (const route of ["/basketball", "/nfl", "/cricket"])
    await expect(page.locator(`.platform-card[href="${route}"]`)).toBeVisible();
  await expect(page.locator(".site-nav")).not.toContainText("NASCAR");
  const expected = process.env.SPOPS_EXPECTED_COMMIT;
  if (expected) {
    const r = await page.request.get("/release.json");
    expect(r.status()).toBe(200);
    expect((await r.json()).source_commit).toBe(expected);
  }
});

test("engineering evidence matches the retained rejection and reload receipt", async ({
  page,
}) => {
  await page.goto("/engineering");
  await expect(
    page.getByRole("heading", { name: "A new model must earn its place." }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Rejected: worse on both metrics. The approved artifact remained unchanged.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByText("Inspect the decision and reload identity", { exact: true })
    .click();
  await expect(page.locator("main")).toContainText(
    "bc35e0c855c53043b402401aeccc3d179f98833da3aa523f4fe009b795b44bad",
  );
  const response = await page.request.get("/proof/governance-rehearsal.json");
  const evidence = await response.json();
  expect(evidence.comparison.approved).toBe(false);
  expect(evidence.final_approved_id).toBe(
    evidence.separate_process_reload.model_id,
  );
});
