"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { InstagramFeed } from "@/components/media/InstagramFeed";

function InstagramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function MemoriesCard() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-7 text-slate-900 dark:text-slate-100 shadow-brutal-md"
    >
      <div>
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b-2 border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FD1D1D] via-[#E1306C] to-[#C13584] text-white border-2 border-slate-900 dark:border-slate-700 shadow-sm shrink-0">
              <InstagramIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-[#FC4E6D] flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Instagram Oficial
                </span>
                <span className="rounded-full bg-pink-100 dark:bg-pink-950 px-2.5 py-0.5 text-xs font-black text-[#FC4E6D] border border-pink-200 dark:border-pink-800">
                  #FSYRibeirao2
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                Mural Social da Juventude ✨
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Acompanhe as publicações e curta os melhores momentos!
            </span>
          </div>
        </div>

        {/* Dedicated Instagram Feed Component */}
        <InstagramFeed />
      </div>
    </motion.div>
  );
}

