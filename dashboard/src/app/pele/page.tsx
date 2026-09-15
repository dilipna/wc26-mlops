import type { Metadata } from "next";
import PelePage from "@/components/pele/PelePage";

// Static route. It takes precedence over the config-driven [sport] route,
// whose generateStaticParams only covers the sports in sports_config.json.
export const metadata: Metadata = {
  title: "Our Model vs Nate Silver's PELE — 2026 World Cup benchmark",
  description:
    "Match-by-match benchmark of our stacked-ensemble World Cup forecasts against Silver Bulletin's PELE pre-kickoff forecasts: proper scoring rules, paired significance tests, and an in-browser statistics lab.",
};

export default function Page() {
  return <PelePage />;
}
