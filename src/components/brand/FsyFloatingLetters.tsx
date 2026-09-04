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
    container: "gap-0.5",
    badge: "h-5 w-5 text-[10px] rounded-md border",
  },
  sm: {
    container: "gap-1",
    badge: "h-6 w-6 text-xs rounded-lg border-[1.5px]",
  },
  md: {
    container: "gap-1.5",
    badge: "h-8 w-8 text-sm rounded-xl border-2",
  },
  lg: {
    container: "gap-2",
    badge: "h-11 w-11 text-xl rounded-2xl border-2",
  },
  xl: {
    container: "gap-2.5",
    badge: "h-16 w-16 text-3xl rounded-3xl border-[3px]",
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
        "inline-flex items-center select-none font-heading font-black tracking-tight",
        currentSize.container,
        className
      )}
      aria-label="FSY"
    >
      {BADGES.map((b) => {
        const badgeContent = (
          <span
            className={cn(
              "flex items-center justify-center font-black transition-transform cursor-default",
              currentSize.badge,
              b.bg,
              b.textColor,
              b.borderColor,
              b.shadowColor
            )}
            style={{
              fontFamily: "var(--font-heading), 'Cinzel', sans-serif",
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
      viewBox="0 0 110 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="FSY Floating Letters"
    >
      {/* Letter F (Blue) */}
      <g transform="translate(4, 4) rotate(-4 16 16)">
        <rect
          x="0"
          y="0"
          width="32"
          height="32"
          rx="9"
          fill="#007DA5"
          stroke="#0F172A"
          strokeWidth="2.2"
        />
        <text
          x="16"
          y="23"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="20"
        >
          F
        </text>
      </g>

      {/* Letter S (Yellow) */}
      <g transform="translate(39, 4) rotate(2 16 16)">
        <rect
          x="0"
          y="0"
          width="32"
          height="32"
          rx="9"
          fill="#FFE48A"
          stroke="#0F172A"
          strokeWidth="2.2"
        />
        <text
          x="16"
          y="23"
          textAnchor="middle"
          fill="#0F172A"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="20"
        >
          S
        </text>
      </g>

      {/* Letter Y (Coral) */}
      <g transform="translate(74, 4) rotate(-2 16 16)">
        <rect
          x="0"
          y="0"
          width="32"
          height="32"
          rx="9"
          fill="#FC4E6D"
          stroke="#0F172A"
          strokeWidth="2.2"
        />
        <text
          x="16"
          y="23"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="20"
        >
          Y
        </text>
      </g>
    </svg>
  );
}
