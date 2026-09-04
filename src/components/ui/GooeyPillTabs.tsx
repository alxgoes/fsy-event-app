"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface GooeyTabItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface GooeyPillTabsProps {
  tabs: (GooeyTabItem | string)[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  variant?: "brand" | "tactile-dark" | "gold";
  size?: "sm" | "md";
}

export function GooeyPillTabs({
  tabs,
  activeTab,
  onChange,
  className = "",
  variant = "brand",
  size = "md",
}: GooeyPillTabsProps) {
  const shouldReduceMotion = useReducedMotion();

  const formattedTabs: GooeyTabItem[] = tabs.map((t) =>
    typeof t === "string" ? { id: t, label: t } : t
  );

  const activePillColors: Record<NonNullable<GooeyPillTabsProps["variant"]>, string> = {
    brand: "bg-[#007DA5] text-white shadow-tactile-pill border-2 border-slate-950 dark:border-slate-700",
    "tactile-dark":
      "bg-[#182030] dark:bg-[#131927] text-white shadow-tactile-pill border-2 border-slate-950 dark:border-slate-700",
    gold: "bg-[#FFE48A] text-slate-950 shadow-tactile-pill border-2 border-slate-900",
  };

  const activePillClass = activePillColors[variant] || activePillColors.brand;
  const paddingClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-xs sm:text-sm";

  return (
    <div
      className={`relative flex items-center gap-1.5 p-1.5 rounded-full bg-slate-100/90 dark:bg-slate-900/90 border-2 border-slate-900/15 dark:border-slate-800 shadow-inner overflow-x-auto scrollbar-none backdrop-blur-sm ${className}`}
      role="tablist"
    >
      {formattedTabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`group relative z-10 inline-flex items-center justify-center gap-2 rounded-full font-black select-none whitespace-nowrap transition-all duration-200 cursor-pointer min-h-[34px] border-2 ${paddingClass} ${
              isActive
                ? "text-white border-transparent"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white hover:border-slate-900/30 dark:hover:border-slate-700 hover:bg-white/80 dark:hover:bg-slate-800 hover:shadow-tactile-pill hover:-translate-y-0.5 active:translate-y-0"
            }`}
          >
            {/* Morphing Liquid Indicator (P13 Fluid Pill Glide) */}
            {isActive && (
              <motion.div
                layoutId="gooeyActiveTabPill"
                className={`absolute inset-0 rounded-full -z-10 ${activePillClass}`}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 420,
                        damping: 26,
                        mass: 0.8,
                      }
                }
              />
            )}

            {/* Optional tab icon */}
            {tab.icon && (
              <span className={`shrink-0 transition-transform ${isActive ? "scale-105" : "opacity-75"}`}>
                {tab.icon}
              </span>
            )}

            {/* Tab title */}
            <span className="relative z-10">{tab.label}</span>

            {/* Tab count badge */}
            {tab.count !== undefined && (
              <span
                className={`ml-1 text-[11px] font-black px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default GooeyPillTabs;
