"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, MapPin, Shirt } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { OFFICIAL_FSY_SCHEDULE } from "@/data/officialSchedule";
import { useProfile } from "@/lib/supabase/useProfile";
import { effectiveEndTime, eventClock, getSchedule, scheduleVisibleTo, type ScheduleItem } from "@/services/scheduleService";
import { cn } from "@/lib/utils";

const DAY_DATES: Record<string, string> = {
  dia0: "2027-02-05",
  dia1: "2027-02-06",
  dia2: "2027-02-07",
  dia3: "2027-02-08",
  dia4: "2027-02-09",
  dia5: "2027-02-10",
};
const WEEKDAY: Record<string, string> = { dia0: "Sex", dia1: "Sáb", dia2: "Dom", dia3: "Seg", dia4: "Ter", dia5: "Qua" };

/** Uma cor por tipo de atividade, sempre acompanhada do nome (cor nunca é o único sinal). */
const CATEGORY_DOT: Record<string, string> = {
  Espiritual: "bg-[#007DA5]",
  Alimentação: "bg-[#93C742]",
  Show: "bg-[#FC4E6D]",
  Baile: "bg-[#FC4E6D]",
  Atividade: "bg-[#F68D2E]",
  Logística: "bg-slate-400",
  Equipe: "bg-slate-400",
};

function Activity({ item, live, past }: { item: ScheduleItem; live: boolean; past: boolean }) {
  const [open, setOpen] = useState(false);
  const end = item.end_time && /^\d{2}:\d{2}$/.test(item.end_time) ? item.end_time : null;
  return (
    <li id={`atividade-${item.id}`} className="relative scroll-mt-24 pl-16">
      <span className={cn("fsy-figure absolute left-0 top-4 w-12 text-right text-[15px] font-semibold", past ? "text-slate-500" : "text-slate-950 dark:text-white")}>
        {item.start_time}
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute left-[3.55rem] top-[1.35rem] h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-4 ring-[#FAF8F5] dark:ring-slate-950",
          CATEGORY_DOT[item.category] ?? "bg-[#FFB81C]"
        )}
      />
      <div
        className={cn(
          "ml-2 rounded-2xl border p-4 transition-colors",
          live
            ? "border-[#005E7C] bg-[#005E7C] text-white"
            : "border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900",
          past && !live && "opacity-60"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {live && <p className="mb-0.5 text-sm font-semibold text-[#FFE48A]">Agora</p>}
            <h3 className={cn("text-[17px] font-semibold leading-snug", live ? "text-white" : "text-slate-950 dark:text-white")}>{item.title}</h3>
            <p className={cn("mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", live ? "text-white/85" : "text-slate-600 dark:text-slate-300")}>
              {end && <span className="fsy-figure">até {end}</span>}
              {item.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {item.location}
                </span>
              )}
              <span>{item.category}</span>
            </p>
          </div>
          {item.description && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? "Esconder detalhes" : "Ver detalhes"}
              className={cn("-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors", live ? "hover:bg-white/10" : "hover:bg-slate-100 dark:hover:bg-slate-800")}
            >
              <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", open && "rotate-180")} />
            </button>
          )}
        </div>
        <AnimatePresence initial={false}>
          {open && item.description && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={cn("overflow-hidden text-[15px] leading-relaxed", live ? "text-white/90" : "text-slate-700 dark:text-slate-200")}
            >
              <span className="block pt-2">{item.description}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

function ScheduleContent() {
  const params = useSearchParams();
  const { profile } = useProfile();
  const reduce = useReducedMotion();
  const isStaff = Boolean(profile && profile.role !== "jovem");
  const dayKeys = useMemo(() => (isStaff ? ["dia0", "dia1", "dia2", "dia3", "dia4", "dia5"] : ["dia1", "dia2", "dia3", "dia4", "dia5"]), [isStaff]);

  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const clock = eventClock(now);
  const todayKey = Object.keys(DAY_DATES).find((k) => DAY_DATES[k] === clock.today);
  const [chosenDay, setDay] = useState<string>(() => {
    const requested = params.get("dia");
    if (requested && DAY_DATES[requested]) return requested;
    return todayKey && todayKey !== "dia0" ? todayKey : "dia1";
  });
  const scrolled = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getSchedule(undefined, controller.signal)
      .then(({ data }) => setItems(data))
      .catch(() => setItems([]));
    return () => controller.abort();
  }, []);

  // Dia zero é só da equipe.
  const day = !isStaff && chosenDay === "dia0" ? "dia1" : chosenDay;

  const dayItems = useMemo(
    () => scheduleVisibleTo(profile?.role ?? "jovem", items ?? []).filter((i) => i.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [items, day, profile?.role]
  );
  const isToday = DAY_DATES[day] === clock.today;

  // Abre na atividade pedida pelo link (#atividade-…) ou na que está acontecendo.
  useEffect(() => {
    if (!items || scrolled.current) return;
    scrolled.current = true;
    const target =
      (window.location.hash && document.querySelector(window.location.hash)) ||
      (isToday && dayItems.find((i) => effectiveEndTime(i, dayItems) > clock.now) && document.getElementById(`atividade-${dayItems.find((i) => effectiveEndTime(i, dayItems) > clock.now)!.id}`));
    if (target instanceof HTMLElement) target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [items, dayItems, isToday, clock.now, reduce]);

  const meta = OFFICIAL_FSY_SCHEDULE[day];

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6">
      <h1 className="font-heading text-3xl font-bold text-slate-950 dark:text-white">Agenda</h1>

      <div role="tablist" aria-label="Dias do evento" className="sticky top-14 z-30 -mx-4 mt-4 flex gap-1 overflow-x-auto bg-[#FAF8F5]/95 px-4 py-2 no-scrollbar backdrop-blur-md dark:bg-slate-950/95">
        {dayKeys.map((key) => {
          const selected = key === day;
          const [, , dd] = DAY_DATES[key].split("-");
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDay(key)}
              className={cn(
                "relative flex min-h-14 min-w-14 flex-1 flex-col items-center justify-center rounded-2xl px-2 transition-colors",
                selected ? "text-slate-950" : "text-slate-600 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
              )}
            >
              {selected && (
                <motion.span layoutId="agenda-day" className="absolute inset-0 rounded-2xl bg-[#FFE48A]" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }} />
              )}
              <span className="relative text-xs font-medium">{WEEKDAY[key]}</span>
              <span className="fsy-figure relative text-lg font-semibold leading-tight">{dd}</span>
              {DAY_DATES[key] === clock.today && <span className="relative mt-0.5 h-1 w-1 rounded-full bg-[#FC4E6D]" aria-label="Hoje" />}
            </button>
          );
        })}
      </div>

      {meta && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{meta.label.replace(/^.*?—\s*/, "")}</h2>
          {meta.dressCode && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <Shirt className="h-4 w-4" /> {meta.dressCode}
            </p>
          )}
        </div>
      )}

      {items === null ? (
        <div className="mt-5 space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="ml-16 h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />)}</div>
      ) : dayItems.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-5 py-8 text-center text-[15px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">A programação deste dia ainda não foi publicada.</p>
      ) : (
        <ol className="relative mt-5 space-y-3 before:absolute before:bottom-4 before:left-[3.55rem] before:top-4 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
          {dayItems.map((item) => {
            const end = effectiveEndTime(item, dayItems);
            const live = isToday && item.start_time <= clock.now && end > clock.now;
            const past = DAY_DATES[day] < clock.today || (isToday && end <= clock.now);
            return <Activity key={item.id} item={item} live={live} past={past} />;
          })}
        </ol>
      )}
    </main>
  );
}

export default function SchedulePage() {
  return (
    <div className="min-h-screen pb-28 md:pb-12">
      <Header />
      <Suspense fallback={null}>
        <ScheduleContent />
      </Suspense>
    </div>
  );
}
