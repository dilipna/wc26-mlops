"use client";

import { motion } from "framer-motion";

/* Filled athletic silhouettes in neon, wearing №10 and №7 jersey cutouts.
   Deliberately NOT real player photos: Messi/Ronaldo imagery is
   copyrighted and their likenesses are rights-protected -- these are
   original figures built to evoke them: the low-lean №10 dribbler
   weaving a ball, and the №7 arms-back power celebration with
   crowd-roar rings. Bodies are tapered thick strokes over a filled
   torso, which reads as a solid silhouette at display size. */

const BG = "#04040a";

function GroundSpot({ color }: { color: string }) {
  return (
    <ellipse
      cx="150"
      cy="446"
      rx="100"
      ry="13"
      fill={color}
      opacity="0.25"
      style={{ filter: "blur(10px)" }}
    />
  );
}

export function DribblerFigure({ className = "" }: { className?: string }) {
  // Sprint-dribble: strong forward lean, arms in opposite phase,
  // trailing leg heel-up, ball working at the front foot.
  const limbs = (
    <>
      {/* front arm: upper + forearm */}
      <path d="M175 138 L217 168" strokeWidth="19" />
      <path d="M217 168 L206 208" strokeWidth="15" />
      {/* back arm */}
      <path d="M160 138 L118 170" strokeWidth="19" />
      <path d="M118 170 L92 144" strokeWidth="15" />
      {/* driving leg: thigh + calf */}
      <path d="M136 238 L186 306" strokeWidth="21" />
      <path d="M186 306 L200 388" strokeWidth="16" />
      {/* trailing leg, heel kicked up */}
      <path d="M130 238 L92 300" strokeWidth="21" />
      <path d="M92 300 L52 328" strokeWidth="16" />
    </>
  );

  return (
    <div className={`relative ${className}`}>
      <motion.svg
        viewBox="0 0 300 470"
        className="h-full w-auto"
        animate={{ y: [0, -9, 0], rotate: [0, -1.2, 0] }}
        transition={{ duration: 2.3, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="fig-cyan" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="470">
            <stop offset="0%" stopColor="#a5f3fc" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#0e7490" />
          </linearGradient>
        </defs>

        <GroundSpot color="#22d3ee" />

        {/* speed lines trailing the run */}
        {[160, 215, 268].map((y, i) => (
          <motion.line
            key={y}
            x1="0"
            x2="70"
            y1={y}
            y2={y}
            stroke="#22d3ee"
            strokeWidth="3.5"
            strokeLinecap="round"
            animate={{ opacity: [0, 0.55, 0], x: [-14, 26] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.28, ease: "easeOut" }}
          />
        ))}

        {/* glow pass */}
        <g
          stroke="#22d3ee"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.35"
          style={{ filter: "blur(8px)" }}
        >
          {limbs}
          <path d="M152 116 L190 134 L150 250 L114 230 Z" fill="#22d3ee" stroke="none" />
        </g>

        {/* crisp figure */}
        <g stroke="url(#fig-cyan)" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {limbs}
        </g>
        {/* torso: leaning filled quad, softened by a thick stroke */}
        <path
          d="M152 116 L190 134 L150 250 L114 230 Z"
          fill="url(#fig-cyan)"
          stroke="url(#fig-cyan)"
          strokeWidth="12"
          strokeLinejoin="round"
        />
        {/* neck + head, ahead of the shoulders */}
        <path d="M176 118 L184 100" stroke="url(#fig-cyan)" strokeWidth="14" strokeLinecap="round" />
        <circle cx="190" cy="86" r="22" fill="url(#fig-cyan)" />

        {/* jersey number 10, cut out of the torso */}
        <text
          x="150"
          y="192"
          fill={BG}
          fontSize="34"
          fontWeight="800"
          fontFamily="var(--font-orbitron), sans-serif"
          textAnchor="middle"
          transform="rotate(14 150 185)"
        >
          10
        </text>

        {/* the ball, working at the front foot */}
        <motion.g
          animate={{ x: [-14, 10, -14], rotate: [0, 170, 360] }}
          transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "212px 424px" }}
        >
          <circle cx="212" cy="424" r="15" fill="#f8fafc" opacity="0.95" />
          <path d="M212 415 l7 5 -2.5 8.5 h-9 l-2.5 -8.5 z" fill="#0f172a" opacity="0.85" />
        </motion.g>
      </motion.svg>

      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="font-display text-xs tracking-[0.4em] text-cyan-300/70">
          THE №10
        </span>
      </div>
    </div>
  );
}

export function CelebrationFigure({ className = "" }: { className?: string }) {
  // Landed power celebration: chest out, chin up, arms swept hard
  // down-and-back, legs planted wide.
  const limbs = (
    <>
      {/* arms swept back like wings: upper + forearm each side */}
      <path d="M136 124 L90 144" strokeWidth="19" />
      <path d="M90 144 L58 194" strokeWidth="15" />
      <path d="M168 122 L214 142" strokeWidth="19" />
      <path d="M214 142 L246 192" strokeWidth="15" />
      {/* legs planted wide: thigh + calf each side */}
      <path d="M140 228 L108 298" strokeWidth="21" />
      <path d="M108 298 L96 390" strokeWidth="16" />
      <path d="M162 228 L192 298" strokeWidth="21" />
      <path d="M192 298 L206 390" strokeWidth="16" />
    </>
  );

  return (
    <div className={`relative ${className}`}>
      {/* the chant, rising and fading */}
      <motion.div
        className="font-display absolute -top-10 left-1/2 -translate-x-1/2 text-xl tracking-[0.35em] text-pink-400/90"
        animate={{ y: [10, -22], opacity: [0, 1, 0], scale: [0.92, 1.12] }}
        transition={{ duration: 2.3, repeat: Infinity, ease: "easeOut" }}
      >
        SIUUU
      </motion.div>

      <motion.svg
        viewBox="0 0 300 470"
        className="h-full w-auto"
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", times: [0, 0.35, 1] }}
      >
        <defs>
          <linearGradient id="fig-pink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="470">
            <stop offset="0%" stopColor="#fbcfe8" />
            <stop offset="55%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#9d174d" />
          </linearGradient>
        </defs>

        <GroundSpot color="#f472b6" />

        {/* crowd-roar rings radiating from the chest */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="152"
            cy="152"
            fill="none"
            stroke="#f472b6"
            strokeWidth="2"
            animate={{ r: [36, 125], opacity: [0.5, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.72, ease: "easeOut" }}
          />
        ))}

        {/* glow pass */}
        <g
          stroke="#f472b6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.35"
          style={{ filter: "blur(8px)" }}
        >
          {limbs}
          <path d="M130 116 L172 112 L166 240 L138 240 Z" fill="#f472b6" stroke="none" />
        </g>

        {/* crisp figure */}
        <g stroke="url(#fig-pink)" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {limbs}
        </g>
        {/* chest-out torso */}
        <path
          d="M130 116 L172 112 L166 240 L138 240 Z"
          fill="url(#fig-pink)"
          stroke="url(#fig-pink)"
          strokeWidth="12"
          strokeLinejoin="round"
        />
        {/* neck + head, chin up */}
        <path d="M150 116 L148 100" stroke="url(#fig-pink)" strokeWidth="14" strokeLinecap="round" />
        <circle cx="147" cy="84" r="22" fill="url(#fig-pink)" />

        {/* jersey number 7, cut out of the torso */}
        <text
          x="151"
          y="190"
          fill={BG}
          fontSize="36"
          fontWeight="800"
          fontFamily="var(--font-orbitron), sans-serif"
          textAnchor="middle"
          transform="rotate(-3 151 183)"
        >
          7
        </text>
      </motion.svg>

      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="font-display text-xs tracking-[0.4em] text-pink-400/70">
          THE №7
        </span>
      </div>
    </div>
  );
}
