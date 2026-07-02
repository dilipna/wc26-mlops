"use client";

import { motion } from "framer-motion";

const BALLS = [
  { top: "12%", left: "8%", size: 34, delay: 0, duration: 7 },
  { top: "68%", left: "88%", size: 46, delay: 1.2, duration: 8.5 },
  { top: "30%", left: "82%", size: 24, delay: 0.6, duration: 6 },
  { top: "78%", left: "14%", size: 30, delay: 2, duration: 9 },
  { top: "50%", left: "50%", size: 20, delay: 1.5, duration: 7.5 },
];

export default function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="pitch-grid" />
      <div
        className="glow-orb bg-emerald-400"
        style={{ width: 500, height: 500, top: "-15%", left: "-10%" }}
      />
      <div
        className="glow-orb bg-sky-400"
        style={{ width: 420, height: 420, top: "10%", right: "-12%" }}
      />
      <div
        className="glow-orb bg-amber-300"
        style={{ width: 320, height: 320, bottom: "-10%", left: "30%", opacity: 0.18 }}
      />

      {BALLS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute select-none"
          style={{ top: b.top, left: b.left, fontSize: b.size, opacity: 0.25 }}
          animate={{ y: [0, -22, 0], rotate: [0, 15, -10, 0] }}
          transition={{
            duration: b.duration,
            delay: b.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          ⚽
        </motion.div>
      ))}
    </div>
  );
}
