"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeSports, liveBadge } from "@/lib/sports";

// Sport-level tabs, rendered entirely from sports_config.json: active
// sports show here (with a LIVE/FINAL badge where applicable); sports
// toggled is_active:false vanish from this row and surface in the
// Completed showcase instead. No sport name appears in this component.
export default function SportTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1.5">
      {activeSports().map((sport) => {
        const badge = liveBadge(sport);
        const isCurrent = pathname === sport.path;
        return (
          <Link
            key={sport.id}
            href={sport.path}
            title={sport.name}
            className={`font-mono flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors ${
              isCurrent
                ? "border-accent/60 text-foreground"
                : "border-foreground/15 text-foreground/55 hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {sport.short}
            {badge && (
              <span
                className={`rounded-sm px-1 py-px text-[9px] font-semibold tracking-normal ${
                  badge === "LIVE" ? "text-background" : "text-foreground/70 border border-foreground/25"
                }`}
                style={badge === "LIVE" ? { background: "var(--accent)" } : undefined}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
