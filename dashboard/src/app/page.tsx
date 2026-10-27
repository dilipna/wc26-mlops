import MatchdayHub from "@/components/MatchdayHub";
import PlatformIntro from "@/components/PlatformIntro";
import Footer from "@/components/Footer";
import seed from "../../data/matchday-seed.json";
import type { Feed } from "@/lib/matchday/core";
export default function Home() {
  return (
    <main>
      <MatchdayHub
        initialFeeds={seed.feeds as Feed[]}
        initialDay={seed.capturedAt?.slice(0, 10) || "2026-10-26"}
      />
      <div id="model-lab">
        <PlatformIntro />
      </div>
      <Footer />
    </main>
  );
}
