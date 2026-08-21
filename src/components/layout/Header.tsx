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
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isStaff, ROLE_LABELS } from "@/lib/supabase/useProfile";


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

export function Header() {
  const router = useRouter();
  const { profile, loading } = useProfile();

  const [appointments, setAppointments] = useState<AppointmentNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [markingSeenId, setMarkingSeenId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Fetch appointments for this user to power notifications bell
  const loadNotifications = useCallback(async () => {
    if (!profile) return;
    try {
      const res = await fetch(`/api/medical/appointments?_t=${Date.now()}`);
      if (res.ok) {
        const json = await res.json();
        const allAppts: AppointmentNotification[] = json.data ?? [];

        // Filter appointments for the current user (by user_id or matching full_name)
        const myAppts = allAppts.filter((a) => {
          if (a.user_id && profile.id) return a.user_id === profile.id;
          return a.youth_name.toLowerCase().trim() === profile.full_name.toLowerCase().trim();
        });

        setAppointments(myAppts);
      }
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      loadNotifications();
    }
  }, [profile, loadNotifications]);

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

  const handleMarkAsSeen = async (apptId: string) => {
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
      }
    } catch (err) {
      console.error("Error marking appointment as seen:", err);
    } finally {
      setMarkingSeenId(null);
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

  // Count unread appointments
  const unreadAppointments = appointments.filter((a) => !a.is_seen && a.status === "agendado");
  const totalUnread = unreadAppointments.length;

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
                        Lembretes & Atendimentos
                      </h3>
                    </div>
                    {totalUnread > 0 ? (
                      <span className="rounded-md bg-[#FF6B8B] text-white text-[10px] font-black px-2 py-0.5">
                        {totalUnread} novo(s)
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400">
                        Tudo em dia
                      </span>
                    )}
                  </div>

                  {/* Notifications Content List */}
                  <div className="max-h-80 overflow-y-auto p-3 space-y-2.5">
                    {appointments.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 dark:text-slate-500">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40 text-emerald-500" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Nenhum compromisso pendente
                        </p>
                        <p className="text-[11px] mt-0.5">
                          Quando houver um agendamento ou recado para você, ele aparecerá aqui.
                        </p>
                      </div>
                    ) : (
                      appointments.map((appt) => {
                        const isSeen = appt.is_seen;
                        const isMarking = markingSeenId === appt.id;

                        return (
                          <div
                            key={appt.id}
                            className={`rounded-2xl border-2 p-3.5 transition-all ${
                              !isSeen
                                ? "border-slate-900 dark:border-slate-700 bg-amber-50/70 dark:bg-amber-950/30 shadow-brutal-sm"
                                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 text-[10px] font-black uppercase">
                                <Stethoscope className="h-3 w-3" />
                                Atendimento Multidisciplinar
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

                            {appt.notes && (
                              <p className="text-[11px] italic text-slate-500 mt-1">
                                Obs: {appt.notes}
                              </p>
                            )}

                            {/* Action: Marcar como Visto */}
                            <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                              {!isSeen ? (
                                <button
                                  onClick={() => handleMarkAsSeen(appt.id)}
                                  disabled={isMarking}
                                  className="inline-flex items-center gap-1 rounded-xl bg-[#06D6A0] hover:bg-emerald-400 text-slate-950 text-[11px] font-black px-2.5 py-1 border border-slate-900 shadow-sm transition-all cursor-pointer"
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
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Visualizado
                                </span>
                              )}

                              <span className="text-[10px] font-bold text-slate-400">
                                {appt.status === "realizado" ? "Realizado" : "Agendado"}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#06D6A0] text-slate-950 font-black text-base border-2 border-slate-900 dark:border-slate-700">
                        {avatarLetter}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {displayName}
                        </p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                          {profile?.email ?? ""}
                        </p>
                        <span className="inline-flex mt-0.5 items-center rounded-md bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 text-[10px] font-black text-[#4361EE]">
                          {roleLabel}
                          {displayCompany && ` • ${displayCompany}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    {/* Portal do Jovem */}
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      Portal do Jovem
                    </Link>

                    {/* Counselor Panel link for Consultores and Master Admins */}
                    {profile && (profile.role === "consultor" || profile.role === "coordenador" || profile.role === "casal_diretor" || profile.role === "logistica") && (
                      <Link
                        href="/consultor"
                        onClick={() => setDropdownOpen(false)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-black text-[#4361EE] hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-left"
                      >
                        <Building2 className="h-4 w-4 text-[#4361EE]" />
                        Painel do Consultor
                        {displayCompany && (
                          <span className="ml-auto text-[10px] font-black bg-blue-100 dark:bg-blue-950 px-1.5 py-0.5 rounded text-[#4361EE]">
                            {displayCompany}
                          </span>
                        )}
                      </Link>
                    )}

                    {/* Admin Panel — for staff */}
                    {profile && isStaff(profile.role) && profile.role !== "consultor" && (
                      <>
                        <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-800" />
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-[#4361EE] hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                        >
                          <Shield className="h-4 w-4" />
                          Painel de Gestão
                          <span className="ml-auto rounded-md bg-[#4361EE] text-white text-[10px] font-black px-1.5 py-0.5">
                            {roleLabel}
                          </span>
                        </Link>
                      </>
                    )}

                    <div className="mx-3 my-1 border-t border-slate-100 dark:border-slate-800" />

                    {/* Sign Out */}
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-60"
                    >
                      {signingOut ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      {signingOut ? "Saindo..." : "Sair da conta"}
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
