"use client";

import React from "react";
import { motion } from "framer-motion";
import { BookOpen, Music2 } from "lucide-react";

export function DailyThemeCard() {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-[#EEF2FF] p-6 text-slate-900 shadow-brutal-md"
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#4361EE] px-3 py-1 text-xs font-black uppercase text-white border border-slate-900 shadow-brutal-sm">
            <BookOpen className="h-3.5 w-3.5" />
            Tema do FSY 2027
          </div>
          <span className="text-xs font-black text-[#4361EE]">D&C 6:36</span>
        </div>

        <blockquote className="my-2 rounded-2xl bg-white p-3.5 border-2 border-slate-900 shadow-brutal-sm text-xs sm:text-sm font-extrabold italic text-slate-800 leading-relaxed">
          “Olhai para mim em todos os pensamentos; não duvideis, não temais.”
        </blockquote>
      </div>

      {/* Quick Action Pills */}
      <div className="mt-3 pt-2">
        <motion.button
          whileTap={{ scale: 0.97, y: 2 }}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-900 border-2 border-slate-900 shadow-brutal-sm hover:bg-slate-50 transition-colors"
        >
          <Music2 className="h-4 w-4 text-[#FF6B8B]" />
          <span>Hino Oficial do FSY 2027</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
