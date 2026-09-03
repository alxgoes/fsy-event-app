"use client";

import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * P10 — Success Check Animation (Transitions.dev)
 * Animated check with vector draw and soft spring bob.
 */
export function SuccessCheck({
  size = 28,
  className = "",
  label = "Concluído com sucesso!",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status">
      <div
        className="animate-check-bob relative flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-check-draw w-3/5 h-3/5"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      {label && (
        <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
          {label}
        </span>
      )}
    </div>
  );
}

/**
 * P12 — Input Shake on Error (Transitions.dev)
 * Triggers organic 4-phase horizontal shake when `shakeTrigger` increments.
 */
export function ShakeBox({
  shakeTrigger,
  children,
  className = "",
}: {
  shakeTrigger: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (shakeTrigger > 0) {
      setShaking(true);
      const timer = setTimeout(() => setShaking(false), 290);
      return () => clearTimeout(timer);
    }
  }, [shakeTrigger]);

  return (
    <div className={`${shaking ? "animate-shake" : ""} ${className}`}>
      {children}
    </div>
  );
}

/**
 * P6 — Blur & Translate Enter/Exit (Transitions.dev)
 * Smooth micro-fade for status tags, counters, and notices.
 */
export function BlurFade({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(4px)" }}
      transition={{ duration: 0.18, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
