import { NextRequest } from "next/server";
import { createFeedService } from "@/lib/matchday/server";
import seed from "../../../../data/matchday-seed.json";
import type { Feed } from "@/lib/matchday/core";

export const runtime = "nodejs";
export const maxDuration = 30;
const service = createFeedService({ seed: seed.feeds as Feed[] });
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (
    [...params.keys()].some((k) => !["league", "date"].includes(k)) ||
    params.getAll("league").length !== 1 ||
    params.getAll("date").length !== 1
  ) {
    return Response.json(
      { error: "Supply one league and one UTC date." },
      { status: 400 },
    );
  }
  try {
    const feed = await service.load(
      params.get("league") || "",
      params.get("date") || "",
    );
    return Response.json(feed, {
      status: feed.state === "unavailable" ? 503 : 200,
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      {
        error:
          "Choose a supported league and a UTC date within seven days of today.",
      },
      { status: 400 },
    );
  }
}
