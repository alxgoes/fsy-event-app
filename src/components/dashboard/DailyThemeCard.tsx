"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { FsyLogo } from "@/components/brand/FsyLogo";

export function DailyThemeCard() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-[#F5EFCA] dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100 shadow-brutal-md h-full"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#007DA5] px-3 py-1 text-xs font-black uppercase text-white border border-slate-900 shadow-brutal-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Tema FSY 2027
          </div>
          <span className="text-xs font-black text-[#005E7C] dark:text-[#7DE3F4] uppercase tracking-wider font-sans bg-white/70 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-900/15 dark:border-slate-700 shadow-sm">
            Filipenses 4:4
          </span>
        </div>

        {/* Theme Header with Official Typographic Lockup */}
        <motion.div
          whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="my-1 sm:my-2 rounded-2xl bg-white dark:bg-slate-800 p-4 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm"
        >
          <div className="flex items-center gap-3">
            <FsyLogo variant="temple-only" colorMode="four-color" className="h-12 w-auto shrink-0" />
            <div className="flex flex-col">
              <span className="text-xs font-serif tracking-[0.2em] uppercase font-bold text-slate-800 dark:text-slate-200">
                REGOZIJAI-VOS EM
              </span>
              <span className="text-2xl sm:text-3xl font-serif tracking-[0.06em] uppercase font-black text-slate-950 dark:text-white leading-tight">
                CRISTO
              </span>
            </div>
          </div>
          <blockquote className="mt-3 pt-3 border-t-2 border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-serif italic font-medium text-slate-950 dark:text-slate-100 leading-relaxed">
            “Regozijai-vos sempre no Senhor; outra vez digo, regozijai-vos.”
          </blockquote>
        </motion.div>
      </div>
    </motion.div>
  );
}
