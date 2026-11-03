"use client";
import { startTransition } from "react";

import { CustomizableGrid } from "@/components/layout/CustomizableGrid";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  Building2,
  Stethoscope,
  Megaphone,
  Camera,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { fetchJson, HttpStatusError } from "@/lib/requests/client";
import type { AdminOverview } from "@/types/native-auth";
import { ErrorState, PermissionState } from "@/components/ui/states";
import { ScrollIndicator, ScrollSection } from "@/components/ui/scroll-indicator";

const DASHBOARD_SECTIONS: ScrollSection[] = [
  { id: "metrics", title: "Métricas", level: 2 },
  { id: "announcements", title: "Comunicados", level: 2 },
];

interface ExecutiveMetrics {
  totalYouth: number;
  youthWithCompany: number;
  youthWithRoom: number;
  totalCompanies: number;
  totalCounselors: number;
  medicalAlerts: number;
  totalAnnouncements: number;
  totalPhotos: number;
}

type RecentAnnouncement = AdminOverview["recent_announcements"][number];

export function ExecutiveDashboard() {
  const shouldReduceMotion = useReducedMotion();

  const [metrics, setMetrics] = useState<ExecutiveMetrics>({
    totalYouth: 0,
    youthWithCompany: 0,
    youthWithRoom: 0,
    totalCompanies: 0,
    totalCounselors: 0,
    medicalAlerts: 0,
    totalAnnouncements: 0,
    totalPhotos: 0,
  });
  const [recentAnnouncements, setRecentAnnouncements] = useState<RecentAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState<"forbidden" | "failed" | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Só contagens agregadas no servidor (GET /api/admin/overview): o navegador não baixa perfis nem fichas de saúde.
  const loadExecutiveData = useCallback(async () => {
    setLoading(true);
    const controller = new AbortController();
    try {
      const overview = await fetchJson<AdminOverview>("/api/admin/overview", controller.signal);
      setMetrics({
        totalYouth: overview.total_youth,
        youthWithCompany: overview.youth_with_company,
        youthWithRoom: overview.youth_with_room,
        totalCompanies: overview.total_companies,
        totalCounselors: overview.total_counselors,
        medicalAlerts: overview.medical_records,
        totalAnnouncements: overview.total_announcements,
        totalPhotos: overview.total_photos,
      });
      setRecentAnnouncements(overview.recent_announcements);
      setLoadError(null);
      setLoaded(true);
    } catch (err) {
      const status = err instanceof HttpStatusError ? err.status : 0;
      setLoadError(status === 401 || status === 403 ? "forbidden" : "failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => { loadExecutiveData(); });
  }, [loadExecutiveData]);

  return (
    <div className="space-y-6 relative">
      {/* Precision Scroll Indicator (Floating for Desktop & Large Screens) */}
      <div className="fixed right-3 top-1/2 -translate-y-1/2 z-30 hidden xl:flex h-56 items-center pointer-events-auto">
        <ScrollIndicator sections={DASHBOARD_SECTIONS} />
      </div>

      <div data-section-index="0" className="space-y-6">
        {/* 1. Header Banner */}
        <div className="fsy-panel rounded-3xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007DA5] text-white shadow-sm shrink-0">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-xs font-bold uppercase text-[#005E7C] dark:text-[#7DE3F4] border border-sky-200 dark:border-sky-800">
                    Coordenação Geral
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    Sessão Ribeirão Preto 2
                  </span>
                </div>
                <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                  Visão Geral da Sessão
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                  Acompanhamento consolidado de jovens, companhias, saúde, logística e registros do evento.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadExecutiveData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FAF8F5] dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#005E7C] dark:text-[#7DE3F4]" : ""}`} />
                <span>Atualizar Dados</span>
              </button>


            </div>
          </div>
        </div>

        {loadError === "forbidden" && (
          <PermissionState
            title="Métricas indisponíveis para o seu cargo"
            description="A visão consolidada é exclusiva da coordenação, do Casal Diretor e da logística. Os módulos abaixo continuam conforme o seu acesso."
          />
        )}
        {loadError === "failed" && (
          <ErrorState
            title="Não foi possível carregar as métricas"
            description="A consulta ao servidor falhou ou a conexão caiu. Os números não foram atualizados."
            actions={
              <button
                type="button"
                onClick={() => void loadExecutiveData()}
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#007DA5] px-4 text-sm font-semibold text-white hover:bg-[#005E7C] dark:bg-[#01B6D1] dark:text-slate-950"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
                Tentar novamente
              </button>
            }
          />
        )}

        {/* 2. Top Metrics (Bento Grid of 4 Minimalist Boxes) */}
        {!loadError && <CustomizableGrid pageKey="admin-metrics" version={1} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" items={[{ id: "youth", label: "Jovens", content: (<motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fsy-panel rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Jovens Registrados
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950 text-[#005E7C] dark:text-[#7DE3F4]">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div data-kpi="" className="fsy-figure text-3xl font-bold text-slate-900 dark:text-white">
              {loaded ? metrics.totalYouth : <><span aria-hidden="true">—</span><span className="sr-only">Carregando</span></>}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Em companhias: <strong>{metrics.youthWithCompany}</strong></span>
              <span>Com quartos: <strong>{metrics.youthWithRoom}</strong></span>
            </div>
          </motion.div>) },
{ id: "companies", label: "Companhias", content: (<motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fsy-panel rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Companhias Ativas
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div data-kpi="" className="fsy-figure text-3xl font-bold text-slate-900 dark:text-white">
              {loaded ? metrics.totalCompanies : <><span aria-hidden="true">—</span><span className="sr-only">Carregando</span></>}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Consultores: <strong>{metrics.totalCounselors}</strong></span>
              <span>Média: <strong>{metrics.totalCompanies > 0 ? Math.round(metrics.totalYouth / metrics.totalCompanies) : 0}/cia</strong></span>
            </div>
          </motion.div>) },
{ id: "medical", label: "Prontuários", content: (<motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fsy-panel rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Prontuários de Saúde
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                <Stethoscope className="h-4 w-4" />
              </div>
            </div>
            <div data-kpi="" className="fsy-figure text-3xl font-bold text-slate-900 dark:text-white">
              {loaded ? metrics.medicalAlerts : <><span aria-hidden="true">—</span><span className="sr-only">Carregando</span></>}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-emerald-800 dark:text-emerald-300 dark:text-emerald-400 font-bold">Acompanhamento Ativo</span>
              <Link href="/admin/medical" className="fsy-action-link font-bold text-[#005E7C] dark:text-[#7DE3F4] hover:underline">
                Acessar &rarr;
              </Link>
            </div>
          </motion.div>) },
{ id: "media", label: "Fotos", content: (<motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fsy-panel rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Fotos em Destaque
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-950 text-[#FC4E6D]">
                <Camera className="h-4 w-4" />
              </div>
            </div>
            <div data-kpi="" className="fsy-figure text-3xl font-bold text-slate-900 dark:text-white">
              {loaded ? metrics.totalPhotos : <><span aria-hidden="true">—</span><span className="sr-only">Carregando</span></>}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Fotos publicadas</span>
              <Link href="/admin/media" className="fsy-action-link font-bold text-[#005E7C] dark:text-[#7DE3F4] hover:underline">
                Gerenciar &rarr;
              </Link>
            </div>
          </motion.div>) }]} />}
      </div>

        {/* 4. Recent Announcements Feed */}
        {recentAnnouncements.length > 0 && (
          <div data-section-index="2" className="fsy-panel rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[#005E7C] dark:text-[#7DE3F4]" />
                <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white">
                  Últimos Comunicados Publicados
                </h3>
              </div>
              <Link href="/admin/announcements" className="fsy-action-link text-xs font-bold text-[#005E7C] dark:text-[#7DE3F4] hover:underline">
                Ver todos &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="fsy-panel rounded-2xl bg-[#FAF8F5] dark:bg-slate-800/70 p-4 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-md ${
                        ann.priority === "urgent"
                          ? "bg-red-700 text-white"
                          : ann.priority === "important"
                          ? "bg-[#FC4E6D] text-slate-950"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>
                        {ann.priority === "urgent" ? "Urgente" : ann.priority === "important" ? "Importante" : "Geral"}
                      </span>
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {new Date(ann.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <h4 className="font-heading text-sm font-bold text-slate-900 dark:text-white">
                      {ann.title}
                    </h4>
                    {ann.category && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{ann.category}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
  );
}
