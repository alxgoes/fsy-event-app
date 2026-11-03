"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock, MapPin, WifiOff } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Avatar } from "@/components/profile/Avatar";
import { useProfile } from "@/lib/supabase/useProfile";
import { EVENT_CITY, EVENT_SCRIPTURE, EVENT_THEME, EVENT_VENUE, EVENT_START_AT, EVENT_END_AT } from "@/lib/event/identity";
import {
  calculateActiveAndNextEvents,
  effectiveEndTime,
  eventClock,
  getSchedule,
  scheduleVisibleTo,
  type ScheduleItem,
} from "@/services/scheduleService";
import { getAnnouncements, type Announcement } from "@/services/announcementsService";
import { getCompany, type CompanyData } from "@/services/companyService";
import { getFeaturedPhotos } from "@/services/mediaService";
import { photoSources } from "@/lib/media/drive";
import { relativeTime } from "@/lib/ui/relativeTime";
import type { MediaPhoto } from "@/types/media";
import { cn } from "@/lib/utils";

const EVENT_START = new Date(EVENT_START_AT);
const EVENT_END = new Date(EVENT_END_AT);

/** Relógio que atualiza a cada 30 s: "Agora" e a contagem nunca ficam parados. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function minutesBetween(a: string, b: string) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

function Card({ className, children, label }: { className?: string; children: React.ReactNode; label: string }) {
  return (
    <section aria-label={label} className={cn("rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-slate-800 dark:bg-slate-900", className)}>
      {children}
    </section>
  );
}

function SectionTitle({ title, href, cta }: { title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-heading text-xl font-bold text-slate-950 dark:text-white">{title}</h2>
      {href && (
        <Link href={href} className="group inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[var(--fsy-link)]">
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800", className)} />;
}

/** O momento do evento: contagem, atividade em andamento ou a próxima. */
function MomentHero({ items, now, loading }: { items: ScheduleItem[]; now: Date; loading: boolean }) {
  const reduce = useReducedMotion();
  const { currentEvent, nextEvent } = useMemo(() => calculateActiveAndNextEvents(items, now), [items, now]);
  const { today, now: hhmm } = eventClock(now);
  const todays = items.filter((i) => i.date === today).sort((a, b) => a.start_time.localeCompare(b.start_time));

  let eyebrow = "";
  let title = "";
  let meta: React.ReactNode = null;
  let progress: number | null = null;
  let footer: React.ReactNode = null;

  if (now < EVENT_START) {
    const days = Math.max(1, Math.ceil((EVENT_START.getTime() - now.getTime()) / 86_400_000));
    eyebrow = "06 a 10 de fevereiro de 2027";
    title = days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`;
    meta = (
      <span className="inline-flex items-center gap-1.5">
        <MapPin className="h-4 w-4" /> {EVENT_VENUE} · {EVENT_CITY}
      </span>
    );
  } else if (now > EVENT_END) {
    eyebrow = "FSY Ribeirão Preto 2";
    title = "Obrigado por viver esta semana";
    meta = "Leve com você o que aprendeu. As fotos continuam em Mais › Fotos.";
  } else if (currentEvent) {
    const end = effectiveEndTime(currentEvent, todays);
    const total = Math.max(1, minutesBetween(currentEvent.start_time, end));
    progress = Math.min(1, Math.max(0, minutesBetween(currentEvent.start_time, hhmm) / total));
    eyebrow = "Agora";
    title = currentEvent.title;
    meta = (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="fsy-figure inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {currentEvent.start_time}–{end}</span>
        {currentEvent.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {currentEvent.location}</span>}
      </span>
    );
    if (nextEvent) footer = <>A seguir: <strong className="font-semibold">{nextEvent.title}</strong> · <span className="fsy-figure">{nextEvent.start_time}</span></>;
  } else if (nextEvent) {
    const sameDay = nextEvent.date === today;
    const mins = sameDay ? minutesBetween(hhmm, nextEvent.start_time) : null;
    eyebrow = mins !== null && mins <= 90 ? `Começa em ${mins} min` : "A seguir";
    title = nextEvent.title;
    meta = (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="fsy-figure inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {sameDay ? nextEvent.start_time : `amanhã, ${nextEvent.start_time}`}</span>
        {nextEvent.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {nextEvent.location}</span>}
      </span>
    );
  } else {
    eyebrow = "Hoje";
    title = "Sem mais atividades por hoje";
    meta = "Descanse bem. A programação de amanhã já está na Agenda.";
  }

  return (
    <motion.section
      aria-label="Momento do evento"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative min-w-0 max-w-full overflow-hidden rounded-3xl bg-[#005E7C] p-6 text-white sm:p-8"
    >
      {/* Arco do sistema "Arch Graphic" como moldura da área, sem tocar no identificador. */}
      <svg aria-hidden viewBox="0 0 200 240" preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute -right-10 -top-6 h-[140%] max-w-none aspect-[5/6] opacity-[0.14]">
        <path d="M20 240V100a80 80 0 0 1 160 0v140" fill="none" stroke="#FFE48A" strokeWidth="14" />
        <path d="M52 240V104a48 48 0 0 1 96 0v136" fill="none" stroke="#7DE3F4" strokeWidth="8" />
      </svg>
      {loading && items.length === 0 && now >= EVENT_START ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-24 bg-white/20" />
          <Skeleton className="h-9 w-3/4 bg-white/20" />
        </div>
      ) : (
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold text-[#FFE48A]">{eyebrow}</p>
          <h2 className={cn("mt-1 font-heading font-bold leading-tight", now < EVENT_START ? "fsy-figure text-4xl sm:text-5xl" : "text-3xl sm:text-4xl")}>
            {title}
          </h2>
          {meta && <div className="mt-3 text-[15px] text-white/90">{meta}</div>}
          {progress !== null && (
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/20" role="progressbar" aria-label="Andamento da atividade" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <motion.div
                className="h-full origin-left rounded-full bg-[#FFE48A]"
                initial={false}
                animate={{ scaleX: progress }}
                transition={{ duration: reduce ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          )}
          {footer && <p className="mt-4 border-t border-white/15 pt-3 text-sm text-white/90">{footer}</p>}
        </div>
      )}
    </motion.section>
  );
}

function DayAgenda({ items, now, loading }: { items: ScheduleItem[]; now: Date; loading: boolean }) {
  const { today, now: hhmm } = eventClock(now);
  const during = now >= EVENT_START && now <= EVENT_END;
  const sorted = [...items].filter((i) => i.day !== "dia0").sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));
  const date = during ? today : sorted[0]?.date;
  const day = sorted.filter((i) => i.date === date);
  if (!loading && (now > EVENT_END || day.length === 0)) return null;
  const upcoming = during ? day.filter((i) => effectiveEndTime(i, day) > hhmm) : day;
  const shown = upcoming.slice(0, 5);

  return (
    <Card label={during ? "Hoje" : "Primeiro dia"}>
      <SectionTitle title={during ? "Hoje" : "Primeiro dia"} href="/schedule" cta="Agenda" />
      {loading && items.length === 0 ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : shown.length === 0 ? (
        <p className="text-[15px] text-slate-600 dark:text-slate-300">As atividades de hoje terminaram.</p>
      ) : (
        <ol className="space-y-1">
          {shown.map((item) => {
            const live = during && item.start_time <= hhmm && effectiveEndTime(item, day) > hhmm;
            return (
              <li key={item.id}>
                <Link
                  href={`/schedule?dia=${item.day}#atividade-${item.id}`}
                  className={cn(
                    "flex min-h-12 items-center gap-4 rounded-2xl px-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50",
                    live && "bg-[#FFE48A]/40 hover:bg-[#FFE48A]/50 dark:bg-[#FFE48A]/15"
                  )}
                >
                  <span className="fsy-figure w-12 shrink-0 text-[15px] font-semibold text-slate-950 dark:text-white">{item.start_time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-slate-950 dark:text-white">{item.title}</span>
                    {item.location && <span className="block truncate text-sm text-slate-600 dark:text-slate-300">{item.location}</span>}
                  </span>
                  {live && <span className="rounded-full bg-[#005E7C] px-2.5 py-0.5 text-xs font-semibold text-white">Agora</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function CompanyCard({ company, room, loading, hasCompany }: { company: CompanyData | null; room: string | null; loading: boolean; hasCompany: boolean }) {
  return (
    <Card label="Minha companhia" className="bg-[#FFF4CC] dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Minha companhia</h2>
      {!hasCompany ? (
        <p className="mt-2 text-[15px] text-slate-800 dark:text-slate-200">Sua companhia é definida pela equipe na abertura do FSY. Ela aparece aqui assim que for designada.</p>
      ) : loading && !company ? (
        <div className="mt-3 space-y-2"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-5 w-1/2" /></div>
      ) : company ? (
        <>
          <p className="mt-1 font-heading text-2xl font-bold text-slate-950 dark:text-white">{company.name}</p>
          {company.motto && <p className="mt-1 font-scripture text-lg italic text-slate-800 dark:text-slate-200">“{company.motto}”</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            {(company.counselors ?? []).map((name) => (
              <span key={name} className="inline-flex items-center gap-2">
                <Avatar name={name} size={36} />
                <span className="leading-tight">
                  <span className="block text-[15px] font-medium text-slate-950 dark:text-white">{name}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-300">Consultor(a)</span>
                </span>
              </span>
            ))}
            {room && <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-100">Quarto {room}</span>}
          </div>
        </>
      ) : (
        <p className="mt-2 text-[15px] text-slate-700 dark:text-slate-300">Não foi possível carregar sua companhia agora.</p>
      )}
    </Card>
  );
}

function RecentNotices({ notices, loading }: { notices: Announcement[]; loading: boolean }) {
  const latest = notices.slice(0, 2);
  return (
    <Card label="Avisos recentes">
      <SectionTitle title="Avisos" href="/announcements" cta="Ver todos" />
      {loading && notices.length === 0 ? (
        <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : latest.length === 0 ? (
        <p className="text-[15px] text-slate-600 dark:text-slate-300">Nenhum aviso por enquanto. Quando a coordenação ou seus consultores postarem, aparece aqui.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {latest.map((n) => (
            <li key={n.id}>
              <Link href={`/announcements#aviso-${n.id}`} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar name={n.profiles?.full_name || "Coordenação"} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-medium text-slate-900 dark:text-white">{n.profiles?.full_name || "Coordenação"}</span> · {relativeTime(n.created_at)}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    {n.priority === "urgent" && <span className="rounded-full bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">Urgente</span>}
                    <span className="truncate text-[15px] font-semibold text-slate-950 dark:text-white">{n.title}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[15px] text-slate-700 dark:text-slate-200">{n.content}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PhotoStrip({ photos }: { photos: MediaPhoto[] }) {
  const tiles = photos
    .map((p) => ({ p, s: photoSources(p) }))
    .filter((t) => t.s)
    .slice(0, 10);
  if (tiles.length === 0) return null;
  return (
    <section aria-label="Fotos em destaque">
      <SectionTitle title="Fotos" href="/fotos" cta="Ver todas" />
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
        {tiles.map(({ p, s }) => (
          <Link
            key={p.id}
            href="/fotos"
            className="relative aspect-[4/5] w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-slate-200 transition-transform active:scale-[0.98] dark:bg-slate-800 sm:w-44"
          >
            {/* Miniaturas do Google Drive; sem otimizador para não reprocessar a imagem externa. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s!.thumb} alt={p.title || "Foto do FSY"} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function YouthDashboard() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const now = useNow();

  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [photos, setPhotos] = useState<MediaPhoto[]>([]);
  const [loading, setLoading] = useState({ schedule: true, company: true, notices: true });
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!profileLoading && !profile) router.push("/login");
  }, [profileLoading, profile, router]);

  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    const { signal } = controller;
    const done = (key: keyof typeof loading) => !signal.aborted && setLoading((l) => ({ ...l, [key]: false }));

    getSchedule(undefined, signal)
      .then(({ data, fromCache }) => {
        if (signal.aborted) return;
        setSchedule(scheduleVisibleTo(profile.role, data));
        if (fromCache && !navigator.onLine) setOffline(true);
      })
      .catch(() => {})
      .finally(() => done("schedule"));

    if (profile.company_id) {
      getCompany(profile.company_id, signal)
        .then(({ data }) => !signal.aborted && setCompany(data))
        .catch(() => {})
        .finally(() => done("company"));
    } else done("company");

    getAnnouncements(profile.company_id, signal)
      .then(({ data }) => !signal.aborted && setNotices(data))
      .catch(() => {})
      .finally(() => done("notices"));

    getFeaturedPhotos(signal)
      .then(({ data }) => !signal.aborted && setPhotos(data))
      .catch(() => {});

    return () => controller.abort();
  }, [profile]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="min-h-screen pb-28 text-slate-900 dark:text-slate-100 md:pb-12">
      <Header />
      <main className="mx-auto w-full min-w-0 max-w-6xl space-y-5 overflow-x-clip px-4 pt-6 sm:px-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-950 dark:text-white">{firstName ? `Olá, ${firstName}` : "Olá"}</h1>
          <p className="mt-1 text-[15px] text-slate-700 dark:text-slate-300">
            <span className="font-scripture text-lg italic">{EVENT_THEME}</span> · {EVENT_SCRIPTURE}
          </p>
          {offline && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-slate-800">
              <WifiOff className="h-4 w-4 text-[#FFE48A]" /> Sem internet · mostrando o que foi salvo neste aparelho
            </p>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="min-w-0 space-y-5">
            <MomentHero items={schedule} now={now} loading={loading.schedule} />
            <DayAgenda items={schedule} now={now} loading={loading.schedule} />
          </div>
          <div className="min-w-0 space-y-5">
            <CompanyCard company={company} room={profile?.room ?? null} loading={loading.company} hasCompany={Boolean(profile?.company_id)} />
            <RecentNotices notices={notices} loading={loading.notices} />
          </div>
        </div>

        <PhotoStrip photos={photos} />
      </main>
    </div>
  );
}
