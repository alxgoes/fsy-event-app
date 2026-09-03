"use client";

import React from "react";
import { motion } from "framer-motion";
import { VoluteLoader } from "./VoluteLoader";
import { FsyTempleMark } from "@/components/brand/FsyLogo";

export interface LoadingScreenProps {
  /** Main title text (default: "Preparando o FSY 2027") */
  title?: string;
  /** Subtitle status message (default: "Sincronizando sua sessão e atividades...") */
  message?: string;
  /** Optional micro caption */
  submessage?: string;
  /** Whether this is a full-screen fixed overlay or relative container (default: true) */
  fullScreen?: boolean;
  /** Speed multiplier for the loader animation */
  rate?: number;
  /** Loader visual variant */
  variant?: "default" | "brand" | "gold" | "white" | "subtle";
  /** Size in pixels of the volute loader (default: 84) */
  loaderSize?: number | string;
  /** Custom extra CSS classes */
  className?: string;
}

export function LoadingScreen({
  title = "Preparando o FSY 2027",
  message = "Sincronizando atividades, comunicados e companhia...",
  submessage = "Verificando dados da sua sessão em tempo real",
  fullScreen = true,
  rate = 1,
  variant = "default",
  loaderSize = 84,
  className = "",
}: LoadingScreenProps) {
  const containerClasses = fullScreen
    ? `fixed inset-0 z-50 flex items-center justify-center p-4 bg-fsy-watermark ${className}`
    : `min-h-[380px] w-full flex items-center justify-center p-4 bg-fsy-watermark ${className}`;

  return (
    <motion.div
      key="fsy-loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{
        opacity: 0,
        scale: 0.98,
        transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
      }}
      transition={{ duration: 0.2 }}
      className={containerClasses}
      role="status"
      aria-live="polite"
    >
      {/* Centered Glassmorphic Card */}
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative flex flex-col items-center max-w-sm w-full p-8 rounded-3xl border-2 border-slate-900/10 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl text-center space-y-5"
      >
        {/* FSY 2027 Header Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFEFE7] dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 shadow-sm">
          <div className="h-4 w-3 shrink-0 flex items-center justify-center">
            <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
          </div>
          <span className="font-heading font-black text-[11px] tracking-wider text-slate-800 dark:text-slate-200 uppercase">
            FSY 2027 • Rejoice in Christ
          </span>
        </div>

        {/* Volute SVG Animation Container */}
        <div className="relative py-2 flex items-center justify-center">
          {/* Subtle glowing halo behind spinner */}
          <div className="absolute inset-0 m-auto h-20 w-20 rounded-full bg-[#007DA5]/10 dark:bg-cyan-400/10 blur-xl pointer-events-none" />
          <VoluteLoader size={loaderSize} rate={rate} variant={variant} />
        </div>

        {/* Informative Text */}
        <div className="space-y-1.5 px-2">
          <h2 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
          {submessage && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {submessage}
            </p>
          )}
        </div>

        {/* Official FSY 2027 Four-Color Pulsing Dots Bar */}
        <div className="flex items-center justify-center gap-2 pt-1" aria-hidden="true">
          <span className="h-2 w-2 rounded-full bg-[#FFE48A] border border-slate-900/40 dark:border-slate-700 animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-[#FC4E6D] border border-slate-900/40 dark:border-slate-700 animate-pulse delay-100" />
          <span className="h-2 w-2 rounded-full bg-[#93C742] border border-slate-900/40 dark:border-slate-700 animate-pulse delay-200" />
          <span className="h-2 w-2 rounded-full bg-[#007DA5] border border-slate-900/40 dark:border-slate-700 animate-pulse delay-300" />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default LoadingScreen;
