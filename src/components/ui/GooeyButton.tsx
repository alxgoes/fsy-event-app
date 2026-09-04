"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { VoluteLoader } from "./VoluteLoader";

export interface GooeyButtonProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: string;
  variant?: "tactile-dark" | "primary" | "gold" | "coral" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  className?: string;
  type?: "button" | "submit" | "reset";
  ariaLabel?: string;
}

const VARIANT_STYLES: Record<NonNullable<GooeyButtonProps["variant"]>, string> = {
  // Exact user screenshot style: Dark capsule with high contrast border & hard tactile shadow
  "tactile-dark":
    "bg-[#182030] dark:bg-[#131927] text-white border-2 border-slate-950 dark:border-slate-700 shadow-tactile-pill hover:bg-[#222c42] dark:hover:bg-[#1c2438]",
  primary:
    "bg-[#007DA5] text-white border-2 border-slate-950 dark:border-slate-700 shadow-tactile-pill hover:bg-[#006a8c]",
  gold:
    "bg-[#FFE48A] text-slate-950 border-2 border-slate-900 shadow-tactile-pill hover:bg-[#fedd74]",
  coral:
    "bg-[#FC4E6D] text-white border-2 border-slate-950 dark:border-slate-700 shadow-tactile-pill hover:bg-[#e63c5b]",
  outline:
    "bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-slate-700 shadow-tactile-pill hover:bg-slate-100 dark:hover:bg-slate-700",
  ghost:
    "bg-transparent text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-transparent",
};

const SIZE_STYLES: Record<NonNullable<GooeyButtonProps["size"]>, string> = {
  sm: "px-3.5 py-1.5 text-xs min-h-[34px]",
  md: "px-5 py-2 text-xs sm:text-sm min-h-[40px]",
  lg: "px-6 py-2.5 text-sm sm:text-base min-h-[46px]",
};

export function GooeyButton({
  children,
  icon,
  iconColor = "text-[#FC4E6D]",
  variant = "tactile-dark",
  size = "md",
  onClick,
  disabled = false,
  loading = false,
  href,
  target,
  rel,
  className = "",
  type = "button",
  ariaLabel,
}: GooeyButtonProps) {
  const shouldReduceMotion = useReducedMotion();

  const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES["tactile-dark"];
  const sizeClass = SIZE_STYLES[size] || SIZE_STYLES.md;

  const content = (
    <>
      {/* Liquid droplet glow effect on hover */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
      />

      {/* Leading Icon (e.g. pink music note from user screenshot) */}
      {loading ? (
        <VoluteLoader size={18} variant="white" className="shrink-0" />
      ) : icon ? (
        <span
          className={`shrink-0 flex items-center justify-center transition-transform group-hover:scale-110 ${iconColor}`}
        >
          {icon}
        </span>
      ) : null}

      {/* Button Label */}
      <span className="truncate tracking-tight font-black select-none">
        {children}
      </span>
    </>
  );

  const baseClasses = `group relative inline-flex items-center justify-center gap-2.5 rounded-full font-black transition-colors cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none ${variantClass} ${sizeClass} ${className}`;

  if (href) {
    return (
      <motion.div
        whileHover={shouldReduceMotion ? undefined : { scale: 1.025, y: -1 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.96, y: 1 }}
        transition={{ type: "spring", stiffness: 450, damping: 22 }}
        className="inline-block"
      >
        <Link
          href={href}
          target={target}
          rel={rel}
          className={baseClasses}
          aria-label={ariaLabel}
          onClick={onClick}
        >
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={shouldReduceMotion || disabled ? undefined : { scale: 1.025, y: -1 }}
      whileTap={shouldReduceMotion || disabled ? undefined : { scale: 0.96, y: 1 }}
      transition={{ type: "spring", stiffness: 450, damping: 22 }}
      className={baseClasses}
      aria-label={ariaLabel}
    >
      {content}
    </motion.button>
  );
}

export default GooeyButton;
