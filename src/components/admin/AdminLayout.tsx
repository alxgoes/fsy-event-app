"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Stethoscope,
  Megaphone,
  Truck,
  Shield,
  ShieldAlert,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Users,
  Building2,
  Camera,
  Compass,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useProfile, ROLE_LABELS, UserRole } from "@/lib/supabase/useProfile";
import { createClient } from "@/lib/supabase/client";
import { FsyTempleMark, FsyFloatingLetters } from "@/components/brand/FsyLogo";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { GooeyButton } from "@/components/ui/GooeyButton";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeRole?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  allowedRoles?: UserRole[];
}

const navigationItems: NavItem[] = [
  {
    name: "Visão Geral",
    href: "/admin",
    icon: LayoutDashboard,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Auditoria dos Consultores",
    href: "/admin/counselor-audit",
    icon: ShieldAlert,
    badge: "Liderança",
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Registros & Atendimentos",
    href: "/admin/medical",
    icon: Stethoscope,
    badge: "Saúde & Inclusão",
    allowedRoles: ["medico", "coordenador", "casal_diretor", "logistica"],
  },
  {
    name: "Companhias do FSY",
    href: "/admin/companies",
    icon: Building2,
    badge: "Novo",
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Programação Oficial",
    href: "/admin/schedule",
    icon: Calendar,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Logística & Ônibus",
    href: "/admin/logistics",
    icon: Truck,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Comunicados Oficiais",
    href: "/admin/announcements",
    icon: Megaphone,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Fotos & Mídia",
    href: "/admin/media",
    icon: Camera,
    badge: "Mídia",
    allowedRoles: ["midia", "casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Gestão de Usuários",
    href: "/admin/users",
    icon: Users,
    badge: "Admin",
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
];

export function AdminLayout({ children, activeRole = "coordenador" }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { profile, loading } = useProfile();
  const shouldReduceMotion = useReducedMotion();

  const currentRole = (profile?.role || activeRole) as UserRole;
  const displayName = profile?.full_name ?? "Equipe";
  const displayEmail = profile?.email ?? "";
  const avatarLetter = profile?.full_name?.charAt(0)?.toUpperCase() ?? "A";
  const roleLabel = ROLE_LABELS[currentRole as keyof typeof ROLE_LABELS] || currentRole;

  // Media role isolation
  useEffect(() => {
    if (!loading && currentRole === "midia" && pathname !== "/admin/media") {
      router.replace("/admin/media");
    }
  }, [currentRole, pathname, router, loading]);

  // Multidisciplinary Team isolation: restricted to /admin/medical
  useEffect(() => {
    if (!loading && currentRole === "medico" && pathname !== "/admin/medical" && pathname !== "/admin") {
      router.replace("/admin/medical");
    }
  }, [currentRole, pathname, router, loading]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
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

  const roleLabels: Record<string, { label: string; color: string }> = {
    medico: { label: "Equipe Multidisciplinar", color: "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
    logistica: { label: "Logística", color: "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" },
    midia: { label: "Equipe de Mídia", color: "bg-pink-50 dark:bg-pink-950/70 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800" },
    coordenador: { label: "Coordenação Geral", color: "bg-purple-50 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
    casal_diretor: { label: "Casal Diretor", color: "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
  };

  const isMaster = currentRole === "casal_diretor" || currentRole === "coordenador" || currentRole === "logistica";

  // Filter navigation items by active user role
  const visibleNav = navigationItems.filter((item) => {
    if (isMaster) return true; // Master admins have access to ALL panels
    if (currentRole === "midia") return item.href === "/admin/media";
    if (currentRole === "medico") return item.href === "/admin/medical";
    if (!item.allowedRoles) return true;
    return item.allowedRoles.includes(currentRole);
  });

  if (loading) {
    return (
      <LoadingScreen
        title="Painel Administrativo FSY"
        message="Verificando permissões e credenciais de acesso..."
        submessage="Sessão Ribeirão Preto 2"
      />
    );
  }

  return (
    <div className="min-h-screen bg-fsy-watermark flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 sm:px-6 flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-6 h-9 sm:w-7 sm:h-10 shrink-0 rounded-t-full rounded-b-lg bg-[#EFEFE7] dark:bg-slate-800 p-0.5 border-2 border-slate-900/50 dark:border-slate-700 shadow-xs flex items-center justify-center overflow-hidden">
              <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
            </div>
            <FsyFloatingLetters size="xs" className="hidden sm:inline-flex" />
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-heading font-black text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-none">
                  {currentRole === "midia"
                    ? "Painel de Mídia"
                    : currentRole === "medico"
                    ? "Equipe Multidisciplinar"
                    : "Painel de Gestão"}
                </span>
                <span className="rounded-md bg-[#FFE48A] px-1 py-0.2 text-[10px] font-black uppercase text-amber-950 border border-amber-500/40 hidden xs:inline">
                  2027
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Header Right: Theme Toggle, Role Badge, User Info Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          <Badge
            variant="outline"
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold ${roleLabels[currentRole]?.color || "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200"}`}
          >
            <Shield className="h-3 w-3" />
            <span>{roleLabels[currentRole]?.label || roleLabel}</span>
          </Badge>

          <GooeyButton
            variant="tactile-dark"
            size="sm"
            href="/dashboard"
            icon={<Compass className="h-3.5 w-3.5" />}
            iconColor="text-[#007DA5] dark:text-cyan-400"
            className="hidden md:inline-flex"
          >
            Portal Jovem
          </GooeyButton>

          {/* Interactive Profile Dropdown (Mobile & Desktop) */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 p-1.5 sm:px-2.5 sm:py-1.5 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm cursor-pointer"
              aria-label="Menu do usuário"
            >
              {loading ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-700">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#06D6A0] text-slate-950 font-black text-xs border border-slate-900 shrink-0">
                  {avatarLetter}
                </div>
              )}

              <div className="hidden sm:block text-left text-xs leading-tight">
                <p className="font-black text-slate-900 dark:text-white truncate max-w-[90px]">
                  {loading ? "..." : displayName.split(" ")[0]}
                </p>
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {roleLabels[currentRole]?.label || roleLabel}
                </p>
              </div>

              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </motion.button>

            {/* Dropdown Menu Popover */}
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#06D6A0] text-slate-950 font-black text-base border-2 border-slate-900 dark:border-slate-700 shrink-0">
                        {avatarLetter}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                          {displayName}
                        </p>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate">
                          {displayEmail}
                        </p>
                        <span className="inline-flex mt-0.5 items-center rounded-md bg-sky-100 dark:bg-sky-950 px-1.5 py-0.5 text-xs font-black text-[#007DA5] dark:text-cyan-300">
                          {roleLabels[currentRole]?.label || roleLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    {/* Portal do Jovem (Primary Action) */}
                    <Link
                      href="/dashboard"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-black text-[#007DA5] hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Compass className="h-4 w-4" />
                        <span>Portal do Jovem</span>
                      </div>
                      <span className="text-xs font-black bg-[#007DA5] text-white px-2 py-0.5 rounded-md">
                        Acessar
                      </span>
                    </Link>

                    {/* Painel de Gestão (Current Active) */}
                    <Link
                      href="/admin"
                      onClick={() => setDropdownOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Shield className="h-4 w-4 text-slate-400" />
                      <span>Painel de Gestão (Início)</span>
                    </Link>

                    <div className="mx-3 my-1.5 border-t border-slate-100 dark:border-slate-800" />

                    {/* Sign Out */}
                    <button
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-60 text-left"
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
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-16 lg:static lg:pt-0 transition-all duration-200 ease-in-out ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="flex h-full flex-col justify-between p-4">
            <div className="space-y-4">
              {/* Event Context Pill in Sidebar */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-[#EFEFE7]/50 dark:bg-slate-800/60 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-[#007DA5]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    FSY Ribeirão Preto 2
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {currentRole === "midia"
                    ? "Ambiente exclusivo da Equipe de Mídia."
                    : currentRole === "medico"
                    ? "Ambiente exclusivo da Equipe Multidisciplinar (Saúde & Atendimentos)."
                    : "Ambiente de coordenação, companhias, saúde, transporte e comunicados."}
                </p>
              </div>

              {/* Quick Youth Portal Button in Sidebar */}
              <GooeyButton
                variant="primary"
                size="sm"
                href="/dashboard"
                onClick={() => setIsSidebarOpen(false)}
                icon={<Compass className="h-4 w-4" />}
                iconColor="text-white"
                className="w-full justify-center"
              >
                Ir para o Portal Jovem
              </GooeyButton>

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
                      className={`relative z-10 flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-black transition-all duration-200 border-2 cursor-pointer ${
                        isActive
                          ? "text-white border-transparent"
                          : "border-transparent text-slate-600 dark:text-slate-300 hover:border-slate-900/30 dark:hover:border-slate-700 hover:bg-[#007DA5]/10 hover:text-[#007DA5] dark:hover:text-[#01B6D1] hover:shadow-tactile-pill hover:-translate-y-0.5 active:translate-y-0"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId={shouldReduceMotion ? undefined : "adminActiveNavPill"}
                          className="absolute inset-0 bg-[#007DA5] rounded-2xl border-2 border-slate-950 dark:border-slate-700 shadow-tactile-pill -z-10"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                        />
                      )}
                      <div className="flex items-center gap-3 relative z-10">
                        <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`relative z-10 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
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
                <span>Sessão:</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  05-10 Fev 2027
                </span>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{signingOut ? "Saindo..." : "Sair da conta"}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Administrative Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-fsy-watermark transition-colors">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
