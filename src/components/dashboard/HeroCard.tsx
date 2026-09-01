"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Compass } from "lucide-react";
import { YellowCapsuleSticker } from "@/components/brand/FsyStickers";

interface HeroCardProps {
  userName?: string;
  companyName?: string;
  sessionDay?: string;
  room?: string | null;
}

export function HeroCard({
  userName = "Bem-vindo",
  companyName = "Aguardando designação",
  sessionDay = "FSY 2027",
  room = null,
}: HeroCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative overflow-hidden rounded-3xl border-2 border-slate-900 bg-gradient-to-br from-[#007DA5] via-[#01B6D1] to-[#005E7C] p-6 sm:p-8 text-white shadow-brutal-md"
    >
      {/* Playful Background Elements */}
      <div className="absolute -right-8 -top-8 h-44 w-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute right-12 bottom-4 h-32 w-32 rounded-full bg-[#FFE48A]/25 blur-xl pointer-events-none" />
      
      <div className="absolute top-4 right-6 hidden sm:flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-md border border-white/25 text-white">
          <span className="h-2 w-2 rounded-full bg-[#93C742] animate-pulse" />
          <span>Sessão Ribeirão Preto 2</span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
        <div>
          {/* Day & Theme Badge */}
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-3 py-1 text-xs sm:text-sm font-black uppercase tracking-wider backdrop-blur-md border border-white/30 text-white mb-3">
            <span className="h-2 w-2 rounded-full bg-[#93C742] animate-pulse" />
            {sessionDay}
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Fala aí, {userName}! ⚡
          </h1>
          <p className="mt-2 text-sm sm:text-base text-cyan-50 font-medium max-w-xl">
            Viva cada momento desta sessão ao máximo — regozijai-vos em cada experiência!
          </p>
        </div>

        {/* Tactile Youth Badges */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          {/* Company Badge */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-slate-900 border-2 border-slate-900 shadow-brutal-sm cursor-default"
          >
            <ShieldCheck className="h-4 w-4 text-[#007DA5]" />
            <span className="text-xs sm:text-sm font-extrabold">{companyName}</span>
          </motion.div>

          {/* Room Badge — only if room is assigned */}
          {room && (
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 rounded-2xl bg-[#FFE48A] px-3.5 py-2 text-slate-950 border-2 border-slate-900 shadow-brutal-sm cursor-default"
            >
              <Compass className="h-4 w-4 text-slate-950" />
              <span className="text-xs sm:text-sm font-extrabold">{room}</span>
            </motion.div>
          )}

          {/* Youth Theme Sticker Badge */}
          <div className="hidden md:inline-flex ml-auto">
            <YellowCapsuleSticker size="sm" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
