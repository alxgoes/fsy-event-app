"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Music2 } from "lucide-react";
import { FsyLogo } from "@/components/brand/FsyLogo";

export function DailyThemeCard() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-[#F5EFCA] dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100 shadow-brutal-md"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#007DA5] px-3 py-1 text-xs font-black uppercase text-white border border-slate-900 shadow-brutal-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Tema FSY 2027
          </div>
          <span className="text-xs font-bold text-[#007DA5] dark:text-[#7DE3F4] uppercase tracking-wider font-serif">
            Filipenses 4:4
          </span>
        </div>

        {/* Theme Header with Official Typographic Lockup */}
        <motion.div
          whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="my-2 rounded-2xl bg-white dark:bg-slate-800 p-4 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm"
        >
          <div className="flex items-center gap-3">
            <FsyLogo variant="temple-only" colorMode="four-color" className="h-12 w-auto shrink-0" />
            <div className="flex flex-col">
              <span className="text-[11px] font-serif tracking-[0.2em] uppercase font-light text-slate-600 dark:text-slate-300">
                REGOZIJAI-VOS EM
              </span>
              <span className="text-xl sm:text-2xl font-serif tracking-[0.06em] uppercase font-bold text-slate-900 dark:text-white leading-tight">
                CRISTO
              </span>
            </div>
          </div>
          <blockquote className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700 text-xs sm:text-sm font-serif italic text-slate-800 dark:text-slate-200 leading-relaxed">
            “Regozijai-vos sempre no Senhor; outra vez digo, regozijai-vos.”
          </blockquote>
        </motion.div>
      </div>

      {/* Quick Action Pills */}
      <div className="mt-3 pt-1">
        <motion.button
          whileHover={shouldReduceMotion ? undefined : { y: -1 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-900 dark:text-white border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm hover:bg-[#FFE48A]/40 dark:hover:bg-slate-700 transition-colors"
        >
          <Music2 className="h-4 w-4 text-[#FC4E6D]" />
          <span>Hino e Álbum da Juventude 2027</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
