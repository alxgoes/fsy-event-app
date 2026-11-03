"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";
import {
  Camera,
  ChevronRight,
  Clock3,
  Download,
  Images,
  LayoutDashboard,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Users,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Avatar } from "@/components/profile/Avatar";
import { useProfile, canAccessAdmin, ROLE_LABELS } from "@/lib/supabase/useProfile";
import { prepareSquarePhoto, useOwnPhoto } from "@/lib/profile-photo/useOwnPhoto";
import { getCompany, type CompanyData } from "@/services/companyService";
import { createClient } from "@/lib/supabase/client";
import { usePwa } from "@/components/pwa/PwaContext";
import { useHydrated } from "@/lib/ui/useHydrated";
import { cn } from "@/lib/utils";

function Row({
  href,
  icon: Icon,
  label,
  hint,
  badge,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/50 dark:active:bg-slate-800"
    >
      <Icon className="h-5 w-5 shrink-0 text-slate-700 dark:text-slate-200" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-slate-950 dark:text-white">{label}</span>
        {hint && <span className="block text-sm text-slate-600 dark:text-slate-300">{hint}</span>}
      </span>
      {badge ? (
        <span className="fsy-figure rounded-full bg-[#FC4E6D] px-2 py-0.5 text-xs font-semibold text-slate-950">{badge}</span>
      ) : null}
      <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="px-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {children}
      </div>
    </section>
  );
}

function AppearancePicker() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const options = [
    { value: "system", label: "Automático", icon: Monitor },
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
  ] as const;
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-[15px] font-medium text-slate-950 dark:text-white">Aparência</p>
      <div role="radiogroup" aria-label="Aparência" className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
        {options.map(({ value, label, icon: Icon }) => {
          const active = hydrated && (theme ?? "system") === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
                active ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-600 dark:text-slate-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhotoEditor({ name }: { name: string }) {
  const { state, busy, error, upload, remove } = useOwnPhoto(true);
  const input = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const shown = state?.status === "pending" ? state.pending_url : state?.approved_url;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLocalError(null);
    try {
      await upload(await prepareSquarePhoto(file));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Não foi possível usar essa foto.");
    }
  }

  return (
    <div className="flex flex-col items-center text-center">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        className="group relative rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/30"
        aria-label={state?.approved_url ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
      >
        <motion.span
          key={shown ?? "none"}
          initial={reduce ? false : { scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 40 }}
          className={cn("block rounded-full", state?.status === "pending" && "opacity-80")}
        >
          <Avatar name={name} src={shown} size={112} ring />
        </motion.span>
        <span className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#FAF8F5] bg-[#007DA5] text-white transition-transform group-active:scale-90 dark:border-slate-950">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </span>
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} tabIndex={-1} />

      {state?.status === "pending" && (
        <div className="mt-3 flex flex-col items-center gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFE48A] px-3 py-1 text-sm font-medium text-slate-950">
            <Clock3 className="h-4 w-4" /> Em análise pelo seu consultor
          </span>
          <button
            type="button"
            onClick={() => remove("pending")}
            disabled={busy}
            className="min-h-11 px-3 text-sm font-medium text-[var(--fsy-link)]"
          >
            Cancelar envio
          </button>
        </div>
      )}
      {state?.status === "rejected" && (
        <p className="mt-3 max-w-xs rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
          Sua última foto não foi aprovada{state.review_note ? `: ${state.review_note}` : "."} Toque na foto para enviar outra.
        </p>
      )}
      {(!state || state.status === "none") && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Toque para adicionar sua foto. Ela aparece depois da aprovação do seu consultor.</p>
      )}
      {(error || localError) && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">
          {error || localError}
        </p>
      )}
    </div>
  );
}

export function MorePage() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const { isInstalled } = usePwa();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !profile) router.push("/login");
  }, [loading, profile, router]);

  useEffect(() => {
    if (!profile?.company_id) return;
    getCompany(profile.company_id).then(({ data }) => setCompany(data));
  }, [profile?.company_id]);

  // Cargos de equipe só aparecem quando o perfil já confirmou o acesso. Jovem nunca vê essas entradas.
  const role = profile?.role ?? "jovem";
  const isCounselorArea = role === "consultor" || role === "coordenador" || role === "casal_diretor" || role === "logistica";
  const isAdmin = role !== "jovem" && canAccessAdmin(role);

  useEffect(() => {
    if (!isCounselorArea) return;
    fetch("/api/profile/photo/reviews", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setPendingReviews((j.data ?? []).length))
      .catch(() => setPendingReviews(0));
  }, [isCounselorArea]);

  async function signOut() {
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push("/login");
  }

  const name = profile?.full_name ?? "";
  const details = [company?.name, profile?.room ? `Quarto ${profile.room}` : null, profile?.stake].filter(Boolean);

  return (
    <div className="min-h-screen pb-28 md:pb-12">
      <Header />
      <main className="mx-auto max-w-xl space-y-6 px-4 pt-6">
        <section aria-label="Meu perfil" className="rounded-3xl bg-white px-4 pb-5 pt-6 dark:bg-slate-900">
          {profile ? (
            <>
              <PhotoEditor name={name} />
              <h1 className="mt-4 text-center font-heading text-2xl font-bold text-slate-950 dark:text-white">{name}</h1>
              <p className="mt-1 text-center text-[15px] text-slate-700 dark:text-slate-200">
                {role === "jovem" ? details.join(" · ") || "Companhia a definir" : ROLE_LABELS[role]}
              </p>
              {role === "jovem" && company?.counselors?.length ? (
                <p className="mt-1 text-center text-sm text-slate-600 dark:text-slate-300">
                  Consultores: {company.counselors.join(" e ")}
                </p>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6" aria-busy>
              <div className="h-28 w-28 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 w-40 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
          )}
        </section>

        <Section title="Evento">
          <Row href="/fotos" icon={Images} label="Fotos" hint="Galeria do evento e Instagram" />
          {!isInstalled && <Row href="/instalar" icon={Download} label="Instalar o app" hint="Android ou atalho na tela inicial" />}
        </Section>

        {profile && profile.role !== "jovem" && (isCounselorArea || isAdmin) && (
          <Section title="Equipe">
            {isCounselorArea && (
              <Row
                href="/consultor"
                icon={Users}
                label="Painel do consultor"
                hint={pendingReviews ? "Há fotos de perfil para aprovar" : "Sua companhia e recados"}
                badge={pendingReviews}
              />
            )}
            {isAdmin && <Row href="/admin" icon={LayoutDashboard} label="Gestão" hint="Módulos da organização" />}
          </Section>
        )}

        <Section title="Preferências">
          <AppearancePicker />
        </Section>

        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-medium text-red-700 transition-colors hover:bg-red-50 active:scale-[0.99] dark:text-red-300 dark:hover:bg-red-950/40"
        >
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Sair da conta
        </button>
      </main>
    </div>
  );
}
