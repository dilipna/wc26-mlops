"use client";

import { motion } from "framer-motion";

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mb-10 max-w-2xl"
    >
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-series-1">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-[clamp(22px,3.4vw,32px)] font-bold leading-[1.15] text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-[560px] text-[14px] leading-relaxed text-text-secondary">{subtitle}</p>
      )}
    </motion.div>
  );
}
