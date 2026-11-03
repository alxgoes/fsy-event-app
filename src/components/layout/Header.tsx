"use client";

import React, { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, CalendarDays, House, Megaphone, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/supabase/useProfile";
import { FsyTempleMark } from "@/components/brand/FsyLogo";
import { Avatar } from "@/components/profile/Avatar";
import { useOwnPhoto } from "@/lib/profile-photo/useOwnPhoto";
import { markNoticesRead, NOTICES_UPDATED_EVENT, readNoticeIds } from "@/lib/notifications/readState";
import { relativeTime } from "@/lib/ui/relativeTime";

interface NoticeItem {
  id: string;
  title: string;
  priority: string;
  created_at: string;
  profiles?: { full_name: string; role: string } | null;
}

interface AppointmentItem {
  id: string;
  user_id?: string | null;
  reason: string;
  professional_name: string;
  scheduled_at: string;
  status: "agendado" | "realizado" | "cancelado";
  is_seen: boolean;
}

type Tab = { href: string; label: string; icon: React.ComponentType<{ className?: string }> | null; match: (p: string) => boolean };

/** Os mesmos quatro destinos no celular (barra inferior) e no computador (topo). */
const TABS: Tab[] = [
  { href: "/dashboard", label: "Início", icon: House, match: (p) => p === "/dashboard" || p === "/" },
  { href: "/schedule", label: "Agenda", icon: CalendarDays, match: (p) => p.startsWith("/schedule") },
  { href: "/announcements", label: "Avisos", icon: Megaphone, match: (p) => p.startsWith("/announcements") },
  { href: "/mais", label: "Mais", icon: null, match: (p) => ["/mais", "/fotos", "/consultor", "/instalar"].some((r) => p.startsWith(r)) },
];

function useNotices() {
  const { profile } = useProfile();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    setReadIds(readNoticeIds(profile.id));
    try {
      const company = profile.company_id ? `company_id=${encodeURIComponent(profile.company_id)}&` : "";
      const res = await fetch(`/api/announcements?${company}_t=${Date.now()}`);
      if (res.ok) setNotices(((await res.json()).data ?? []).slice(0, 20));
      // Agendamentos de saúde só aparecem para o próprio jovem; a equipe não baixa a agenda de ninguém aqui.
      if (profile.role === "jovem") {
        const appt = await fetch(`/api/medical/appointments?_t=${Date.now()}`);
        if (appt.ok) {
          const all: AppointmentItem[] = (await appt.json()).data ?? [];
          setAppointments(all.filter((a) => a.user_id === profile.id && a.status === "agendado"));
        }
      }
    } catch {
      /* sem rede: mantém o que já estava na tela */
    }
  }, [profile]);

  useEffect(() => {
    startTransition(() => {
      load();
    });
    const sync = () => profile && setReadIds(readNoticeIds(profile.id));
    window.addEventListener(NOTICES_UPDATED_EVENT, sync);
    return () => window.removeEventListener(NOTICES_UPDATED_EVENT, sync);
  }, [load, profile]);

  const unread = notices.filter((n) => !readIds.includes(n.id));
  const newAppointments = appointments.filter((a) => !a.is_seen);
  return { profile, unread, newAppointments, unreadCount: unread.length + newAppointments.length };
}

function Brand() {
  return (
    <Link href="/dashboard" className="fsy-action-link group flex min-w-0 items-center gap-2.5" aria-label="FSY Ribeirão Preto 2 — Início">
      <FsyTempleMark className="h-9 w-auto shrink-0" />
      <span className="min-w-0 leading-none">
        <span className="block font-heading text-lg font-bold text-slate-950 dark:text-white">FSY</span>
        <span className="block truncate text-xs font-medium text-slate-600 dark:text-slate-300">Ribeirão Preto 2</span>
      </span>
    </Link>
  );
}

function NoticesPopover({
  open,
  onClose,
  unread,
  appointments,
  profileId,
}: {
  open: boolean;
  onClose: () => void;
  unread: NoticeItem[];
  appointments: AppointmentItem[];
  profileId: string | null;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Novidades"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "top right" }}
          className="fixed left-3 right-3 top-[3.75rem] z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-float dark:border-slate-800 dark:bg-slate-900 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[22rem]"
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">Novidades</h2>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={() => markNoticesRead(profileId, unread.map((n) => n.id))}
                className="min-h-11 rounded-lg px-2 text-sm font-medium text-[var(--fsy-link)] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Marcar tudo como lido
              </button>
            )}
          </div>
          <div className="overflow-y-auto px-2 pb-2">
            {unread.length === 0 && appointments.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-600 dark:text-slate-300">Você está em dia. Nada novo por aqui.</p>
            ) : (
              <ul className="space-y-1">
                {appointments.map((a) => (
                  <li key={a.id} className="flex gap-3 rounded-xl px-2 py-2.5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Stethoscope className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-950 dark:text-white">{a.reason}</span>
                      <span className="block text-xs text-slate-600 dark:text-slate-300">
                        Com {a.professional_name} ·{" "}
                        {new Date(a.scheduled_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                  </li>
                ))}
                {unread.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/announcements#aviso-${n.id}`}
                      onClick={onClose}
                      className="flex gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <Avatar name={n.profiles?.full_name || "Coordenação"} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {n.priority === "urgent" && (
                            <span className="rounded-full bg-red-700 px-2 py-0.5 text-[11px] font-semibold text-white">Urgente</span>
                          )}
                          <span className="truncate text-sm font-medium text-slate-950 dark:text-white">{n.title}</span>
                        </span>
                        <span className="block text-xs text-slate-600 dark:text-slate-300">
                          {n.profiles?.full_name || "Coordenação"} · {relativeTime(n.created_at)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            href="/announcements"
            onClick={onClose}
            className="border-t border-slate-100 px-4 py-3 text-center text-sm font-medium text-[var(--fsy-link)] hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
          >
            Ver todos os avisos
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MeAvatar({ size, name, active }: { size: number; name: string; active?: boolean }) {
  const { state } = useOwnPhoto(Boolean(name));
  return (
    <Avatar
      name={name}
      src={state?.approved_url}
      size={size}
      className={cn("transition-shadow", active && "ring-2 ring-[#007DA5] ring-offset-2 ring-offset-background dark:ring-[#7DE3F4]")}
    />
  );
}

/** Barra inferior do celular: Início · Agenda · Avisos · Mais. */
function BottomNav({ pathname, unreadCount, name }: { pathname: string; unreadCount: number; name: string }) {
  const reduce = useReducedMotion();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-[#FAF8F5]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="group relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-slate-600 transition-transform active:scale-95 dark:text-slate-300"
              >
                <span className="relative flex h-8 w-14 items-center justify-center">
                  {active && (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 46 }}
                      className="absolute inset-0 rounded-full bg-[#FFE48A]"
                    />
                  )}
                  {Icon ? (
                    <Icon className={cn("relative h-5 w-5", active && "text-slate-950")} />
                  ) : (
                    <span className="relative">
                      <MeAvatar size={24} name={name} />
                    </span>
                  )}
                  {tab.href === "/announcements" && unreadCount > 0 && (
                    <span className="fsy-figure absolute -right-0.5 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FC4E6D] px-1 text-[11px] font-semibold text-slate-950">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </span>
                <span className={cn(active && "font-semibold text-slate-950 dark:text-white")}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Header() {
  const pathname = usePathname() ?? "/dashboard";
  const { profile, unread, newAppointments, unreadCount } = useNotices();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const name = profile?.full_name ?? "";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#FAF8F5]/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />

          <nav aria-label="Navegação principal" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {TABS.map((tab) => {
                const active = tab.match(pathname);
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors",
                        active
                          ? "bg-[#FFE48A] text-slate-950"
                          : "text-slate-700 hover:bg-slate-900/5 dark:text-slate-200 dark:hover:bg-white/10"
                      )}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <div className="relative" ref={bellRef}>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-label={unreadCount > 0 ? `Novidades: ${unreadCount} não lidas` : "Novidades"}
                className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-800 transition-[background-color,transform] hover:bg-slate-900/5 active:scale-95 dark:text-slate-100 dark:hover:bg-white/10"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span
                    key={unreadCount}
                    className="fsy-attention fsy-figure absolute right-1.5 top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FC4E6D] px-1 text-[11px] font-semibold text-slate-950"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <NoticesPopover
                open={open}
                onClose={() => setOpen(false)}
                unread={unread}
                appointments={newAppointments}
                profileId={profile?.id ?? null}
              />
            </div>
            {profile && (
              <Link href="/mais" aria-label="Meu perfil" className="hidden rounded-full md:block">
                <MeAvatar size={36} name={name} active={pathname.startsWith("/mais")} />
              </Link>
            )}
          </div>
        </div>
      </header>
      <BottomNav pathname={pathname} unreadCount={unread.length} name={name} />
    </>
  );
}
