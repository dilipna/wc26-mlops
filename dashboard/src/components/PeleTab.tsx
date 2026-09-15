"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

// The PELÉ benchmark tab. It is not a sport, so it is deliberately not an
// entry in sports_config.json (which also drives sport routing, the
// completed-sports showcase and a backend script); styling mirrors the sport
// tabs exactly.
//
// Layout contract: adding this tab must not move any existing nav element.
// The original nav is already tight (at several widths the space after the
// last sport tab is ~16px and the Admin button wraps), so an in-flow flex item
// would reflow it. Instead the tab is position:fixed (the nav itself is fixed,
// so these coordinates never change on scroll) and placed by measurement:
//   1. immediately right of the last sport tab, if that spot overlaps no
//      other nav control and fits in the viewport;
//   2. otherwise directly beneath it, right-aligned to the last sport tab.
// It re-measures on resize and once web fonts have loaded.
export const PELE_PATH = "/pele";
const GAP = 6; // matches the sport tabs' gap-1.5

type Rect = { left: number; top: number; right: number; bottom: number };
const intersects = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function fixedAncestor(el: HTMLElement | null): HTMLElement | null {
  for (let e = el?.parentElement ?? null; e; e = e.parentElement) {
    if (getComputedStyle(e).position === "fixed") return e;
  }
  return null;
}

export default function PeleTab() {
  const isCurrent = usePathname() === PELE_PATH;
  const ref = useRef<HTMLAnchorElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", top: 0, left: 0, visibility: "hidden" });

  useLayoutEffect(() => {
    const place = () => {
      const self = ref.current;
      const anchor = self?.previousElementSibling as HTMLElement | null; // the last sport tab
      if (!self || !anchor) return;
      const a = anchor.getBoundingClientRect();
      const w = self.offsetWidth;
      const h = self.offsetHeight;
      const navRoot = fixedAncestor(self);
      const others: Rect[] = navRoot
        ? [...navRoot.querySelectorAll<HTMLElement>("a, button")]
            .filter((el) => el !== self && el.offsetWidth > 0 && el.offsetHeight > 0)
            .map((el) => el.getBoundingClientRect())
        : [];
      const fits = (r: Rect) => r.left >= 0 && r.right <= window.innerWidth - 8 && !others.some((o) => intersects(r, o));

      const inline: Rect = { left: a.right + GAP, top: a.top + (a.height - h) / 2, right: a.right + GAP + w, bottom: a.top + (a.height + h) / 2 };
      const below: Rect = { left: a.right - w, top: a.bottom + GAP, right: a.right, bottom: a.bottom + GAP + h };
      const spot = fits(inline) ? inline : below;
      setStyle({ position: "fixed", top: Math.round(spot.top), left: Math.round(spot.left), visibility: "visible" });
    };

    place();
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => window.removeEventListener("resize", place);
  }, []);

  return (
    <Link
      ref={ref}
      href={PELE_PATH}
      title="Our model vs Nate Silver's PELE"
      style={style}
      className={`font-mono flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors ${
        isCurrent
          ? "border-accent/60 text-foreground"
          : "border-foreground/15 text-foreground/55 hover:border-foreground/40 hover:text-foreground"
      }`}
    >
      Pelé
    </Link>
  );
}
