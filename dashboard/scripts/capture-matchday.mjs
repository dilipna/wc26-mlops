// Explicit manual snapshot capture. Never scheduled and never run by build/CI.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createFeedService } from "../src/lib/matchday/server.ts";
import { LEAGUES, utcDay, offsetDay } from "../src/lib/matchday/core.ts";
const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const service = createFeedService();
const feeds = [];
for (const league of LEAGUES) {
  for (const day of [offsetDay(utcDay(), -1), utcDay()]) {
    const feed = await service.load(league.key, day);
    if (feed.state === "fresh") feeds.push(feed);
    console.log(league.key, day, feed.state, feed.events.length);
    await new Promise((resolve) => setTimeout(resolve, 3100));
  }
}
if (!feeds.some((f) => f.events.length))
  throw Error("No real events captured; existing seed preserved");
fs.writeFileSync(
  path.join(project, "data/matchday-seed.json"),
  JSON.stringify(
    { schema: 1, capturedAt: new Date().toISOString(), feeds },
    null,
    2,
  ) + "\n",
);
