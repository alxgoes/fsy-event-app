"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Camera, FolderHeart, Sparkles } from "lucide-react";
import { InstagramFeed } from "@/components/media/InstagramFeed";
import { DriveGallery } from "@/components/media/DriveGallery";

function InstagramIcon({ className = "h-4 w-4" }: { className?: string }) {
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
  const [activeTab, setActiveTab] = useState<string>("drive");
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-7 text-slate-900 dark:text-slate-100 shadow-brutal-md"
    >
      <div>
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 pb-5 border-b-2 border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#06D6A0] text-emerald-950 border-2 border-slate-900 dark:border-slate-700 shadow-sm">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Galeria & Redes Oficiais
                </span>
                <span className="rounded-full bg-pink-100 dark:bg-pink-950 px-2.5 py-0.5 text-xs font-black text-[#FC4E6D] border border-pink-200 dark:border-pink-800">
                  #FSYRibeirao2
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                Mural de Memórias ✨
              </h3>
            </div>
          </div>

          {/* Navigation Pill Switcher with Spatial Continuity (layoutId) */}
          <div className="flex items-center">
            <div className="relative grid grid-cols-2 w-full md:w-auto p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-sm gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("drive")}
                className={`relative z-10 flex items-center justify-center gap-2 py-2 px-4 text-xs font-black rounded-xl transition-colors min-h-[36px] ${
                  activeTab === "drive"
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                }`}
              >
                {activeTab === "drive" && (
                  <motion.div
                    layoutId={shouldReduceMotion ? undefined : "memoriesActivePill"}
                    className="absolute inset-0 bg-[#007DA5] rounded-xl shadow-sm border border-slate-900/20 -z-10"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <FolderHeart className="h-4 w-4 relative z-10" />
                <span className="relative z-10">Fotos do Drive</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("instagram")}
                className={`relative z-10 flex items-center justify-center gap-2 py-2 px-4 text-xs font-black rounded-xl transition-colors min-h-[36px] ${
                  activeTab === "instagram"
                    ? "text-white"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white"
                }`}
              >
                {activeTab === "instagram" && (
                  <motion.div
                    layoutId={shouldReduceMotion ? undefined : "memoriesActivePill"}
                    className="absolute inset-0 bg-[#FC4E6D] rounded-xl shadow-sm border border-slate-900/20 -z-10"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <InstagramIcon className="h-4 w-4 relative z-10" />
                <span className="relative z-10">Instagram Oficial</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content with AnimatePresence */}
        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "drive" ? (
            <motion.div
              key="drive"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <DriveGallery />
            </motion.div>
          ) : (
            <motion.div
              key="instagram"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <InstagramFeed />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
