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
  letter: string;
  bg: string;
  textColor: string;
  borderColor: string;
  shadowColor: string;
  tilt: number;
  delay: number;
  yDelta: number;
}

const BADGES: LetterBadge[] = [
  {
    letter: "F",
    bg: "bg-[#007DA5] dark:bg-[#01B6D1]",
    textColor: "text-white dark:text-slate-950",
    borderColor: "border-slate-950 dark:border-slate-800",
    shadowColor: "shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]",
    tilt: -4,
    delay: 0,
    yDelta: -3,
  },
  {
    letter: "S",
    bg: "bg-[#FFE48A]",
    textColor: "text-slate-950",
    borderColor: "border-slate-950 dark:border-slate-800",
    shadowColor: "shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]",
    tilt: 2,
    delay: 0.25,
    yDelta: 3,
  },
  {
    letter: "Y",
    bg: "bg-[#FC4E6D]",
    textColor: "text-white",
    borderColor: "border-slate-950 dark:border-slate-800",
    shadowColor: "shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] dark:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.8)]",
    tilt: -2,
    delay: 0.5,
    yDelta: -2.5,
  },
];

const SIZE_MAP = {
  xs: {
    container: "gap-1",
    badge: "h-5 w-5 text-[11px] rounded-full border-[1.5px]",
  },
  sm: {
    container: "gap-1.5",
    badge: "h-7 w-7 text-xs rounded-full border-2",
  },
  md: {
    container: "gap-2",
    badge: "h-9 w-9 text-base rounded-full border-2",
  },
  lg: {
    container: "gap-2.5",
    badge: "h-12 w-12 text-2xl rounded-full border-[2.5px]",
  },
  xl: {
    container: "gap-3",
    badge: "h-16 w-16 text-3xl rounded-full border-[3px]",
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
        "inline-flex items-center select-none font-serif font-black tracking-tight",
        currentSize.container,
        className
      )}
      aria-label="FSY"
    >
      {BADGES.map((b) => {
        const badgeContent = (
          <span
            className={cn(
              "relative flex items-center justify-center font-black transition-transform cursor-default select-none shadow-[2px_2px_0px_#0F172A] dark:shadow-[2px_2px_0px_#000000]",
              currentSize.badge,
              b.bg,
              b.textColor,
              b.borderColor
            )}
            style={{
              fontFamily: "'Georgia', 'Times New Roman', serif",
            }}
          >
            {b.letter}
          </span>
        );

        if (!animated) {
          return (
            <div
              key={b.letter}
              style={{ transform: `rotate(${b.tilt}deg)` }}
              className="shrink-0"
            >
              {badgeContent}
            </div>
          );
        }

        return (
          <motion.div
            key={b.letter}
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
            className="shrink-0"
          >
            {badgeContent}
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
      viewBox="0 0 116 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FSY Floating Circles"
    >
      {/* Circle 1: F (Blue) */}
      <g>
        <circle cx="21" cy="22" r="16" fill="#0F172A" />
        <circle cx="19" cy="19.5" r="16" fill="#007DA5" stroke="#0F172A" strokeWidth="1.8" />
        <text
          x="19"
          y="25.5"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Georgia', 'Times New Roman', serif"
          fontWeight="900"
          fontSize="18"
        >
          F
        </text>
        <path d="M23.5 11 q1 1 2 1 q-1 1 -1 2 q-1 -1 -2 -1 q1 -1 1 -2 z" fill="#FFFFFF" />
      </g>

      {/* Circle 2: S (Yellow) */}
      <g>
        <circle cx="58" cy="22" r="16" fill="#0F172A" />
        <circle cx="56" cy="19.5" r="16" fill="#FFDB65" stroke="#0F172A" strokeWidth="1.8" />
        <text
          x="56"
          y="25.5"
          textAnchor="middle"
          fill="#0F172A"
          fontFamily="'Georgia', 'Times New Roman', serif"
          fontWeight="900"
          fontSize="18"
        >
          S
        </text>
      </g>

      {/* Circle 3: Y (Coral) */}
      <g>
        <circle cx="95" cy="22" r="16" fill="#0F172A" />
        <circle cx="93" cy="19.5" r="16" fill="#FC4E6D" stroke="#0F172A" strokeWidth="1.8" />
        <text
          x="93"
          y="25.5"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="'Georgia', 'Times New Roman', serif"
          fontWeight="900"
          fontSize="18"
        >
          Y
        </text>
      </g>
    </svg>
  );
}
