"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// Small presentational primitives shared by the /pele sections. They only
// compose the site's existing tokens and utilities (glass-card, font-mono,
// accent, foreground opacities) -- no new visual language.

export const fadeIn = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <motion.div {...fadeIn} id={id} className={`glass-card min-w-0 rounded-2xl p-5 sm:p-6 ${className}`}>
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="font-mono mb-1 text-[10px] uppercase tracking-[0.16em] text-accent">{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-display mb-1 text-lg font-extrabold text-foreground sm:text-xl">{children}</h3>;
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[13px] leading-relaxed text-foreground/55 ${className}`}>{children}</p>;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/40">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={o.disabled}
              onClick={() => onChange(o.value)}
              className={`font-mono rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                active
                  ? "border-accent/60 bg-foreground/5 text-foreground"
                  : "border-foreground/15 text-foreground/55 hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono flex justify-between text-[10px] uppercase tracking-[0.14em] text-foreground/40">
        <span>{label}</span>
        <span className="text-foreground">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </label>
  );
}

export function Stat({ value, label, sub }: { value: ReactNode; label: string; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[clamp(22px,3.4vw,32px)] font-semibold leading-tight text-foreground">{value}</div>
      <div className="mt-1 text-[12px] tracking-[0.04em] text-foreground/50">{label}</div>
      {sub && <div className="font-mono mt-1 text-[11px] text-foreground/40">{sub}</div>}
    </div>
  );
}

export function Dot({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <span className="inline-block h-0 w-3 border-t-2 border-dashed align-middle" style={{ borderColor: color }} />
  ) : (
    <span className="inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
  );
}

export function ChartTooltipBox({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="glass-card rounded-xl px-3 py-2 text-xs text-foreground/80 shadow-lg">
      {title && <div className="font-mono mb-1 uppercase tracking-widest text-foreground/50">{title}</div>}
      {children}
    </div>
  );
}

export function Verdict({ significant, children }: { significant: boolean; children: ReactNode }) {
  return (
    <span
      className={`font-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
        significant ? "border-accent/60 text-foreground" : "border-foreground/20 text-foreground/60"
      }`}
    >
      {children}
    </span>
  );
}
