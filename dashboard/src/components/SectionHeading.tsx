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
      <span className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
        {eyebrow}
      </span>
      <h2 className="font-display mt-3 text-[clamp(28px,5vw,44px)] font-extrabold uppercase leading-[1] text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="font-serif mt-4 max-w-[560px] text-[15px] leading-relaxed text-foreground/55">{subtitle}</p>
      )}
    </motion.div>
  );
}
