"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Bell,
  Shield,
  LogOut,
  User,
  ChevronDown,
  Loader2,
  Clock,
  Stethoscope,
  CheckCircle2,
  Building2,
  Check,
  Megaphone,
  ExternalLink,
  Calendar,
  Sparkles,
  Camera,
  Menu,
  X,
  Compass,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isMasterAdmin, canAccessAdmin, ROLE_LABELS } from "@/lib/supabase/useProfile";
import { FsyTempleMark, FsyFloatingLetters } from "@/components/brand/FsyLogo";
import { VoluteLoader } from "@/components/ui/VoluteLoader";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

interface AppointmentNotification {
  id: string;
  user_id?: string | null;
  youth_name: string;
  professional_name: string;
  reason: string;
  scheduled_at: string;
  status: "agendado" | "realizado" | "cancelado";
  is_seen: boolean;
  notes?: string | null;
}

interface AnnouncementNotification {
  id: string;
  title: string;
  content: string;
  priority: string;
  category: string;
  target_company_id: string | null;
  created_at: string;
  profiles?: { full_name: string; role: string } | null;
}

function NavCardItem({
  title,
  children,
  href,
  icon: Icon,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string;
}) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          className="group block select-none rounded-2xl p-3 leading-none no-underline outline-none transition-all duration-200 ease-out bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] dark:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:border-[#007DA5] dark:hover:border-[#01B6D1] hover:shadow-[4px_4px_0px_0px_rgba(0,125,165,0.9)] dark:hover:shadow-[4px_4px_0px_0px_rgba(1,182,209,0.5)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] hover:bg-sky-50/80 dark:hover:bg-slate-700/80 cursor-pointer"
        >
          <div className="flex items-start gap-3">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950 text-[#007DA5] dark:text-[#01B6D1] border-2 border-slate-900/60 dark:border-slate-700 shadow-xs group-hover:bg-[#007DA5] group-hover:text-white group-hover:border-slate-950 transition-all shrink-0 mt-0.5">
                <Icon className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <h4 className="text-xs sm:text-sm font-black text-slate-950 dark:text-white group-hover:text-[#007DA5] dark:group-hover:text-[#01B6D1] transition-colors leading-snug">
                  {title}
                </h4>
                {badge && (
                  <span className="rounded-md bg-[#FFE48A] text-slate-950 border border-slate-900/40 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider shrink-0 shadow-2xs">
                    {badge}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-700 dark:text-slate-200">
                {children}
              </p>
            </div>
          </div>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading } = useProfile();

  const isHomeActive = pathname === "/dashboard" || pathname === "/";

  const [appointments, setAppointments] = useState<AppointmentNotification[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementNotification[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [markingSeenId, setMarkingSeenId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Load read announcements list from localStorage
  const getReadStorageKey = useCallback(() => {
    return profile?.id ? `fsy_read_announcements_${profile.id}` : "fsy_read_announcements_guest";
  }, [profile]);

  const refreshReadState = useCallback(() => {
    try {
      const key = getReadStorageKey();
      const raw = localStorage.getItem(key);
      if (raw) {
        setReadAnnouncements(JSON.parse(raw) || []);
      } else {
        setReadAnnouncements([]);
      }
    } catch {
      setReadAnnouncements([]);
    }
  }, [getReadStorageKey]);

  // Fetch appointments and company announcements to power notifications bell
  const loadNotifications = useCallback(async () => {
    if (!profile) return;
    try {
      refreshReadState();

      // 1. Appointments
      const apptRes = await fetch(`/api/medical/appointments?_t=${Date.now()}`);
      if (apptRes.ok) {
        const json = await apptRes.json();
        const allAppts: AppointmentNotification[] = json.data ?? [];

        const myAppts = allAppts.filter((a) => {
          if (a.user_id && profile.id) return a.user_id === profile.id;
          return a.youth_name.toLowerCase().trim() === profile.full_name.toLowerCase().trim();
        });

        setAppointments(myAppts);
      }

      // 2. Announcements / Messages for the youth's company & global
      const compParam = profile.company_id ? `company_id=${profile.company_id}&` : "";
      const annRes = await fetch(`/api/announcements?${compParam}_t=${Date.now()}`);
      if (annRes.ok) {
        const json = await annRes.json();
        setAnnouncements((json.data ?? []).slice(0, 10));
      }
    } catch {
      // ignore
    }
  }, [profile, refreshReadState]);

  useEffect(() => {
    if (profile) {
      loadNotifications();
    }
  }, [profile, loadNotifications]);

  // Listen to cross-component notification updates
  useEffect(() => {
    const handleSync = () => {
      loadNotifications();
    };
    window.addEventListener("fsy_notifications_updated", handleSync);
    return () => window.removeEventListener("fsy_notifications_updated", handleSync);
  }, [loadNotifications]);

  // Close popovers on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAppointmentAsSeen = async (apptId: string) => {
    setMarkingSeenId(apptId);
    try {
      const res = await fetch("/api/medical/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: apptId, is_seen: true }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === apptId ? { ...a, is_seen: true } : a))
        );
        window.dispatchEvent(new Event("fsy_notifications_updated"));
      }
    } catch (err) {
      console.error("Error marking appointment as seen:", err);
    } finally {
      setMarkingSeenId(null);
    }
  };

  const handleMarkAnnouncementAsRead = (annId: string) => {
    try {
      const key = getReadStorageKey();
      const current = new Set(readAnnouncements);
      current.add(annId);
      const updated = Array.from(current);
      localStorage.setItem(key, JSON.stringify(updated));
      setReadAnnouncements(updated);
      window.dispatchEvent(new Event("fsy_notifications_updated"));
    } catch (err) {
      console.error("Error saving read announcement:", err);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isYouth = !profile || profile.role === "jovem";
  const displayName = profile?.full_name ?? "Carregando...";
  const displayCompany = profile?.company_id ?? null;
  const avatarLetter = profile?.full_name?.charAt(0)?.toUpperCase() ?? "?";
  const role = profile?.role ?? "jovem";
  const roleLabel = ROLE_LABELS[role];
  const userIsMaster = !isYouth && isMasterAdmin(role);
  const canAccessFullAdmin = !isYouth && canAccessAdmin(role);
  const canSeeCounselorPanel = !isYouth && (userIsMaster || role === "consultor");

  // Count unread items
  const unreadAppointments = appointments.filter((a) => !a.is_seen && a.status === "agendado");
  const unreadAnnouncements = announcements.filter((a) => !readAnnouncements.includes(a.id));
  const totalUnread = unreadAppointments.length + unreadAnnouncements.length;

  return (
    <header className="sticky top-0 z-40 w-full px-2 sm:px-6 py-2 transition-all max-w-full overflow-x-clip">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl shadow-xs px-2.5 sm:px-5 py-1.5 sm:py-2 min-w-0">
        {/* Brand Logo & Title */}
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-2.5 group shrink-0 min-w-0">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex w-6 h-9 sm:w-7 sm:h-10 shrink-0 items-center justify-center rounded-t-full rounded-b-lg bg-[#EFEFE7] dark:bg-slate-800 border-2 border-slate-900/50 dark:border-slate-700 shadow-xs cursor-pointer p-0.5 overflow-hidden"
            title="Templo de Salt Lake - FSY 2027"
          >
            <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
          </motion.div>
          <FsyFloatingLetters size="xs" className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="font-heading text-xs sm:text-base font-black tracking-tight text-slate-900 dark:text-white truncate max-w-[120px] xs:max-w-[170px] sm:max-w-none">
                Ribeirão Preto 2
              </span>
              <span className="rounded-md bg-[#FFE48A] px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase text-slate-950 border border-slate-900/30 shrink-0">
                2027
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 hidden sm:block">
              Portal do Jovem
            </p>
          </div>
        </Link>

        {/* Center: Modern NavigationMenu (Desktop) */}
        <div className="hidden lg:flex items-center justify-center">
          <NavigationMenu>
            <NavigationMenuList className="gap-1 p-1 rounded-full bg-slate-100/70 dark:bg-slate-800/70 border-2 border-slate-900/10 dark:border-slate-700/60 shadow-inner backdrop-blur-sm">
              {/* Dashboard Link */}
              <NavigationMenuItem>
                <Link href="/dashboard" legacyBehavior passHref>
                  <NavigationMenuLink
                    className={cn(
                      navigationMenuTriggerStyle(),
                      isHomeActive &&
                        "bg-[#007DA5] text-white border-slate-950 dark:border-slate-700 shadow-tactile-pill -translate-y-0.5"
                    )}
                  >
                    Início
                  </NavigationMenuLink>
                </Link>
              </NavigationMenuItem>

              {/* Programação Dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger>Programação</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[430px] gap-3 p-1.5 md:w-[520px] md:grid-cols-2">
                    <NavCardItem
                       title="Cronograma Oficial"
                      href="/schedule"
                      icon={Calendar}
                      badge="5 Dias"
                    >
                      Horários, temas e roteiro completo das atividades da sessão.
                    </NavCardItem>
                    <NavCardItem
                      title="Aulas & Oficinas"
                      href="/schedule"
                      icon={Sparkles}
                    >
                      Encontros espirituais matinais e mensagens edificantes.
                    </NavCardItem>
                    <NavCardItem
                      title="Noite dos Talentos"
                      href="/schedule"
                      icon={Compass}
                    >
                      Apresentações musicais e artísticas das companhias.
                    </NavCardItem>
                    <NavCardItem
                      title="Baile & Confraternização"
                      href="/schedule"
                      icon={Sparkles}
                    >
                      Músicas, dança e momentos marcantes do FSY.
                    </NavCardItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Comunidade & Mídia Dropdown */}
              <NavigationMenuItem>
                <NavigationMenuTrigger>Comunidade & Mídia</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[430px] gap-3 p-1.5 md:w-[520px] md:grid-cols-2">
                    <NavCardItem
                      title="Lembretes & Avisos"
                      href="/announcements"
                      icon={Megaphone}
                      badge={totalUnread > 0 ? `${totalUnread} novos` : undefined}
                    >
                      Comunicados da coordenação e recados da sua companhia.
                    </NavCardItem>
                    <NavCardItem
                      title="Fotos em Destaque"
                      href="/dashboard"
                      icon={Camera}
                    >
                      Galeria dos melhores registros fotográficos da sessão.
                    </NavCardItem>
                    <NavCardItem
                      title="Mural Social"
                      href="/dashboard"
                      icon={Sparkles}
                    >
                      Publicações compartilhadas com a hashtag oficial do FSY.
                    </NavCardItem>
                    <NavCardItem
                      title="Minha Companhia"
                      href="/dashboard"
                      icon={Building2}
                    >
                      Grito de guerra, consultores e integrantes da companhia.
                    </NavCardItem>
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* Gestão / Consultor Dropdown (Exibido ESTRITAMENTE para Staff e Consultores, NUNCA para jovens) */}
              {!isYouth && (canAccessFullAdmin || canSeeCounselorPanel) && (
                <NavigationMenuItem>
                  <NavigationMenuTrigger>
                    {canAccessFullAdmin ? "Gestão" : "Consultor"}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[380px] gap-3 p-1.5">
                      {canSeeCounselorPanel && (
                        <NavCardItem
                          title="Painel do Consultor"
                          href="/consultor"
                          icon={Building2}
                          badge="Consultor"
                        >
                          Diário de bordo e acompanhamento dos jovens da companhia.
                        </NavCardItem>
                      )}
                      {canAccessFullAdmin && (
                        <NavCardItem
                          title="Painel Geral de Gestão"
                          href="/admin"
                          icon={Shield}
                          badge="Admin"
                        >
                          Coordenação, logística, escala médica e relatórios gerais.
                        </NavCardItem>
                      )}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              )}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Theme Toggle (Dark / Light Mode) */}
          <ThemeToggle />

          {/* Functional Notification Bell with Popover */}
          <div className="relative" ref={notificationsRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                setNotificationsOpen((o) => !o);
                setDropdownOpen(false);
              }}
              className="relative flex h-8 w-8 sm:h-9 sm:w-9 min-h-0 min-w-0 items-center justify-center rounded-xl bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border-2 border-slate-900/20 dark:border-slate-700 shadow-2xs hover:border-slate-950 dark:hover:border-slate-600 hover:shadow-tactile-pill hover:bg-[#007DA5]/10 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shrink-0"
              aria-label="Lembretes e Notificações"
            >
              <Bell className="h-4 w-4 text-slate-800 dark:text-slate-200" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FC4E6D] text-[10px] font-black text-white border border-slate-900 motion-safe:animate-pulse">
                  {totalUnread}
                </span>
              )}
            </motion.button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="fixed sm:absolute top-14 sm:top-full left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-96 rounded-3xl border-2 border-slate-950 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] dark:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-50 max-h-[82vh] flex flex-col"
                >
                  {/* Popover Header */}
                  <div className="px-4 py-3 border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#007DA5]" />
                      <h3 className="font-heading text-sm font-black text-slate-900 dark:text-white">
                        Lembretes & Comunicados
                      </h3>
                    </div>
                    {totalUnread > 0 ? (
                      <span className="rounded-md bg-[#FC4E6D] text-white text-xs font-black px-2 py-0.5">
                        {totalUnread} pendente(s)
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        Tudo em dia
                      </span>
                    )}
                  </div>

                  {/* Notifications Content List */}
                  <div className="max-h-84 overflow-y-auto p-3 space-y-2.5">
                    {appointments.length === 0 && announcements.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 dark:text-slate-400">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-60 text-emerald-500" />
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                          Nenhum lembrete ou agendamento
                        </p>
                        <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                          Quando os consultores ou a coordenação postarem algo, você verá aqui.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* 1. Announcements / Counselor Messages */}
                        {announcements.map((ann) => {
                          const isRead = readAnnouncements.includes(ann.id);
                          const isUrgent = ann.priority === "urgent";
                          const isImportant = ann.priority === "important";
                          const author = ann.profiles?.full_name || "Consultores / Coordenação";

                          return (
                            <div
                              key={ann.id}
                              className={`rounded-2xl border-2 p-3.5 transition-all ${
                                !isRead
                                  ? isUrgent
                                    ? "border-red-500 bg-red-50/80 dark:bg-red-950/40 shadow-brutal-sm"
                                    : isImportant
                                    ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/30 shadow-brutal-sm"
                                    : "border-slate-900 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-950/20 shadow-brutal-sm"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-70"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                      isUrgent
                                        ? "bg-red-500 text-white"
                                        : isImportant
                                        ? "bg-[#FFD166] text-slate-950"
                                        : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                                    }`}
                                  >
                                    <Megaphone className="h-2.5 w-2.5" />
                                    {isUrgent ? "Urgente" : isImportant ? "Importante" : "Recado Cia"}
                                  </span>
                                  {!isRead && (
                                    <span className="h-2 w-2 rounded-full bg-[#FC4E6D] animate-ping" />
                                  )}
                                </div>

                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(ann.created_at).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              <p className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                                {ann.title}
                              </p>

                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-1 line-clamp-2">
                                {ann.content}
                              </p>

                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                                  Por: <strong>{author}</strong>
                                </span>

                                {!isRead ? (
                                  <button
                                    onClick={() => handleMarkAnnouncementAsRead(ann.id)}
                                    className="inline-flex items-center gap-1 rounded-xl bg-[#06D6A0] hover:bg-emerald-400 text-emerald-950 text-xs font-black px-3 py-1.5 border border-slate-900 shadow-sm transition-all cursor-pointer min-h-[36px]"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    <span>Marcar como lido</span>
                                  </button>
                                ) : (
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Lido
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* 2. Multidisciplinary Medical Appointments */}
                        {appointments.map((appt) => {
                          const isSeen = appt.is_seen;
                          const isMarking = markingSeenId === appt.id;

                          return (
                            <div
                              key={appt.id}
                              className={`rounded-2xl border-2 p-3.5 transition-all ${
                                !isSeen
                                  ? "border-slate-900 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-sm"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-xs font-black uppercase">
                                  <Stethoscope className="h-3 w-3" />
                                  Saúde & Inclusão
                                </span>

                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(appt.scheduled_at).toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              <p className="text-xs font-extrabold text-slate-900 dark:text-white">
                                {appt.reason}
                              </p>

                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                                Com: <strong>{appt.professional_name}</strong>
                              </p>

                              {/* Action: Marcar como Visto */}
                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                                {!isSeen ? (
                                  <button
                                    onClick={() => handleMarkAppointmentAsSeen(appt.id)}
                                    disabled={isMarking}
                                    className="inline-flex items-center gap-1 rounded-xl bg-[#06D6A0] hover:bg-emerald-400 text-emerald-950 text-xs font-black px-3 py-1.5 border border-slate-900 shadow-sm transition-all cursor-pointer min-h-[36px]"
                                  >
                                    {isMarking ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5" />
                                    )}
                                    <span>Marcar como visto</span>
                                  </button>
                                ) : (
                                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Visualizado
                                  </span>
                                )}

                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                  {appt.status === "realizado" ? "Realizado" : "Agendado"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* Popover Footer Link */}
                  <div className="p-3 border-t-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <Link
                      href="/announcements"
                      onClick={() => setNotificationsOpen(false)}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-black text-[#007DA5] dark:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[40px]"
                    >
                      <span>Ver mural de lembretes completo</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Avatar Dropdown (Desktop / lg:flex) */}
          <div className="relative hidden lg:block" ref={dropdownRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setDropdownOpen((o) => !o);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 px-2.5 py-1.5 min-h-[38px] border-2 border-slate-900/20 dark:border-slate-700 shadow-2xs hover:border-slate-950 dark:hover:border-slate-600 hover:shadow-tactile-pill hover:bg-[#007DA5]/10 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              aria-label="Menu do usuário"
            >
              {loading ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <VoluteLoader size={18} variant="subtle" />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#007DA5] text-white font-black text-xs shadow-2xs">
                  {avatarLetter}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {loading ? "..." : displayName.split(" ")[0]}
                </p>
                <p className="text-[10px] font-extrabold text-[#005E7C] dark:text-cyan-400 truncate max-w-[100px]">
                  {loading ? "Carregando" : displayCompany ?? roleLabel}
                </p>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </motion.button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-64 rounded-3xl border-2 border-slate-950 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] dark:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden z-50"
                >
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007DA5] text-white font-black text-sm shadow-xs">
                        {avatarLetter}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {displayName}
                        </p>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-[#007DA5]/10 text-[#007DA5] dark:text-cyan-300 text-xs font-black uppercase tracking-wider">
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="p-2 space-y-0.5">
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                      Meu Dashboard
                    </Link>

                    <Link
                      href="/announcements"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Megaphone className="h-4 w-4 text-[#FC4E6D]" />
                      Lembretes & Comunicados
                    </Link>

                    {/* Counselor Panel Link */}
                    {canSeeCounselorPanel && (
                      <Link
                        href="/consultor"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        <Building2 className="h-4 w-4 text-[#7209B7]" />
                        <span>Painel do Consultor</span>
                      </Link>
                    )}

                    {/* Staff / Admin Management Link */}
                    {canAccessFullAdmin && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#007DA5] dark:text-cyan-400 bg-sky-50/50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors"
                      >
                        <Shield className="h-4 w-4 text-[#007DA5]" />
                        <span>Painel de Gestão</span>
                      </Link>
                    )}
                  </div>

                  {/* Sign Out */}
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                    >
                      {signingOut ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      <span>{signingOut ? "Saindo..." : "Sair da conta"}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Hamburger Toggle Button (lg:hidden) */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((o) => !o);
              setDropdownOpen(false);
              setNotificationsOpen(false);
            }}
            className="flex lg:hidden h-8 w-8 sm:h-9 sm:w-9 min-h-0 min-w-0 items-center justify-center rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-750 transition-colors cursor-pointer shrink-0"
            aria-label="Abrir menu de navegação"
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="lg:hidden mt-2 mx-auto max-w-7xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-lg p-3 space-y-2"
          >
            {/* User Profile Card inside Mobile Drawer */}
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007DA5] text-white font-black text-sm shadow-xs shrink-0">
                {avatarLetter}
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {displayName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block px-1.5 py-0.5 rounded-md bg-[#007DA5]/10 text-[#007DA5] dark:text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                    {roleLabel}
                  </span>
                  {displayCompany && (
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">
                      {displayCompany}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="space-y-1.5 pt-1">
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all border-2",
                  pathname === "/dashboard"
                    ? "bg-[#007DA5] text-white border-slate-950 dark:border-slate-700 shadow-tactile-pill"
                    : "border-transparent text-slate-800 dark:text-slate-200 hover:bg-[#007DA5]/10 hover:border-slate-950/30 hover:shadow-tactile-pill"
                )}
              >
                <Compass className={cn("h-4 w-4", pathname === "/dashboard" ? "text-white" : "text-[#007DA5]")} />
                <span>Início</span>
              </Link>

              <Link
                href="/schedule"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all border-2",
                  pathname === "/schedule"
                    ? "bg-[#007DA5] text-white border-slate-950 dark:border-slate-700 shadow-tactile-pill"
                    : "border-transparent text-slate-800 dark:text-slate-200 hover:bg-[#007DA5]/10 hover:border-slate-950/30 hover:shadow-tactile-pill"
                )}
              >
                <Calendar className={cn("h-4 w-4", pathname === "/schedule" ? "text-white" : "text-[#007DA5]")} />
                <span>Programação & Cronograma</span>
              </Link>

              <Link
                href="/announcements"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition-all border-2",
                  pathname === "/announcements"
                    ? "bg-[#007DA5] text-white border-slate-950 dark:border-slate-700 shadow-tactile-pill"
                    : "border-transparent text-slate-800 dark:text-slate-200 hover:bg-[#007DA5]/10 hover:border-slate-950/30 hover:shadow-tactile-pill"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Megaphone className={cn("h-4 w-4", pathname === "/announcements" ? "text-white" : "text-[#FC4E6D]")} />
                  <span>Lembretes & Comunicados</span>
                </div>
                {totalUnread > 0 && (
                  <span className={cn(
                    "rounded-full text-[10px] font-black px-2 py-0.5",
                    pathname === "/announcements" ? "bg-white text-slate-950" : "bg-[#FC4E6D] text-white"
                  )}>
                    {totalUnread}
                  </span>
                )}
              </Link>

              {canSeeCounselorPanel && (
                <Link
                  href="/consultor"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all border-2",
                    pathname === "/consultor"
                      ? "bg-[#007DA5] text-white border-slate-950 dark:border-slate-700 shadow-tactile-pill"
                      : "border-transparent text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-800/30 hover:shadow-tactile-pill"
                  )}
                >
                  <Building2 className={cn("h-4 w-4", pathname === "/consultor" ? "text-white" : "text-[#7209B7]")} />
                  <span>Painel do Consultor</span>
                </Link>
              )}

              {canAccessFullAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all border-2",
                    pathname.startsWith("/admin")
                      ? "bg-[#007DA5] text-white border-slate-950 dark:border-slate-700 shadow-tactile-pill"
                      : "border-transparent text-[#007DA5] dark:text-cyan-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 hover:border-[#007DA5]/30 hover:shadow-tactile-pill"
                  )}
                >
                  <Shield className={cn("h-4 w-4", pathname.startsWith("/admin") ? "text-white" : "text-[#007DA5]")} />
                  <span>Painel de Gestão</span>
                </Link>
              )}
            </div>

            {/* Logout action in mobile menu */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                <span>{signingOut ? "Saindo..." : "Sair da conta"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
