import {
  getLeague,
  normalizeRace,
  normalizeSportsDB,
  validWindow,
  type Feed,
  type LeagueKey,
} from "./core.ts";

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export function createFeedService({
  fetcher = fetch,
  now = Date.now,
  seed = [],
}: {
  fetcher?: Fetcher;
  now?: () => number;
  seed?: Feed[];
} = {}) {
  const cache = new Map<string, { feed: Feed; expires: number }>();
  const pending = new Map<string, Promise<Feed>>();
  let windowStart = now(),
    requests = 0;
  async function json(url: string): Promise<unknown> {
    if (now() - windowStart >= 60000) {
      windowStart = now();
      requests = 0;
    }
    if (++requests > 20)
      throw Error("Provider request budget reached; try again later.");
    const options: RequestInit & { next?: { revalidate: number } } = {
      signal: AbortSignal.timeout(8000),
      redirect: "error",
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    };
    const response = await fetcher(url, options);
    if (!response.ok)
      throw Error(
        response.status === 429
          ? "Provider rate limit reached."
          : "Provider could not be reached.",
      );
    const reader = response.body?.getReader();
    if (!reader) throw Error("Empty provider response.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 512 * 1024) {
          await reader.cancel();
          throw Error("Provider response exceeds its size limit.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  async function load(leagueKey: string, date: string): Promise<Feed> {
    const league = getLeague(leagueKey);
    if (!league || !validWindow(date, now()))
      throw Error(
        "Choose a supported league and a UTC date within seven days of today.",
      );
    const key = `${leagueKey}:${date}`,
      servedAt = new Date(now()).toISOString();
    const previous = cache.get(key);
    if (previous && previous.expires > now())
      return { ...previous.feed, servedAt, state: "cached" };
    if (pending.has(key)) return pending.get(key)!;
    const task = (async (): Promise<Feed> => {
      const urls: string[] = [];
      const base: Feed = {
        schema: 1,
        league: leagueKey as LeagueKey,
        date,
        events: [],
        fetchedAt: null,
        servedAt,
        state: "unavailable",
        provider: league.provider === "jolpica" ? "Jolpica-F1" : "TheSportsDB",
        sourceUrls: urls,
        coverage:
          league.provider === "jolpica"
            ? "Race schedules and published classifications. No live lap timing; community updates may be delayed."
            : "Free-tier sample: up to three events per league and UTC date. This is not the complete schedule. Scores may be delayed or corrected.",
        warning: null,
      };
      try {
        if (league.provider === "jolpica") {
          const year = date.slice(0, 4);
          const scheduleUrl = `https://api.jolpi.ca/ergast/f1/${year}.json?limit=100`;
          urls.push(scheduleUrl);
          const schedule = await json(scheduleUrl);
          const scheduled = normalizeRace(schedule, null, date);
          let result: unknown = null;
          if (
            scheduled.length &&
            date <= new Date(now()).toISOString().slice(0, 10)
          ) {
            const round = scheduled[0].id.split("-").at(-1);
            const resultUrl = `https://api.jolpi.ca/ergast/f1/${year}/${round}/results.json?limit=100`;
            urls.push(resultUrl);
            result = await json(resultUrl);
          }
          base.events = normalizeRace(schedule, result, date);
          // A race with no classification is upcoming only when its known start is in the future.
          base.events = base.events.map((e) =>
            e.state === "unknown" &&
            e.startsAt &&
            Date.parse(e.startsAt) > now()
              ? { ...e, state: "scheduled" }
              : e,
          );
        } else {
          const url = `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${date}&l=${league.id}`;
          urls.push(url);
          base.events = normalizeSportsDB(
            await json(url),
            league.key,
            date,
          ).slice(0, 3);
        }
        base.fetchedAt = new Date(now()).toISOString();
        base.servedAt = base.fetchedAt;
        base.state = "fresh";
        if (cache.size >= 128) cache.delete(cache.keys().next().value!);
        cache.set(key, { feed: base, expires: now() + 300000 });
        return base;
      } catch (error) {
        const fallback =
          previous?.feed ||
          seed.find((f) => f.league === leagueKey && f.date === date);
        const warning =
          error instanceof Error ? error.message : "Provider unavailable.";
        if (fallback)
          return {
            ...fallback,
            servedAt: new Date(now()).toISOString(),
            state: "snapshot",
            warning: `${warning} Showing the dated saved snapshot; this is not a fresh score.`,
          };
        return { ...base, servedAt: new Date(now()).toISOString(), warning };
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, task);
    return task;
  }
  return { load };
}
