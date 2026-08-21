"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isStaff, isMasterAdmin, ROLE_LABELS } from "@/lib/supabase/useProfile";

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

export function Header() {
  const router = useRouter();
  const { profile, loading } = useProfile();

  const [appointments, setAppointments] = useState<AppointmentNotification[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementNotification[]>([]);
  const [readAnnouncements, setReadAnnouncements] = useState<string[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  const displayName = profile?.full_name ?? "Carregando...";
  const displayCompany = profile?.company_id ?? null;
  const avatarLetter = profile?.full_name?.charAt(0)?.toUpperCase() ?? "?";
  const role = profile?.role ?? "jovem";
  const roleLabel = ROLE_LABELS[role];
  const userIsStaff = isStaff(role);
  const userIsMaster = isMasterAdmin(role);
  const canSeeCounselorPanel = userIsMaster || role === "consultor";

  // Count unread items
  const unreadAppointments = appointments.filter((a) => !a.is_seen && a.status === "agendado");
  const unreadAnnouncements = announcements.filter((a) => !readAnnouncements.includes(a.id));
  const totalUnread = unreadAppointments.length + unreadAnnouncements.length;

  return (
    <header className="sticky top-0 z-40 border-b-2 border-slate-900 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-3 sm:px-8 transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Brand Logo & Title */}
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <motion.div
            whileHover={{ rotate: 8, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#4361EE] text-white font-black text-lg border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm cursor-pointer"
          >
            FSY
          </motion.div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Ribeirão Preto 2
              </span>
              <span className="rounded-md bg-[#FFD166] px-1.5 py-0.5 text-[10px] font-black uppercase text-slate-950 border border-slate-900">
                2027
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              Portal do Jovem • 14 a 18 anos
            </p>
          </div>
        </Link>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle (Dark / Light Mode) */}
          <ThemeToggle />

          {/* Functional Notification Bell with Popover */}
          <div className="relative" ref={notificationsRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92, y: 2 }}
              onClick={() => {
                setNotificationsOpen((o) => !o);
                setDropdownOpen(false);
              }}
              className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              aria-label="Lembretes e Notificações"
            >
              <Bell className="h-5 w-5 text-slate-800 dark:text-slate-200" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6B8B] text-[10px] font-black text-white border-2 border-slate-900 animate-bounce">
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
                  className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-lg overflow-hidden z-50"
                >
                  {/* Popover Header */}
                  <div className="px-4 py-3 border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-[#4361EE]" />
                      <h3 className="font-heading text-sm font-black text-slate-900 dark:text-white">
                        Lembretes & Comunicados
                      </h3>
                    </div>
                    {totalUnread > 0 ? (
                      <span className="rounded-md bg-[#FF6B8B] text-white text-[10px] font-black px-2 py-0.5">
                        {totalUnread} pendente(s)
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400">
                        Tudo em dia
                      </span>
                    )}
                  </div>

                  {/* Notifications Content List */}
                  <div className="max-h-84 overflow-y-auto p-3 space-y-2.5">
                    {appointments.length === 0 && announcements.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Nenhum lembrete ou agendamento
                        </p>
                        <p className="text-[11px] mt-0.5">
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
                                    <span className="h-2 w-2 rounded-full bg-[#FF6B8B] animate-ping" />
                                  )}
                                </div>

                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
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

                              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                {ann.content}
                              </p>

                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-[11px]">
                                <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">
                                  Por: <strong>{author}</strong>
                                </span>

                                {!isRead ? (
                                  <button
                                    onClick={() => handleMarkAnnouncementAsRead(ann.id)}
                                    className="inline-flex items-center gap-1 rounded-xl bg-[#06D6A0] hover:bg-emerald-400 text-slate-950 text-[10px] font-black px-2 py-0.5 border border-slate-900 shadow-sm transition-all cursor-pointer"
                                  >
                                    <Check className="h-3 w-3" />
                                    <span>Marcar como lido</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
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
                                  ? "border-slate-900 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-brutal-sm"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-black uppercase">
                                  <Stethoscope className="h-3 w-3" />
                                  Saúde & Inclusão
                                </span>

                                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
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

                              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                                Com: <strong>{appt.professional_name}</strong>
                              </p>

                              {/* Action: Marcar como Visto */}
                              <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                                {!isSeen ? (
                                  <button
                                    onClick={() => handleMarkAppointmentAsSeen(appt.id)}
                                    disabled={isMarking}
                                    className="inline-flex items-center gap-1 rounded-xl bg-[#06D6A0] hover:bg-emerald-400 text-slate-950 text-[10px] font-black px-2 py-0.5 border border-slate-900 shadow-sm transition-all cursor-pointer"
                                  >
                                    {isMarking ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Check className="h-3 w-3" />
                                    )}
                                    <span>Marcar como visto</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Visualizado
                                  </span>
                                )}

                                <span className="text-[10px] font-bold text-slate-400">
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
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 text-xs font-black text-[#4361EE] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span>Ver mural de lembretes completo</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User Avatar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setDropdownOpen((o) => !o);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-2.5 py-1.5 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm cursor-pointer"
              aria-label="Menu do usuário"
            >
              {loading ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#06D6A0] text-slate-950 font-black text-xs border border-slate-900">
                  {avatarLetter}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                  {loading ? "..." : displayName.split(" ")[0]}
                </p>
                <p className="text-[10px] font-bold text-[#4361EE] dark:text-blue-400">
                  {loading ? "Carregando" : displayCompany ?? roleLabel}
                </p>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
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
                  className="absolute right-0 top-full mt-2 w-64 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-md overflow-hidden z-50"
                >
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#06D6A0] text-slate-950 font-black text-sm border-2 border-slate-900 shadow-brutal-sm">
                        {avatarLetter}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {displayName}
                        </p>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-[#4361EE]/10 text-[#4361EE] dark:text-blue-300 text-[10px] font-black uppercase tracking-wider">
                          {roleLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Links */}
                  <div className="p-2 space-y-1">
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      Meu Dashboard
                    </Link>

                    <Link
                      href="/announcements"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Megaphone className="h-4 w-4 text-[#FF6B8B]" />
                      Lembretes & Comunicados
                    </Link>

                    {/* Counselor Panel Link */}
                    {canSeeCounselorPanel && (
                      <Link
                        href="/consultor"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        <Building2 className="h-4 w-4 text-[#7209B7]" />
                        <span>Painel do Consultor</span>
                      </Link>
                    )}

                    {/* Staff / Admin Management Link */}
                    {userIsStaff && (
                      <Link
                        href="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-[#4361EE] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        <Shield className="h-4 w-4 text-[#4361EE]" />
                        <span>Painel de Gestão</span>
                      </Link>
                    )}
                  </div>

                  {/* Sign Out */}
                  <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
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
        </div>
      </div>
    </header>
  );
}
