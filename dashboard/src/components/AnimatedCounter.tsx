"use client";

import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useTransform } from "framer-motion";

export default function AnimatedCounter({
  value,
  decimals = 1,
  suffix = "%",
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // amount: 0 -- trigger as soon as any part of the element is visible,
  // so a fast/programmatic scroll can't land "just past" a stricter
  // margin and leave the counter stuck showing its pre-animation value.
  const inView = useInView(ref, { once: true, amount: 0 });
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => v.toFixed(decimals));

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [inView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (latest) => {
      if (ref.current) ref.current.textContent = `${latest}${suffix}`;
    });
    return unsubscribe;
  }, [rounded, suffix]);

  // SSR-render the REAL value, not a literal 0 -- if client JS is slow,
  // blocked, or the in-view trigger never fires, the page still shows the
  // true number (the count-up animation overwrites this once it runs).
  // This was the root cause of "the leaderboard shows 0% for all teams":
  // the pre-hydration fallback, not the data pipeline.
  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
