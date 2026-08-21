"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Stethoscope,
  Megaphone,
  Truck,
  Shield,
  Menu,
  X,
  LogOut,
  ExternalLink,
  LayoutDashboard,
  Users,
  Camera,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useProfile, ROLE_LABELS } from "@/lib/supabase/useProfile";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeRole?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const navigationItems: NavItem[] = [
  {
    name: "Visão Geral",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    name: "Registros Médicos",
    href: "/admin/medical",
    icon: Stethoscope,
    badge: "Confidencial",
  },
  {
    name: "Programação Oficial",
    href: "/admin/schedule",
    icon: Calendar,
  },
  {
    name: "Logística & Ônibus",
    href: "/admin/logistics",
    icon: Truck,
  },
  {
    name: "Comunicados Oficiais",
    href: "/admin/announcements",
    icon: Megaphone,
  },
  {
    name: "Fotos & Mídia",
    href: "/admin/media",
    icon: Camera,
    badge: "Mídia",
  },
  {
    name: "Gestão de Usuários",
    href: "/admin/users",
    icon: Users,
    badge: "Admin",
  },
];

export function AdminLayout({ children, activeRole = "coordenador" }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { profile, loading } = useProfile();

  const currentRole = profile?.role || activeRole;

  // Media role isolation: if role is 'midia' and pathname is not '/admin/media', redirect immediately
  useEffect(() => {
    if (!loading && currentRole === "midia" && pathname !== "/admin/media") {
      router.replace("/admin/media");
    }
  }, [currentRole, pathname, router, loading]);

  const roleLabels: Record<string, { label: string; color: string }> = {
    medico: { label: "Equipe Médica", color: "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
    logistica: { label: "Logística", color: "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
    midia: { label: "Equipe de Mídia", color: "bg-pink-50 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800" },
    coordenador: { label: "Coordenação Geral", color: "bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
    casal_diretor: { label: "Casal Diretor", color: "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  };

  // If role is 'midia', ONLY show media tools in navigation
  const visibleNav = currentRole === "midia"
    ? navigationItems.filter((i) => i.href === "/admin/media")
    : navigationItems;

  return (
    <div className="min-h-screen bg-fsy-watermark flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#4361EE] text-white flex items-center justify-center font-black text-xs border border-slate-900 dark:border-slate-700 shadow-sm">
              FSY
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-sm text-slate-900 dark:text-white">
                  {currentRole === "midia" ? "Painel de Mídia Oficial" : "Painel de Gestão"}
                </span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  Sessão RP 2 (2027)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Header Right: Theme Toggle, Role Badge, User Info, Youth Portal Link */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Badge
            variant="outline"
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${roleLabels[currentRole]?.color || "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"}`}
          >
            <Shield className="h-3 w-3" />
            <span>{roleLabels[currentRole]?.label || ROLE_LABELS[currentRole as keyof typeof ROLE_LABELS] || currentRole}</span>
          </Badge>

          <Link
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#4361EE]" />
            <span>Portal Jovem</span>
          </Link>

          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
            <Avatar className="h-8 w-8 border border-slate-200 dark:border-slate-700">
              <AvatarFallback className="bg-slate-900 dark:bg-slate-700 text-white text-xs font-black">
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "FSY"}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left text-xs leading-tight">
              <p className="font-bold text-slate-900 dark:text-white">
                {profile?.full_name ? profile.full_name.split(" ")[0] : "Equipe"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {roleLabels[currentRole]?.label || "FSY RP 2"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-16 lg:static lg:pt-0 transition-all duration-200 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex h-full flex-col justify-between p-4">
            <div className="space-y-6">
              {/* Event Context Pill in Sidebar */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-[#4361EE]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    FSY Ribeirão Preto 2
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {currentRole === "midia"
                    ? "Ambiente exclusivo da Equipe de Mídia Oficial."
                    : "Ambiente de coordenação, saúde, transporte e comunicados."}
                </p>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                  {currentRole === "midia" ? "Menu de Mídia" : "Menu Administrativo"}
                </p>
                {visibleNav.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold transition-all ${
                        isActive
                          ? "bg-slate-900 text-white dark:bg-[#4361EE] dark:text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? "bg-emerald-500 text-white"
                              : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-2">
                <span>Status:</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  05-10 Fev 2027
                </span>
              </div>
              <Link
                href="/login"
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Trocar Usuário / Sair</span>
              </Link>
            </div>
          </div>
        </aside>

        {/* Main Administrative Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50/80 dark:bg-slate-950 transition-colors">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
