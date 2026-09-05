"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FsyFloatingLettersProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
}

interface LetterBadge {
  id: "F" | "S" | "Y";
  tilt: number;
  delay: number;
  yDelta: number;
  renderSvg: () => React.ReactNode;
}

const BADGES: LetterBadge[] = [
  {
    id: "F",
    tilt: -4,
    delay: 0,
    yDelta: -3.5,
    renderSvg: () => (
      <svg viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full overflow-visible">
        {/* Hard 3D Drop Shadow */}
        <circle cx="28" cy="29" r="22" fill="#0F172A" />
        {/* Main Cyan Circle */}
        <circle cx="25" cy="25" r="22" fill="#007DA5" stroke="#0F172A" strokeWidth="2.2" />
        {/* Slab-Serif Letter F */}
        <path
          d="M16.5 13 h14.5 v4.2 h-3.8 v4.5 h3 v3.8 h-3 v8 h3.8 v4.2 h-10.7 v-4.2 h3.8 v-16.3 h-3.8 z"
          fill="#FFFFFF"
        />
        {/* Sparkle Star on F */}
        <path
          d="M31.2 12.5 q1.6 1.6 3.2 1.6 q-1.6 1.6 -1.6 3.2 q-1.6 -1.6 -3.2 -1.6 q1.6 -1.6 1.6 -3.2 z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
  {
    id: "S",
    tilt: 2,
    delay: 0.25,
    yDelta: 3.5,
    renderSvg: () => (
      <svg viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full overflow-visible">
        {/* Hard 3D Drop Shadow */}
        <circle cx="28" cy="29" r="22" fill="#0F172A" />
        {/* Main Sunny Yellow Circle */}
        <circle cx="25" cy="25" r="22" fill="#FFDB65" stroke="#0F172A" strokeWidth="2.2" />
        {/* Serif Letter S */}
        <path
          d="M32 15 c-1.3 -1.4 -3.3 -2.2 -5.6 -2.2 c-3.5 0 -5.6 1.8 -5.6 4.2 c0 2.5 2.2 3.4 5.2 4.2 c3.1 0.9 5.8 2 5.8 5.4 c0 3.6 -3 6 -7.2 6 c-3 0 -5.6 -1 -7 -2.8 l2.2 -2.8 c1.2 1.4 3 2.1 4.8 2.1 c3 0 4.6 -1.5 4.6 -3.3 c0 -2.4 -2 -3.2 -4.8 -4 c-3.2 -0.9 -5.9 -2 -5.9 -5.5 c0 -3.4 2.8 -5.8 6.7 -5.8 c2.7 0 4.9 0.8 6.3 2.3 z"
          fill="#0F172A"
        />
      </svg>
    ),
  },
  {
    id: "Y",
    tilt: -2,
    delay: 0.5,
    yDelta: -3,
    renderSvg: () => (
      <svg viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full overflow-visible">
        {/* Hard 3D Drop Shadow */}
        <circle cx="28" cy="29" r="22" fill="#0F172A" />
        {/* Main Coral Pink Circle */}
        <circle cx="25" cy="25" r="22" fill="#FC4E6D" stroke="#0F172A" strokeWidth="2.2" />
        {/* Slab-Serif Letter Y */}
        <path
          d="M16.5 13 h5.4 l3.8 8.4 l3.8 -8.4 h5.4 v3 h-1.2 l-5.4 10.8 v7.4 h3.2 v3.4 h-9.6 v-3.4 h3.2 v-7.4 l-5.4 -10.8 h-1.2 z"
          fill="#FFFFFF"
        />
      </svg>
    ),
  },
];

const SIZE_MAP = {
  xs: {
    container: "gap-1",
    badge: "h-6 w-6",
  },
  sm: {
    container: "gap-1.5",
    badge: "h-8 w-8",
  },
  md: {
    container: "gap-2",
    badge: "h-11 w-11",
  },
  lg: {
    container: "gap-2.5",
    badge: "h-14 w-14",
  },
  xl: {
    container: "gap-3",
    badge: "h-18 w-18",
  },
};

export function FsyFloatingLetters({
  size = "md",
  animated = true,
  className,
}: FsyFloatingLettersProps) {
  const currentSize = SIZE_MAP[size];

  return (
    <div
      className={cn(
        "inline-flex items-center select-none",
        currentSize.container,
        className
      )}
      aria-label="FSY"
    >
      {BADGES.map((b) => {
        const badgeElement = (
          <div
            className={cn(
              "relative flex items-center justify-center shrink-0 cursor-default select-none",
              currentSize.badge
            )}
          >
            {b.renderSvg()}
          </div>
        );

        if (!animated) {
          return (
            <div
              key={b.id}
              style={{ transform: `rotate(${b.tilt}deg)` }}
              className="shrink-0 py-1"
            >
              {badgeElement}
            </div>
          );
        }

        return (
          <motion.div
            key={b.id}
            initial={{ y: 0, rotate: b.tilt }}
            animate={{
              y: [0, b.yDelta, 0],
              rotate: [b.tilt, b.tilt + (b.tilt > 0 ? -1.5 : 1.5), b.tilt],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
              delay: b.delay,
            }}
            whileHover={{
              scale: 1.15,
              rotate: 0,
              transition: { duration: 0.15 },
            }}
            whileTap={{ scale: 0.95 }}
            className="shrink-0 py-1"
          >
            {badgeElement}
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Static SVG version of the floating letters for favicons or pure vector exports
 */
export function FsyFloatingLettersSvg({
  className = "h-8 w-auto",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none overflow-visible", className)}
      aria-label="Logo Oficial FSY"
    >
      {/* Circle 1: F (Cyan-Blue #007DA5) */}
      <g>
        <circle cx="33" cy="35" r="23" fill="#0F172A" />
        <circle cx="30" cy="31" r="23" fill="#007DA5" stroke="#0F172A" strokeWidth="2.2" />
        <path
          d="M21.5 19 h14.5 v4.2 h-3.8 v4.5 h3 v3.8 h-3 v8 h3.8 v4.2 h-10.7 v-4.2 h3.8 v-16.3 h-3.8 z"
          fill="#FFFFFF"
        />
        <path
          d="M36.2 18.5 q1.6 1.6 3.2 1.6 q-1.6 1.6 -1.6 3.2 q-1.6 -1.6 -3.2 -1.6 q1.6 -1.6 1.6 -3.2 z"
          fill="#FFFFFF"
        />
      </g>

      {/* Circle 2: S (Sunny Yellow #FFDB65) */}
      <g>
        <circle cx="73" cy="35" r="23" fill="#0F172A" />
        <circle cx="70" cy="31" r="23" fill="#FFDB65" stroke="#0F172A" strokeWidth="2.2" />
        <path
          d="M77 21 c-1.3 -1.4 -3.3 -2.2 -5.6 -2.2 c-3.5 0 -5.6 1.8 -5.6 4.2 c0 2.5 2.2 3.4 5.2 4.2 c3.1 0.9 5.8 2 5.8 5.4 c0 3.6 -3 6 -7.2 6 c-3 0 -5.6 -1 -7 -2.8 l2.2 -2.8 c1.2 1.4 3 2.1 4.8 2.1 c3 0 4.6 -1.5 4.6 -3.3 c0 -2.4 -2 -3.2 -4.8 -4 c-3.2 -0.9 -5.9 -2 -5.9 -5.5 c0 -3.4 2.8 -5.8 6.7 -5.8 c2.7 0 4.9 0.8 6.3 2.3 z"
          fill="#0F172A"
        />
      </g>

      {/* Circle 3: Y (Coral Pink #FC4E6D) */}
      <g>
        <circle cx="113" cy="35" r="23" fill="#0F172A" />
        <circle cx="110" cy="31" r="23" fill="#FC4E6D" stroke="#0F172A" strokeWidth="2.2" />
        <path
          d="M101.5 19 h5.4 l3.8 8.4 l3.8 -8.4 h5.4 v3 h-1.2 l-5.4 10.8 v7.4 h3.2 v3.4 h-9.6 v-3.4 h3.2 v-7.4 l-5.4 -10.8 h-1.2 z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}
