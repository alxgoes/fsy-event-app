"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Shield,
  LogOut,
  User,
  ChevronDown,
  Users,
  Loader2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { useProfile, isStaff, ROLE_LABELS } from "@/lib/supabase/useProfile";

interface HeaderProps {
  unreadCount?: number;
}

export function Header({ unreadCount = 0 }: HeaderProps) {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [notifications, setNotifications] = useState(unreadCount);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

          {/* Notification Bell */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92, y: 2 }}
            onClick={() => setNotifications(0)}
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            aria-label="Notificações"
          >
            <Bell className="h-5 w-5 text-slate-800 dark:text-slate-200" />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6B8B] text-[10px] font-black text-white border-2 border-slate-900 animate-bounce">
                {notifications}
              </span>
            )}
          </motion.button>

          {/* User Avatar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDropdownOpen((o) => !o)}
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
                    {/* Meu Perfil */}
                    <button
                      onClick={() => { setDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      <User className="h-4 w-4 text-slate-400" />
                      Meu Perfil
                    </button>

                    {/* My Company */}
                    {displayCompany && (
                      <button
                        onClick={() => { setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <Users className="h-4 w-4 text-slate-400" />
                        Minha Companhia: <span className="font-black ml-1">{displayCompany}</span>
                      </button>
                    )}

                    {/* Admin Panel — only visible to staff */}
                    {profile && isStaff(profile.role) && (
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
