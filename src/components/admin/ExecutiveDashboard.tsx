"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  Building2,
  Stethoscope,
  Truck,
  Calendar,
  Megaphone,
  Camera,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Compass,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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

interface RecentAnnouncement {
  id: string;
  title: string;
  priority: string;
  category?: string;
  created_at: string;
  content: string;
}

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

  const loadExecutiveData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    try {
      // 1. Fetch profiles counts
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, role, company_id, room");

      let totalY = 0;
      let withComp = 0;
      let withRoom = 0;
      let totalCouns = 0;

      if (profiles) {
        profiles.forEach((p) => {
          if (p.role === "jovem" || !p.role) {
            totalY++;
            if (p.company_id) withComp++;
            if (p.room) withRoom++;
          }
          if (p.role === "consultor") {
            totalCouns++;
          }
        });
      }

      // 2. Fetch companies count
      const { count: companiesCount } = await supabase
        .from("companies")
        .select("*", { count: "exact", head: true });

      // 3. Fetch medical alerts count
      const { count: medicalCount } = await supabase
        .from("youth_medical_profiles")
        .select("*", { count: "exact", head: true });

      // 4. Fetch announcements
      const { data: annData } = await supabase
        .from("announcements")
        .select("id, title, priority, category, created_at, content")
        .order("created_at", { ascending: false })
        .limit(4);

      // 5. Fetch photos count
      const { count: photosCount } = await supabase
        .from("media_photos")
        .select("*", { count: "exact", head: true });

      setMetrics({
        totalYouth: totalY,
        youthWithCompany: withComp,
        youthWithRoom: withRoom,
        totalCompanies: companiesCount ?? 0,
        totalCounselors: totalCouns,
        medicalAlerts: medicalCount ?? 0,
        totalAnnouncements: annData?.length ?? 0,
        totalPhotos: photosCount ?? 0,
      });

      setRecentAnnouncements(annData ?? []);
    } catch (err) {
      console.error("Error loading executive dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExecutiveData();
  }, [loadExecutiveData]);

  return (
    <div className="space-y-6">
        {/* 1. Header Banner */}
        <div className="rounded-3xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007DA5] text-white shadow-sm shrink-0">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-xs font-black uppercase text-[#007DA5] dark:text-[#7DE3F4] border border-sky-200 dark:border-sky-800">
                    Coordenação Geral
                  </span>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    Sessão Ribeirão Preto 2
                  </span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
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
                className="inline-flex items-center gap-2 rounded-xl bg-[#FAF8F5] dark:bg-slate-800 px-3.5 py-2.5 text-xs font-black text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#007DA5]" : ""}`} />
                <span>Atualizar Dados</span>
              </button>

              <Link href="/dashboard">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#007DA5] px-3.5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-[#005E7C] transition-colors"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Ver Portal do Jovem</span>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Top Metrics (Bento Grid of 4 Minimalist Boxes) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Jovens Cadastrados */}
          <motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Jovens Registrados
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950 text-[#007DA5] dark:text-[#7DE3F4]">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="font-serif text-3xl font-black text-slate-900 dark:text-white">
              {metrics.totalYouth}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Em companhias: <strong>{metrics.youthWithCompany}</strong></span>
              <span>Com quartos: <strong>{metrics.youthWithRoom}</strong></span>
            </div>
          </motion.div>

          {/* Card 2: Companhias & Consultores */}
          <motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Companhias Ativas
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="font-serif text-3xl font-black text-slate-900 dark:text-white">
              {metrics.totalCompanies}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Consultores: <strong>{metrics.totalCounselors}</strong></span>
              <span>Média: <strong>{metrics.totalCompanies > 0 ? Math.round(metrics.totalYouth / metrics.totalCompanies) : 0}/cia</strong></span>
            </div>
          </motion.div>

          {/* Card 3: Atendimentos & Alergias */}
          <motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Prontuários de Saúde
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
                <Stethoscope className="h-4 w-4" />
              </div>
            </div>
            <div className="font-serif text-3xl font-black text-slate-900 dark:text-white">
              {metrics.medicalAlerts}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Acompanhamento Ativo</span>
              <Link href="/admin/medical" className="font-bold text-[#007DA5] hover:underline">
                Acessar &rarr;
              </Link>
            </div>
          </motion.div>

          {/* Card 4: Registros de Mídia */}
          <motion.div
            whileHover={shouldReduceMotion ? undefined : { y: -2 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Fotos em Destaque
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-950 text-[#FC4E6D]">
                <Camera className="h-4 w-4" />
              </div>
            </div>
            <div className="font-serif text-3xl font-black text-slate-900 dark:text-white">
              {metrics.totalPhotos}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Drive & Murais</span>
              <Link href="/admin/media" className="font-bold text-[#007DA5] hover:underline">
                Gerenciar &rarr;
              </Link>
            </div>
          </motion.div>
        </div>

        {/* 3. Interactive Management Modules (Bento Action Cards) */}
        <div>
          <div className="mb-4">
            <h2 className="font-serif text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Módulos de Gestão Rápida
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Acesso direto às operações estratégicas da conferência FSY 2027.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Module 1: Registros Médicos */}
            <Link href="/admin/medical">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="group rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-[#007DA5]/50 transition-colors flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                      <Stethoscope className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black px-2 py-0.5">
                      Saúde & Inclusão
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#007DA5] transition-colors">
                    Prontuários & Saúde
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Alergias severas, celíacos, medicações controladas e agendamentos de consulta médica.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#007DA5]">
                  <span>Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>
            </Link>

            {/* Module 2: Companhias */}
            <Link href="/admin/companies">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="group rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-[#007DA5]/50 transition-colors flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 border border-amber-200 dark:border-amber-800">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-black px-2 py-0.5">
                      {metrics.totalCompanies} Companhias
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#007DA5] transition-colors">
                    Gestão de Companhias
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Estandartes, atribuição de jovens e vinculação dos casais de consultores.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#007DA5]">
                  <span>Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>
            </Link>

            {/* Module 3: Programação Oficial */}
            <Link href="/admin/schedule">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="group rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-[#007DA5]/50 transition-colors flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-[#007DA5] border border-sky-200 dark:border-sky-800">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-sky-100 dark:bg-sky-950 text-[#007DA5] dark:text-[#7DE3F4] text-[10px] font-black px-2 py-0.5">
                      5 Dias
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#007DA5] transition-colors">
                    Programação da Sessão
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Horários, locais, devocionais, gincanas, bailes e atividades diárias.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#007DA5]">
                  <span>Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>
            </Link>

            {/* Module 4: Logística & Caravanas */}
            <Link href="/admin/logistics">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="group rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-[#007DA5]/50 transition-colors flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 border border-purple-200 dark:border-purple-800">
                      <Truck className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 text-[10px] font-black px-2 py-0.5">
                      Transporte
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#007DA5] transition-colors">
                    Logística & Caravanas
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Ônibus por estaca, horários de chegada, líderes de caravana e alojamentos.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#007DA5]">
                  <span>Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>
            </Link>

            {/* Module 5: Comunicados Oficiais */}
            <Link href="/admin/announcements">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="group rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-[#007DA5]/50 transition-colors flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-[#FC4E6D] border border-rose-200 dark:border-rose-800">
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[10px] font-black px-2 py-0.5">
                      Mural Geral
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#007DA5] transition-colors">
                    Comunicados & Avisos
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Emissão de avisos urgentes ou direcionados para jovens e companhias.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#007DA5]">
                  <span>Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>
            </Link>

            {/* Module 6: Fotos & Mídia em Destaque */}
            <Link href="/admin/media">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="group rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-[#007DA5]/50 transition-colors flex flex-col justify-between h-full"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-50 dark:bg-pink-950/60 text-[#FC4E6D] border border-pink-200 dark:border-pink-800">
                      <Camera className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-pink-100 dark:bg-pink-950 text-pink-800 dark:text-pink-300 text-[10px] font-black px-2 py-0.5">
                      Destaques do Drive
                    </span>
                  </div>
                  <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white group-hover:text-[#007DA5] transition-colors">
                    Fotos em Destaque
                  </h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Cadastrar e gerenciar fotos do Drive que aparecem nas caixas de destaque do portal.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#007DA5]">
                  <span>Abrir módulo</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* 4. Recent Announcements Feed */}
        {recentAnnouncements.length > 0 && (
          <div className="rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-[#007DA5]" />
                <h3 className="font-serif text-base font-bold text-slate-900 dark:text-white">
                  Últimos Comunicados Publicados
                </h3>
              </div>
              <Link href="/admin/announcements" className="text-xs font-bold text-[#007DA5] hover:underline">
                Ver todos &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="rounded-2xl bg-[#FAF8F5] dark:bg-slate-800/70 p-4 border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                        ann.priority === "urgent"
                          ? "bg-red-500 text-white"
                          : ann.priority === "important"
                          ? "bg-[#FC4E6D] text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>
                        {ann.priority === "urgent" ? "Urgente" : ann.priority === "important" ? "Importante" : "Geral"}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {new Date(ann.created_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <h4 className="font-serif text-sm font-bold text-slate-900 dark:text-white">
                      {ann.title}
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
  );
}
