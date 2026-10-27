import { test, expect } from "@playwright/test";
import { stubMatchday } from "../matchday-fixture.mjs";
test.beforeEach(async ({ page, baseURL }) => {
  await page.route("**/*", (r) =>
    new URL(r.request().url()).origin === baseURL ? r.continue() : r.abort(),
  );
  await stubMatchday(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
});
for (const width of [1440, 768, 360])
  test(`cohesive product shell and model hub at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/models",
      "/basketball",
      "/football",
      "/engineering",
      "/admin",
    ]) {
      const r = await page.goto(route);
      expect(r.status()).toBe(200);
      await expect(page.locator("header.platform-nav")).toHaveCount(1);
      await expect(page.locator("footer.platform-footer")).toHaveCount(1);
      await expect(
        page.locator("main").getByRole("heading", { level: 1 }),
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole("link", { name: "SpOps home", exact: true }),
      ).toBeVisible();
      // Archived sections must be visible before scrolling or animation observers.
      if (route === "/football") {
        for (const title of ["Who Takes The Trophy?", "Check Your Country", "Tested On Real History", "How It Works"]) {
          const heading = page.getByRole("heading", { name: title, exact: true });
          await expect(heading).toBeVisible();
          expect(await heading.evaluate((el) => {
            for (let node = el; node; node = node.parentElement)
              if (Number(getComputedStyle(node).opacity) < 0.99) return false;
            return true;
          })).toBe(true);
        }
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: info.outputPath(`${route.slice(1) || "home"}-${width}.png`),
        fullPage: true,
      });
    }
  });
test("global competition search navigates to the correct bounded feed", async ({
  page,
}) => {
  await page.goto("/models");
  const nav = page.locator("header.platform-nav");
  await nav.getByLabel("Competition to search").selectOption("nba");
  await nav.getByLabel("Search matchday games").fill("Fixture North");
  await nav
    .getByRole("button", { name: "Search selected competition" })
    .click();
  await expect(page.getByLabel("Find a team or game")).toHaveValue(
    "Fixture North",
  );
  await expect(page.locator(".matchday-match")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.locator(".matchday-match")).toHaveCount(3);
  await expect(page.getByLabel("Find a team or game")).toHaveValue("");
});
test("sorting keeps selected match details within the visible game set", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".matchday-match")).toHaveCount(3);
  await page.getByLabel("Sort games", { exact: true }).selectOption("name");
  await expect(page.locator(".matchday-select-match").first()).toHaveAttribute(
    "aria-label",
    "Inspect Fixture City vs Fixture United",
  );
  await page.getByRole("button", { name: "Final", exact: true }).click();
  await expect(page.locator("#match-detail-title")).toHaveText(
    "Fixture North vs Fixture South",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await expect(page.getByLabel("Sort games", { exact: true })).toHaveValue(
    "source",
  );
});
test("saved-game navigation and model navigation are functional", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: "Save Fixture North vs Fixture South",
      exact: true,
    })
    .click();
  await expect(page.locator(".matchday-saved")).toHaveCount(1);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Model labs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Go beyond the score.", level: 1 }),
  ).toBeVisible();
  await page
    .locator("header.platform-nav")
    .getByRole("link", { name: "Watchlist", exact: false })
    .click();
  await expect(page.locator(".matchday-saved")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Saved here", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
