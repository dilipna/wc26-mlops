"use client";

import { motion } from "framer-motion";

/* Stylized player pictograms (thick-stroke, sharp-jointed action poses,
   sports-brand style). Deliberately NOT real player photos: Messi/Ronaldo
   imagery is copyrighted and their likenesses are rights-protected --
   these are evocative original figures: a low-lean sprint-dribbler
   weaving a ball, and an arms-swept-back "SIUUU"-style celebration
   with crowd-roar rings. */

function GroundSpot({ color }: { color: string }) {
  return (
    <ellipse
      cx="150"
      cy="444"
      rx="105"
      ry="14"
      fill={color}
      opacity="0.22"
      style={{ filter: "blur(10px)" }}
    />
  );
}

export function DribblerFigure({ className = "" }: { className?: string }) {
  // Sprint-dribble pose: strong forward lean, head ahead of the hips,
  // arms in opposite phase, trailing leg kicked back, ball at the front foot.
  const pose = (
    <>
      <path d="M132 232 C140 195 155 155 172 122" /> {/* torso, leaning in */}
      <path d="M170 128 L215 158 L205 202" /> {/* front arm, elbow out */}
      <path d="M170 128 L122 164 L92 138" /> {/* back arm, swinging up */}
      <path d="M132 232 L180 306 L198 392" /> {/* driving leg, to the ball */}
      <path d="M132 232 L94 300 L50 330" /> {/* trailing leg, heel up */}
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
          <linearGradient id="fig-emerald" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="470">
            <stop offset="0%" stopColor="#a7f3d0" />
            <stop offset="55%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>

        <GroundSpot color="#34d399" />

        {/* speed lines trailing the run */}
        {[160, 215, 268].map((y, i) => (
          <motion.line
            key={y}
            x1="0"
            x2="70"
            y1={y}
            y2={y}
            stroke="#34d399"
            strokeWidth="3.5"
            strokeLinecap="round"
            animate={{ opacity: [0, 0.55, 0], x: [-14, 26] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.28, ease: "easeOut" }}
          />
        ))}

        {/* soft glow pass under the crisp figure */}
        <g
          stroke="#34d399"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.3"
          style={{ filter: "blur(7px)" }}
        >
          {pose}
        </g>
        <g
          stroke="url(#fig-emerald)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {pose}
        </g>
        <circle cx="186" cy="92" r="24" fill="url(#fig-emerald)" />

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
        <span className="font-display text-sm tracking-[0.4em] text-emerald-300/60">
          THE DRIBBLE
        </span>
      </div>
    </div>
  );
}

export function CelebrationFigure({ className = "" }: { className?: string }) {
  // Landed-celebration pose: chest thrown out, chin up, both arms swept
  // hard down-and-back like wings, legs planted wide.
  const pose = (
    <>
      <path d="M150 216 C166 184 170 146 154 112" /> {/* arched torso, chest out */}
      <path d="M152 118 L98 148 L76 214" /> {/* left arm swept back */}
      <path d="M156 118 L208 148 L228 214" /> {/* right arm swept back */}
      <path d="M150 216 L110 294 L96 392" /> {/* left leg planted wide */}
      <path d="M150 216 L190 294 L206 392" /> {/* right leg planted wide */}
    </>
  );

  return (
    <div className={`relative ${className}`}>
      {/* the chant, rising and fading */}
      <motion.div
        className="font-display absolute -top-10 left-1/2 -translate-x-1/2 text-2xl tracking-[0.35em] text-amber-300/80"
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
          <linearGradient id="fig-gold" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="470">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="55%" stopColor="#f2c94c" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>

        <GroundSpot color="#f2c94c" />

        {/* crowd-roar rings radiating from the chest */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx="152"
            cy="150"
            fill="none"
            stroke="#f2c94c"
            strokeWidth="2"
            animate={{ r: [36, 125], opacity: [0.5, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.72, ease: "easeOut" }}
          />
        ))}

        <g
          stroke="#f2c94c"
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.3"
          style={{ filter: "blur(7px)" }}
        >
          {pose}
        </g>
        <g
          stroke="url(#fig-gold)"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {pose}
        </g>
        {/* head thrown slightly back, chin up */}
        <circle cx="146" cy="80" r="24" fill="url(#fig-gold)" />
      </motion.svg>

      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="font-display text-sm tracking-[0.4em] text-amber-300/60">
          THE CELEBRATION
        </span>
      </div>
    </div>
  );
}
