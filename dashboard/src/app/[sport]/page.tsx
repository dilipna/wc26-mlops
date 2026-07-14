import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import SportPage, { type SportPageData } from "@/components/SportPage";
import { SPORTS } from "@/lib/sports";

// Config-driven sport routes: every active sport in sports_config.json
// whose path isn't "/" gets a statically generated page here, rendered
// from dashboard/data/<sport id>.json. Adding a sport = one config entry
// + one data file; no component or route code changes.
export function generateStaticParams() {
  return SPORTS.filter((s) => s.is_active && s.path !== "/").map((s) => ({
    sport: s.path.replace(/^\//, ""),
  }));
}

export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport: slug } = await params;
  const sport = SPORTS.find((s) => s.path === `/${slug}`);
  if (!sport) notFound();

  const dataPath = path.join(process.cwd(), "data", `${sport.id}.json`);
  if (!fs.existsSync(dataPath)) notFound();
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as SportPageData;

  return <SportPage sport={sport} data={data} />;
}
