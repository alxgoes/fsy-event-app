"use client";
import { startTransition } from "react";


import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Stethoscope,
  Megaphone,
  Truck,
  ShieldAlert,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Users,
  Building2,
  Camera,
  Compass,
  ClipboardList,
  Smartphone,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useProfile, ROLE_LABELS, UserRole } from "@/lib/supabase/useProfile";
import { Avatar, avatarInitials } from "@/components/profile/Avatar";
import { useOwnPhoto } from "@/lib/profile-photo/useOwnPhoto";
import { createClient } from "@/lib/supabase/client";
import { FsyTempleMark, FsyFloatingLetters } from "@/components/brand/FsyLogo";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import styles from "./AdminLayout.module.css";
import { EVENT_DATES } from "@/lib/event/identity";

interface AdminLayoutProps {
  children: React.ReactNode;
  activeRole?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  allowedRoles?: UserRole[];
}

const navigationItems: NavItem[] = [
  {
    name: "Visão geral",
    href: "/admin",
    icon: LayoutDashboard,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Atividade dos consultores",
    href: "/admin/counselor-audit",
    icon: ShieldAlert,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Saúde e inclusão",
    href: "/admin/medical",
    icon: Stethoscope,
    allowedRoles: ["medico", "coordenador", "casal_diretor", "logistica"],
  },
  {
    name: "Companhias",
    href: "/admin/companies",
    icon: Building2,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Programação",
    href: "/admin/schedule",
    icon: Calendar,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Logística",
    href: "/admin/logistics",
    icon: Truck,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Avisos",
    href: "/admin/announcements",
    icon: Megaphone,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Fotos",
    href: "/admin/media",
    icon: Camera,
    allowedRoles: ["midia", "casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Inscrições",
    href: "/admin/inscricoes",
    icon: ClipboardList,
    allowedRoles: ["casal_diretor", "coordenador", "logistica"],
  },
  {
    name: "Contas e acessos",
    href: "/admin/users",
    icon: Users,
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
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const { profile, loading } = useProfile();
  const { state: ownPhoto } = useOwnPhoto(Boolean(profile?.id));
  const shouldReduceMotion = useReducedMotion();

  const currentRole = (profile?.role || activeRole) as UserRole;
  const displayName = profile?.full_name ?? "Equipe";
  const displayEmail = profile?.email ?? "";
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

  // Keep keyboard focus inside the mobile drawer and restore it on close.
  useEffect(() => {
    if (!isSidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = sidebarRef.current;
    const trigger = sidebarTriggerRef.current;
    const focusFirstControl = () => {
      drawer?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus({ preventScroll: true });
    };
    const focusFrame = window.requestAnimationFrame(focusFirstControl);
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !drawer?.contains(event.target)) {
        focusFirstControl();
      }
    };
    const handleFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!drawer?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setIsSidebarOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    document.addEventListener("keydown", handleFocus);
    document.addEventListener("focusin", containFocus);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleFocus);
      document.removeEventListener("focusin", containFocus);
      desktop.removeEventListener("change", closeOnDesktop);
      if (!desktop.matches) trigger?.focus();
    };
  }, [isSidebarOpen]);

  // Close sidebar on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsSidebarOpen(false);
        setDropdownOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSidebarOpen]);

  // Auto-close sidebar on route change
  useEffect(() => {
    startTransition(() => { setIsSidebarOpen(false); });
  }, [pathname]);

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
    coordenador: { label: "Coordenação Geral", color: "bg-sky-50 dark:bg-sky-950/70 text-[#005E7C] dark:text-cyan-300 border-sky-200 dark:border-sky-800" },
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
    <div className="fsy-admin min-h-screen max-w-full overflow-x-hidden bg-fsy-watermark flex flex-col font-sans transition-colors duration-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 flex min-h-16 min-w-0 max-w-full items-center justify-between gap-2 border-b border-slate-200 bg-white px-2.5 py-2 transition-colors dark:border-slate-800 dark:bg-slate-900 sm:px-6">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 mr-2">
          <button
            ref={sidebarTriggerRef}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Alternar menu lateral"
            aria-expanded={isSidebarOpen}
            aria-controls="admin-navigation"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
            <div className="flex h-[36px] w-[24px] shrink-0 items-center justify-center overflow-hidden rounded-b-lg rounded-t-full border border-slate-200 bg-[#EFEFE7] p-0.5 shadow-xs dark:border-slate-700 dark:bg-slate-800 sm:h-[40px] sm:w-[28px]">
              <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
            </div>
            <FsyFloatingLetters size="xs" className="hidden lg:inline-flex shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <span className="font-heading font-bold text-sm text-slate-900 dark:text-white truncate">
                  {currentRole === "midia"
                    ? "Painel de Mídia"
                    : currentRole === "medico"
                    ? "Equipe Multidisciplinar"
                    : "Painel de Gestão"}
                </span>
                <span className="rounded-md bg-[#FFE48A] px-1 py-0.2 text-xs font-bold uppercase text-amber-950 border border-amber-500/40 hidden lg:inline shrink-0">
                  2027
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Foto aprovada e acesso ao perfil, sem comprimir o título ou o menu. */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <ThemeToggle className="min-h-[44px] min-w-[44px]" />

          {/* Interactive Profile Dropdown (Mobile & Desktop) */}
          <div className="relative" ref={dropdownRef}>
            <motion.button
              type="button"
              data-admin-profile-trigger
              whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/30 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              aria-label={`Minha conta — ${avatarInitials(displayName)}`}
              aria-expanded={dropdownOpen}
              aria-controls="admin-profile-popover"
            >
              <Avatar name={displayName} src={ownPhoto?.approved_url} size={32} />
            </motion.button>

            {/* Dropdown Menu Popover */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  id="admin-profile-popover"
                  role="region"
                  aria-label="Minha conta"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: shouldReduceMotion ? 0.12 : 0.15 }}
                  className={`${styles.profilePopover} absolute right-0 top-full z-50 mt-2 rounded-2xl border border-slate-200 bg-white shadow-float dark:border-slate-700 dark:bg-slate-900`}
                >
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b-2 border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <div className="flex min-w-0 flex-col items-start gap-3">
                      <Avatar name={displayName} src={ownPhoto?.approved_url} size={48} />
                      <div className="min-w-0 max-w-full space-y-1 [overflow-wrap:anywhere]">
                        <p className="break-words text-sm font-semibold text-slate-900 dark:text-white">
                          {displayName}
                        </p>
                        <p className="break-words text-sm text-slate-600 dark:text-slate-300">
                          {displayEmail}
                        </p>
                        <p className="break-words text-sm font-medium text-[#005E7C] dark:text-cyan-300">
                          {roleLabels[currentRole]?.label || roleLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <Link
                      href="/mais"
                      onClick={() => setDropdownOpen(false)}
                      className="fsy-action-link flex min-h-[44px] min-w-0 items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words">Meu perfil e foto</span>
                    </Link>
                    <Link
                      href="/instalar"
                      onClick={() => setDropdownOpen(false)}
                      className="fsy-action-link flex min-h-[44px] min-w-0 items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Smartphone className="h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" />
                      <span className="min-w-0 break-words">Instalar o app</span>
                    </Link>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Mobile Backdrop with Blur */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden cursor-pointer"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <div className="flex flex-1 min-w-0 max-w-full lg:pl-72">
        {/* Sidebar Navigation Drawer */}
        <aside
          ref={sidebarRef}
          id="admin-navigation"
          aria-label="Navegação da gestão"
          role={isSidebarOpen ? "dialog" : undefined}
          aria-modal={isSidebarOpen || undefined}
          className={`${styles.sidebar} ${isSidebarOpen ? styles.open : ""}`}
        >
          {/* Mobile Drawer Top Header with Close Button */}
          <div className="flex items-center justify-between p-3.5 border-b border-slate-200 dark:border-slate-800 lg:hidden bg-slate-50/80 dark:bg-slate-800/40">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-[32px] w-[20px] shrink-0 items-center justify-center overflow-hidden rounded-b-md rounded-t-full border border-slate-900/50 bg-[#EFEFE7] p-0.5 shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
              </div>
              <span className="min-w-0 break-words font-heading text-xs font-bold text-slate-900 dark:text-white">
                Painel de Gestão
              </span>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
              aria-label="Fechar menu lateral"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Container with Smooth Native Touch Scroll */}
          <div className={`${styles.scroll} flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col justify-between gap-6`}>
            <div className="space-y-4">
              <div className="px-3 pt-2 pb-1">
                <p className="font-heading text-lg font-bold leading-tight text-slate-900 dark:text-white">FSY Ribeirão Preto 2</p>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{EVENT_DATES}</p>
              </div>

              <Link href="/dashboard" onClick={() => setIsSidebarOpen(false)} className={"fsy-action-link " + (styles.portal)}>
                <Compass className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span>Portal Jovem</span>
              </Link>

              <nav aria-label="Menu administrativo" className="space-y-1.5">
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
                      aria-current={isActive ? "page" : undefined}
                      className={"fsy-action-link " + (`${styles.navLink} ${isActive ? styles.active : ""}`)}
                    >
                      {isActive && (
                        <motion.div
                          layoutId={shouldReduceMotion ? undefined : "adminActiveNavPill"}
                          className={styles.activePill}
                          transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 34 }}
                        />
                      )}
                      <div className="flex items-center gap-3 relative z-10">
                        <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                        <span>{item.name}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-2 mt-auto">
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className={styles.signOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{signingOut ? "Saindo..." : "Sair da conta"}</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Administrative Content Area */}
        <main className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8 bg-fsy-watermark transition-colors">
          <div className="mx-auto max-w-7xl w-full min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
