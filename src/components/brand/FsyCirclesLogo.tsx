"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FsyCirclesLogoProps {
  variant?: "badge" | "horizontal" | "app-icon";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  animated?: boolean;
  className?: string;
  showYear?: boolean;
  showSubtitle?: boolean;
}

const SIZE_CONFIG = {
  xs: {
    height: "h-7",
    width: "w-auto",
    svgWidth: 88,
    svgHeight: 34,
    textSize: "text-xs",
    subtextSize: "text-[9px]",
  },
  sm: {
    height: "h-9",
    width: "w-auto",
    svgWidth: 104,
    svgHeight: 40,
    textSize: "text-sm",
    subtextSize: "text-[10px]",
  },
  md: {
    height: "h-11",
    width: "w-auto",
    svgWidth: 128,
    svgHeight: 50,
    textSize: "text-base",
    subtextSize: "text-xs",
  },
  lg: {
    height: "h-14",
    width: "w-auto",
    svgWidth: 160,
    svgHeight: 62,
    textSize: "text-lg",
    subtextSize: "text-xs",
  },
  xl: {
    height: "h-20",
    width: "w-auto",
    svgWidth: 220,
    svgHeight: 85,
    textSize: "text-2xl",
    subtextSize: "text-sm",
  },
};

/**
 * Pure SVG vector representation of the official 3-circles FSY Logo.
 * Features:
 * 1. Deep Cyan-Blue circle (#007DA5) with white serif 'F' + sparkle star
 * 2. Warm Sunny Yellow circle (#FFDB65) with black serif 'S'
 * 3. Coral-Pink circle (#FC4E6D) with white serif 'Y'
 * 4. Crisp solid 3D drop-shadows on each circle
 */
export function FsyCirclesSvg({
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
        {/* Hard 3D Drop Shadow */}
        <circle cx="33" cy="35" r="23" fill="#0F172A" />
        {/* Main Circle */}
        <circle
          cx="30"
          cy="31"
          r="23"
          fill="#007DA5"
          stroke="#0F172A"
          strokeWidth="2.2"
        />
        {/* Slab-Serif Letter F */}
        <path
          d="M21.5 19 h14.5 v4.2 h-3.8 v4.5 h3 v3.8 h-3 v8 h3.8 v4.2 h-10.7 v-4.2 h3.8 v-16.3 h-3.8 z"
          fill="#FFFFFF"
        />
        {/* Sparkle Star on F */}
        <path
          d="M36.2 18.5 q1.6 1.6 3.2 1.6 q-1.6 1.6 -1.6 3.2 q-1.6 -1.6 -3.2 -1.6 q1.6 -1.6 1.6 -3.2 z"
          fill="#FFFFFF"
        />
      </g>

      {/* Circle 2: S (Sunny Yellow #FFDB65) */}
      <g>
        {/* Hard 3D Drop Shadow */}
        <circle cx="73" cy="35" r="23" fill="#0F172A" />
        {/* Main Circle */}
        <circle
          cx="70"
          cy="31"
          r="23"
          fill="#FFDB65"
          stroke="#0F172A"
          strokeWidth="2.2"
        />
        {/* Serif Letter S */}
        <path
          d="M77 21 c-1.3 -1.4 -3.3 -2.2 -5.6 -2.2 c-3.5 0 -5.6 1.8 -5.6 4.2 c0 2.5 2.2 3.4 5.2 4.2 c3.1 0.9 5.8 2 5.8 5.4 c0 3.6 -3 6 -7.2 6 c-3 0 -5.6 -1 -7 -2.8 l2.2 -2.8 c1.2 1.4 3 2.1 4.8 2.1 c3 0 4.6 -1.5 4.6 -3.3 c0 -2.4 -2 -3.2 -4.8 -4 c-3.2 -0.9 -5.9 -2 -5.9 -5.5 c0 -3.4 2.8 -5.8 6.7 -5.8 c2.7 0 4.9 0.8 6.3 2.3 z"
          fill="#0F172A"
        />
      </g>

      {/* Circle 3: Y (Coral Pink #FC4E6D) */}
      <g>
        {/* Hard 3D Drop Shadow */}
        <circle cx="113" cy="35" r="23" fill="#0F172A" />
        {/* Main Circle */}
        <circle
          cx="110"
          cy="31"
          r="23"
          fill="#FC4E6D"
          stroke="#0F172A"
          strokeWidth="2.2"
        />
        {/* Slab-Serif Letter Y */}
        <path
          d="M101.5 19 h5.4 l3.8 8.4 l3.8 -8.4 h5.4 v3 h-1.2 l-5.4 10.8 v7.4 h3.2 v3.4 h-9.6 v-3.4 h3.2 v-7.4 l-5.4 -10.8 h-1.2 z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}

export function FsyCirclesLogo({
  variant = "badge",
  size = "md",
  animated = false,
  className,
  showYear = true,
  showSubtitle = true,
}: FsyCirclesLogoProps) {
  const config = SIZE_CONFIG[size];

  // Base Badge Graphic
  const badgeGraphic = (
    <div className={cn("relative shrink-0", config.height)}>
      <FsyCirclesSvg className={cn(config.height, "w-auto drop-shadow-xs")} />
    </div>
  );

  const wrappedGraphic = animated ? (
    <motion.div
      whileHover={{ scale: 1.05, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {badgeGraphic}
    </motion.div>
  ) : (
    badgeGraphic
  );

  // App Icon Preview (for PWA Modal and App Icon Display)
  if (variant === "app-icon") {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center rounded-3xl bg-[#0B1528] p-3 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-md overflow-hidden",
          className
        )}
      >
        <FsyCirclesSvg className="h-10 sm:h-12 w-auto" />
      </div>
    );
  }

  // Full Horizontal Lockup (Brand Logo + Session Title)
  if (variant === "horizontal") {
    return (
      <div className={cn("inline-flex items-center gap-2.5 min-w-0 select-none", className)}>
        {wrappedGraphic}
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                "font-heading font-black tracking-tight text-slate-900 dark:text-white truncate",
                config.textSize
              )}
            >
              Ribeirão Preto 2
            </span>
            {showYear && (
              <span className="rounded-md bg-[#FFE48A] px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase text-slate-950 border border-slate-900/30 shrink-0">
                2027
              </span>
            )}
          </div>
          {showSubtitle && (
            <p
              className={cn(
                "font-bold text-slate-600 dark:text-slate-400 truncate leading-tight",
                config.subtextSize
              )}
            >
              Portal Oficial FSY
            </p>
          )}
        </div>
      </div>
    );
  }

  // Standalone Badge
  return <div className={cn("inline-flex items-center select-none", className)}>{wrappedGraphic}</div>;
}
