"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LEAGUES } from "@/lib/matchday/core";

export default function Nav() {
  const path = usePathname();
  const models = [
    "/models",
    "/basketball",
    "/nfl",
    "/cricket",
    "/football",
    "/pele",
    "/nascar",
  ].includes(path);
  return (
    <header className="site-nav platform-nav">
      <div className="platform-nav-top">
        <Link href="/" className="platform-brand" aria-label="SpOps home">
          <span className="platform-brand-icon" aria-hidden="true">
            s.
          </span>
          SpOps
          <span className="platform-brand-caption">SPORTS INTELLIGENCE</span>
        </Link>
        <form
          action="/"
          method="get"
          className="platform-search"
          role="search"
          aria-label="Search matchday"
        >
          <select
            name="league"
            aria-label="Competition to search"
            defaultValue="nba"
          >
            {LEAGUES.map((l) => (
              <option key={l.key} value={l.key}>
                {l.name}
              </option>
            ))}
          </select>
          <input
            name="q"
            type="search"
            maxLength={160}
            aria-label="Search matchday games"
            placeholder="Find a team or game"
          />
          <button type="submit" aria-label="Search selected competition">
            Search <span aria-hidden="true">↗</span>
          </button>
        </form>
        <Link href="/?view=saved#watchlist" className="platform-saved-link">
          <span aria-hidden="true">☆</span> Watchlist
        </Link>
      </div>
      <div className="platform-nav-bottom">
        <nav aria-label="Main navigation">
          <Link href="/" aria-current={path === "/" ? "page" : undefined}>
            Matchday
          </Link>
          <Link href="/models" aria-current={models ? "page" : undefined}>
            Model labs
          </Link>
          <Link href="/#spotlights">Highlights</Link>
          <Link
            href="/engineering"
            aria-current={path === "/engineering" ? "page" : undefined}
          >
            Proof & method
          </Link>
        </nav>
        <div className="platform-nav-note">
          <span />
          Independent project · source-backed snapshots
        </div>
      </div>
    </header>
  );
}
