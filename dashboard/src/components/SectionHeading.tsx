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
      <div className="gold-rule mb-4 w-20" />
      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
        {eyebrow}
      </span>
      <h2 className="font-display mt-3 text-4xl sm:text-5xl leading-none text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base text-white/60 leading-relaxed">{subtitle}</p>
      )}
    </motion.div>
  );
}
