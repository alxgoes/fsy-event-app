"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Compass } from "lucide-react";

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
      className="relative overflow-hidden rounded-3xl border-2 border-slate-900 bg-gradient-to-br from-[#4361EE] via-[#3B52E3] to-[#7209B7] p-6 sm:p-8 text-white shadow-brutal-md"
    >
      {/* Playful Background Elements */}
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      <div className="absolute right-10 bottom-6 h-28 w-28 rounded-full bg-[#FFD166]/20 blur-xl pointer-events-none" />
      <div className="absolute top-4 right-6 hidden sm:flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur-md border border-white/20">
        <span className="h-2 w-2 rounded-full bg-[#06D6A0] animate-pulse" />
        <span>Sessão Ribeirão Preto 2</span>
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
        <div>
          {/* Day & Theme Badge */}
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-3 py-1 text-xs sm:text-sm font-black uppercase tracking-wider backdrop-blur-md border border-white/30 text-white mb-3">
            <span className="h-2 w-2 rounded-full bg-[#06D6A0] animate-pulse" />
            {sessionDay}
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Fala aí, {userName}! ⚡
          </h1>
          <p className="mt-2 text-sm sm:text-base text-blue-100 font-medium max-w-xl">
            Viva cada momento desta sessão ao máximo — cada experiência conta!
          </p>
        </div>

        {/* Tactile Youth Badges */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2">
          {/* Company Badge */}
          <motion.div
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-slate-900 border-2 border-slate-900 shadow-brutal-sm cursor-default"
          >
            <ShieldCheck className="h-4 w-4 text-[#4361EE]" />
            <span className="text-xs sm:text-sm font-extrabold">{companyName}</span>
          </motion.div>

          {/* Room Badge — only if room is assigned */}
          {room && (
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 rounded-2xl bg-[#06D6A0] px-3.5 py-2 text-slate-950 border-2 border-slate-900 shadow-brutal-sm cursor-default"
            >
              <Compass className="h-4 w-4 text-slate-950" />
              <span className="text-xs sm:text-sm font-extrabold">{room}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
