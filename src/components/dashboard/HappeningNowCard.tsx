"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, MapPin, ArrowRight, CalendarX, Sparkles, Hourglass } from "lucide-react";

interface HappeningNowCardProps {
  isPreEvent?: boolean;
  daysRemaining?: number;
  currentEvent?: {
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    description: string;
    tag?: string;
  };
  nextEvent?: {
    title: string;
    startTime: string;
    location: string;
  };
}

export function HappeningNowCard({
  isPreEvent = false,
  daysRemaining,
  currentEvent,
  nextEvent,
}: HappeningNowCardProps) {
  const shouldReduceMotion = useReducedMotion();

  // Pre-event mode (Before Feb 05, 2027)
  if (isPreEvent) {
    return (
      <motion.div
        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-[#FFD166] p-6 text-slate-900 shadow-brutal-md"
      >
        <div>
          {/* Top Bar: Pre-event Status */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#FFD166] border border-slate-900 shadow-brutal-sm">
              <Hourglass className="h-3.5 w-3.5 text-[#06D6A0] animate-pulse" />
              <span>Em Breve • 05 a 10 Fev 2027</span>
            </div>

            <span className="rounded-xl bg-white/90 px-2.5 py-1 text-[11px] font-black text-slate-900 border border-slate-900/20 shadow-sm flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              {daysRemaining !== undefined && daysRemaining > 0
                ? `Faltam ${daysRemaining} dias`
                : "Quase lá!"}
            </span>
          </div>

          {/* Title */}
          <h2 className="font-heading text-2xl sm:text-3xl font-black leading-tight text-slate-900">
            Contagem Regressiva para o FSY 2027! ⚡
          </h2>

          {/* Description */}
          <p className="mt-3 text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed bg-white/60 p-3.5 rounded-2xl border border-slate-900/10">
            A <strong>Sessão Ribeirão Preto 2</strong> começará na sexta-feira, <strong>05 de Fevereiro de 2027</strong>. Prepare-se para uma semana inesquecível de espiritualidade, novas amizades e muita diversão!
          </p>

          {/* Time & Location Pill Row */}
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-900 border-2 border-slate-900 shadow-sm">
              <Clock className="h-3.5 w-3.5 text-[#007DA5]" />
              <span>Início: 05/02/2027 (Dia Zero)</span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-900 border-2 border-slate-900 shadow-sm">
              <MapPin className="h-3.5 w-3.5 text-[#FC4E6D]" />
              <span>Sessão Ribeirão Preto 2</span>
            </div>
          </div>
        </div>

        {/* Next Up / Opening Activity Banner & Action Button */}
        <div className="mt-5 pt-4 border-t-2 border-slate-900/20 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 bg-white/70 px-3 py-2 rounded-xl border border-slate-900/15">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-black uppercase text-amber-950 bg-amber-300 px-1.5 py-0.5 rounded border border-amber-400">
                1º Dia (06/02)
              </span>
              <span className="truncate font-extrabold text-slate-900">
                Chegada das Caravanas & Abertura Oficial
              </span>
            </div>
          </div>

          <Link href="/schedule" className="block w-full">
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white border-2 border-slate-900 shadow-sm hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
            >
              <span>Ver Programação Completa</span>
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </Link>
        </div>
      </motion.div>
    );
  }

  // Fallback if no current event
  if (!currentEvent) {
    return (
      <motion.div
        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-[#FFD166] p-6 text-slate-900 shadow-brutal-md min-h-[200px]"
      >
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
          <CalendarX className="h-10 w-10 text-slate-700 opacity-60" />
          <div>
            <h3 className="font-heading text-lg font-black text-slate-900">
              Nenhuma atividade agora
            </h3>
            <p className="text-xs font-semibold text-slate-700 mt-1">
              Confira a programação completa para ver os horários da sessão.
            </p>
          </div>
          <Link href="/schedule">
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -1 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white border-2 border-slate-900 shadow-brutal-sm hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <span>Ver Programação</span>
              <ArrowRight className="h-4 w-4" />
            </motion.div>
          </Link>
        </div>
      </motion.div>
    );
  }

  // Live Event Mode
  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-[#FFE48A] p-6 text-slate-900 shadow-lg"
    >
      <div>
        {/* Top Bar: Live Status & Tag */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#FFE48A] border border-slate-900 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#06D6A0] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#06D6A0]"></span>
            </span>
            Acontecendo Agora
          </div>

          {currentEvent.tag && (
            <span className="rounded-xl bg-white/80 px-2.5 py-1 text-xs font-extrabold text-slate-900 border border-slate-900/20">
              {currentEvent.tag}
            </span>
          )}
        </div>

        {/* Event Title */}
        <h2 className="font-heading text-2xl sm:text-3xl font-black leading-tight text-slate-900">
          {currentEvent.title}
        </h2>

        {/* Time & Location Pill Row */}
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-900 border-2 border-slate-900 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-[#007DA5]" />
            <span>{currentEvent.startTime} - {currentEvent.endTime}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-black text-slate-900 border-2 border-slate-900 shadow-sm">
            <MapPin className="h-3.5 w-3.5 text-[#FC4E6D]" />
            <span className="truncate max-w-[180px]">{currentEvent.location}</span>
          </div>
        </div>

        {/* Description */}
        {currentEvent.description && (
          <p className="mt-3 text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed bg-white/50 p-3 rounded-2xl border border-slate-900/10">
            {currentEvent.description}
          </p>
        )}
      </div>

      {/* Next Up Mini-Banner & Action Button */}
      <div className="mt-5 pt-4 border-t-2 border-slate-900/20 space-y-3">
        {nextEvent && (
          <div className="flex items-center justify-between text-xs font-bold text-slate-800 bg-white/60 px-3 py-2 rounded-xl border border-slate-900/15">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-[10px] font-black uppercase text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">A Seguir</span>
              <span className="truncate font-extrabold">{nextEvent.startTime} • {nextEvent.title}</span>
            </div>
          </div>
        )}

        <Link href="/schedule" className="block w-full">
          <motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -1 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white border-2 border-slate-900 shadow-brutal-sm hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span>Ver Programação Completa</span>
            <ArrowRight className="h-4 w-4" />
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
}
