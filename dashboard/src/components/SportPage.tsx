"use client";

import { motion } from "framer-motion";
import Nav from "./Nav";
import Footer from "./Footer";
import SectionHeading from "./SectionHeading";
import type { SportConfig } from "@/lib/sports";

// Generic sport page renderer -- every section comes from the sport's
// data file (dashboard/data/<sport id>.json) and sports_config.json.
// No sport name is hardcoded here or anywhere in component logic.
export type SportPageData = {
  disclaimer: string;
  notes: string[];
  boards: {
    title: string;
    subtitle?: string;
    rows: { label: string; sublabel?: string; probability: number }[];
  }[];
  comparisons: {
    title: string;
    subtitle?: string;
    rows: { label: string; pick: string; model: number; market: number }[];
  }[];
  methodology: { title: string; body: string };
};

function Board({ board }: { board: SportPageData["boards"][number] }) {
  const max = Math.max(...board.rows.map((r) => r.probability), 0.01);
  return (
    <div className="flex flex-col gap-0.5">
      {board.rows.map((row, i) => (
        <motion.div
          key={row.label}
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-[36px_1fr_auto] items-center gap-4 border-b border-card-border py-[14px] px-3"
        >
          <div className="font-mono text-sm text-foreground/35">0{i + 1}</div>
          <div className="min-w-0">
            <div className="font-display truncate text-lg font-bold text-foreground">
              {row.label}
              {row.sublabel && (
                <span className="font-mono ml-3 text-[11px] font-normal text-foreground/40">{row.sublabel}</span>
              )}
            </div>
            <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${(row.probability / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full"
                style={{ background: i === 0 ? "var(--accent)" : "var(--foreground)" }}
              />
            </div>
          </div>
          <div className={`font-mono text-xl font-semibold ${i === 0 ? "text-accent" : "text-foreground"}`}>
            {(row.probability * 100).toFixed(1)}%
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function Comparison({ comparison }: { comparison: SportPageData["comparisons"][number] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {comparison.rows.map((row, i) => (
        <motion.div
          key={row.label}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: (i % 4) * 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="font-mono mb-3 text-[11px] text-foreground/40">{row.label}</div>
          <div className="font-display mb-4 text-lg font-bold text-foreground">{row.pick}</div>
          <div className="space-y-2.5">
            {[
              { label: "MODEL", value: row.model, color: "var(--accent)" },
              { label: "MARKET", value: row.market, color: "var(--secondary)" },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="font-mono mb-1.5 flex justify-between text-[11px]" style={{ color: bar.color }}>
                  <span>{bar.label}</span>
                  <span>{(bar.value * 100).toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${bar.value * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full"
                    style={{ background: bar.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default function SportPage({ sport, data }: { sport: SportConfig; data: SportPageData }) {
  return (
    <main className="relative">
      <Nav />
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-4 pt-40">
        <h1 className="font-display text-[clamp(32px,6vw,72px)] font-black uppercase leading-[1.05] tracking-tight text-foreground">
          {sport.name.split(" ").slice(0, -1).join(" ")}{" "}
          <span className="italic text-accent">{sport.name.split(" ").slice(-1)}</span>
        </h1>
        {data.notes.map((note) => (
          <div
            key={note}
            className="font-mono mt-6 inline-flex items-center gap-2 rounded-full border border-foreground/20 px-4 py-1.5 text-[11px] uppercase tracking-[0.14em] text-foreground"
            style={{ background: "linear-gradient(180deg, var(--accent-warm), var(--card-alt))" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
              style={{ animation: "wc-pulse 1.8s ease-in-out infinite" }}
            />
            {note}
          </div>
        ))}
        <p className="font-serif mt-6 max-w-2xl text-[15px] leading-relaxed text-foreground/55">{data.disclaimer}</p>
      </section>

      {data.boards.map((board, i) => (
        <section key={board.title} className="relative z-10 mx-auto max-w-6xl px-6 py-12">
          <SectionHeading eyebrow={i === 0 ? "The Board" : "Up Next"} title={board.title} subtitle={board.subtitle} />
          <Board board={board} />
        </section>
      ))}

      {data.comparisons.map((comparison) => (
        <section key={comparison.title} className="relative z-10 mx-auto max-w-6xl px-6 py-12">
          <SectionHeading eyebrow="Model vs Market" title={comparison.title} subtitle={comparison.subtitle} />
          <Comparison comparison={comparison} />
        </section>
      ))}

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <SectionHeading eyebrow="Under the Hood" title={data.methodology.title} />
        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <p className="font-serif max-w-3xl text-[15px] leading-relaxed text-foreground/65">{data.methodology.body}</p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
