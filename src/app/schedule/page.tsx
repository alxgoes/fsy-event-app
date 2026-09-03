"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, MapPin, Sparkles, Calendar } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { OFFICIAL_FSY_SCHEDULE } from "@/data/officialSchedule";
import { createClient } from "@/lib/supabase/client";
import { VoluteLoader } from "@/components/ui/VoluteLoader";
import { useProfile } from "@/lib/supabase/useProfile";

interface DbScheduleItem {
  id: string;
  day: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  location: string;
  description: string | null;
  category: string;
  is_highlight: boolean;
}

export default function SchedulePage() {
  const { profile } = useProfile();
  const isStaff = Boolean(
    profile &&
    ["admin", "coordenacao", "consultor", "assistente_coordenacao", "midia", "saude", "seguranca"].includes(profile.role)
  );

  // Day zero is staff & counselor preparation only. Youth and general public only see Day 01 (arrival) to Day 05.
  const dayKeys = isStaff
    ? ["dia0", "dia1", "dia2", "dia3", "dia4", "dia5"]
    : ["dia1", "dia2", "dia3", "dia4", "dia5"];

  const [selectedDayKey, setSelectedDayKey] = useState<string>("dia1");
  const [dbItems, setDbItems] = useState<DbScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStaff && selectedDayKey === "dia0") {
      setSelectedDayKey("dia1");
    }
  }, [isStaff, selectedDayKey]);
  const currentDayMeta = OFFICIAL_FSY_SCHEDULE[selectedDayKey] || OFFICIAL_FSY_SCHEDULE["dia1"];

  // Fetch schedule items from Supabase in real time
  useEffect(() => {
    async function loadSchedule() {
      setLoading(true);
      try {
        const res = await fetch("/api/schedule");
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setDbItems(json.data);
            setLoading(false);
            return;
          }
        }

        // Fallback to Supabase client
        const supabase = createClient();
        const { data } = await supabase
          .from("schedule_items")
          .select("*")
          .order("start_time", { ascending: true });

        if (data && data.length > 0) {
          setDbItems(data as DbScheduleItem[]);
        }
      } catch (err) {
        console.error("Error loading dynamic schedule:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, []);

  // Events for selected day: filter from DB if available, else fallback to officialSchedule.ts
  const dayDbEvents = dbItems.filter((i) => i.day === selectedDayKey);
  const hasDbEventsForDay = dayDbEvents.length > 0;

  // Normalized list of events to render
  const eventsToRender = hasDbEventsForDay
    ? dayDbEvents.map((item) => ({
        id: item.id,
        time: item.start_time,
        endTime: item.end_time || "--",
        title: item.title,
        location: item.location,
        description: item.description,
        category: item.category || "Geral",
        isHighlight: Boolean(item.is_highlight),
        roleBadge: undefined,
      }))
    : currentDayMeta.events.map((event) => ({
        id: event.id,
        time: event.time,
        endTime: event.endTime,
        title: event.title,
        location: event.location,
        description: event.description,
        category: event.category,
        isHighlight: Boolean(event.isHighlight),
        roleBadge: event.roleBadge,
      }));

  return (
    <div className="min-h-screen bg-fsy-watermark text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 px-3.5 py-2 rounded-xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Início
          </Link>

          <div className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg shadow-sm">
            <Calendar className="h-3.5 w-3.5 text-[#007DA5]" />
            <span>Cronograma Oficial da Sessão</span>
            {hasDbEventsForDay && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Sincronizado em tempo real" />
            )}
          </div>
        </div>

        {/* Header Hero Section */}
        <div className="bg-white dark:bg-slate-900 border-3 border-slate-900 dark:border-slate-700 rounded-2xl p-5 md:p-6 shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] dark:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Programação do Evento
            </h1>
            {loading && <VoluteLoader size={26} variant="brand" className="inline-block" />}
          </div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium mt-1">
            FSY Sessão Ribeirão Preto 2 — Horários oficiais de todas as atividades, refeições e reuniões espirituais.
          </p>

          {/* Day Switcher Tabs */}
          <div
            className={`grid gap-2 mt-5 ${
              isStaff ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-5"
            }`}
          >
            {dayKeys.map((key) => {
              const day = OFFICIAL_FSY_SCHEDULE[key];
              const isSelected = selectedDayKey === key;
              const count = dbItems.filter((i) => i.day === key).length || day.events.length;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDayKey(key)}
                  className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl font-black text-xs transition-all border-2 ${
                    isSelected
                      ? "bg-[#007DA5] text-white border-slate-900 dark:border-white shadow-sm -translate-y-0.5"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="text-xs font-bold">{day.name}</span>
                  <span className="text-[10px] opacity-80 font-semibold">{count} ativ.</span>
                  {key === "dia0" && (
                    <span className="text-[8px] font-black uppercase text-amber-900 bg-amber-200 dark:bg-amber-900/80 dark:text-amber-200 px-1 rounded mt-0.5 border border-amber-400">
                      Consultores
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Info Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#FFE48A]/20 dark:bg-amber-950/40 border-2 border-slate-900 dark:border-amber-500/40 rounded-xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-none">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-amber-200">
              {currentDayMeta.name} — {currentDayMeta.label}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
              Vestimenta recomendada: <strong className="text-slate-900 dark:text-white">{currentDayMeta.dressCode}</strong>
            </p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-lg border border-slate-300 dark:border-slate-700 self-start sm:self-center">
            {eventsToRender.length} Atividades
          </span>
        </div>

        {/* Timeline Events List */}
        <div className="relative pl-6 md:pl-8 before:absolute before:left-3 md:before:left-4 before:top-2 before:bottom-2 before:w-1 before:bg-slate-200 dark:before:bg-slate-800 space-y-4">
          {eventsToRender.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
              className="relative group"
            >
              {/* Timeline Bullet Indicator */}
              <div
                className={`absolute -left-[27px] md:-left-[31px] top-4 h-4 w-4 rounded-full border-2 border-white dark:border-slate-950 ${
                  event.isHighlight
                    ? "bg-[#FFE48A] ring-4 ring-amber-200 dark:ring-amber-900/60"
                    : event.category === "Espiritual"
                    ? "bg-[#007DA5] ring-2 ring-sky-100 dark:ring-sky-950"
                    : event.category === "Alimentação"
                    ? "bg-[#06D6A0] ring-2 ring-emerald-100 dark:ring-emerald-950"
                    : "bg-slate-400 dark:bg-slate-600"
                }`}
              />

              {/* Event Card */}
              <div
                className={`border-2 rounded-2xl p-4 md:p-5 transition-all ${
                  event.isHighlight
                    ? "bg-white dark:bg-slate-900 border-slate-900 dark:border-amber-400 shadow-md"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-400 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        <Clock className="h-3 w-3 text-slate-500 dark:text-slate-400" />
                        {event.time} {event.endTime && event.endTime !== "--" && `- ${event.endTime}`}
                      </span>

                      <Badge
                        variant="outline"
                        className="text-[11px] font-bold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      >
                        {event.category}
                      </Badge>

                      {event.roleBadge && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white dark:bg-slate-700"
                        >
                          {event.roleBadge}
                        </Badge>
                      )}

                      {event.isHighlight && (
                        <Badge className="bg-[#FFE48A] text-amber-950 hover:bg-amber-300 text-xs font-black border border-amber-500/30">
                          <Sparkles className="mr-1 h-3 w-3" /> Destaque
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white pt-0.5">
                      {event.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <MapPin className="h-3.5 w-3.5 text-[#FC4E6D]" />
                      <span>{event.location}</span>
                    </div>

                    {event.description && (
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 pt-1 font-medium leading-relaxed">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
