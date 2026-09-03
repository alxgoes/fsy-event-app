"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  Megaphone,
  Trash2,
  Search,
  Compass,
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Phone,
  Send,
  Heart,
  MessageCircle,
  Bed,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile } from "@/lib/supabase/useProfile";
import { createClient } from "@/lib/supabase/client";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

interface CompanyData {
  id: string;
  name: string;
  motto: string | null;
  color: string;
  counselors: string[];
}

interface YouthMember {
  id: string;
  full_name: string;
  room: string | null;
  stake: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  category: string;
  target_company_id: string | null;
  created_at: string;
  liked_by?: string[];
  likes_count?: number;
  profiles?: { full_name: string } | null;
}

export function CounselorPanel() {
  const { profile, loading: profileLoading } = useProfile();
  const shouldReduceMotion = useReducedMotion();

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [youthList, setYouthList] = useState<YouthMember[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"announcements" | "youth">("announcements");

  // New announcement form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("important");
  const [category, setCategory] = useState("Companhia");
  const [posting, setPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search in youth list
  const [youthSearch, setYouthSearch] = useState("");

  // Delete announcement confirmation
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadCounselorData = useCallback(async () => {
    if (!profile) return;
    setLoadingData(true);
    setError(null);

    try {
      const supabase = createClient();
      const companyId = profile.company_id;

      if (!companyId) {
        setCompany(null);
        setYouthList([]);
        setAnnouncements([]);
        setLoadingData(false);
        return;
      }

      // 1. Fetch company details
      const { data: compData } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (compData) {
        setCompany(compData as CompanyData);
      }

      // 2. Fetch youth in this company
      const { data: membersData } = await supabase
        .from("profiles")
        .select("id, full_name, room, stake, phone, avatar_url")
        .eq("company_id", companyId)
        .eq("role", "jovem")
        .order("full_name", { ascending: true });

      if (membersData) {
        setYouthList(membersData as YouthMember[]);
      }

      // 3. Fetch announcements for this company
      const res = await fetch(
        `/api/announcements?company_id=${encodeURIComponent(companyId)}&_t=${Date.now()}`
      );
      if (res.ok) {
        const json = await res.json();
        const companyOnly = (json.data ?? []).filter(
          (a: Announcement) => a.target_company_id === companyId
        );
        setAnnouncements(companyOnly);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao carregar dados do painel: " + msg);
    } finally {
      setLoadingData(false);
    }
  }, [profile]);

  useEffect(() => {
    if (!profileLoading && profile) {
      loadCounselorData();
    }
  }, [profileLoading, profile, loadCounselorData]);

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError("Preencha o título e a mensagem do comunicado.");
      return;
    }

    if (!profile?.company_id) {
      setError("Você ainda não foi vinculado a uma companhia.");
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        priority,
        category,
        target_company_id: profile.company_id,
        author_id: profile.id,
      };

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Erro ao publicar comunicado.");
      }

      setTitle("");
      setContent("");
      setPriority("important");
      setPostSuccess(true);
      setTimeout(() => setPostSuccess(false), 3000);

      await loadCounselorData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    setDeletingId(announcementToDelete.id);
    setError(null);

    try {
      const res = await fetch(`/api/announcements?id=${encodeURIComponent(announcementToDelete.id)}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Erro ao remover comunicado.");
      }

      setAnnouncementToDelete(null);
      await loadCounselorData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  if (profileLoading || (profile && loadingData)) {
    return (
      <LoadingScreen
        title="Painel do Consultor FSY"
        message="Sincronizando jovens e comunicados da companhia..."
        submessage="Sessão Ribeirão Preto 2"
      />
    );
  }

  const filteredYouth = youthList.filter((y) => {
    const q = youthSearch.toLowerCase();
    const matchName = y.full_name.toLowerCase().includes(q);
    const matchRoom = (y.room || "").toLowerCase().includes(q);
    const matchStake = (y.stake || "").toLowerCase().includes(q);
    return matchName || matchRoom || matchStake;
  });

  const totalLikes = announcements.reduce(
    (acc, a) => acc + (a.likes_count ?? (a.liked_by?.length || 0)),
    0
  );
  const youthWithRoom = youthList.filter((y) => !!y.room).length;

  return (
    <div className="min-h-screen bg-fsy-watermark pb-24 text-slate-900 dark:text-slate-100">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-6 space-y-6">
        {/* 1. Banner Bento: Counselor & Company Overview */}
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white font-black text-xl shadow-sm shrink-0"
                style={{ backgroundColor: company?.color || "#007DA5" }}
              >
                <Users className="h-7 w-7" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-xs font-black text-[#007DA5] dark:text-[#7DE3F4] border border-sky-200 dark:border-sky-800 uppercase tracking-wider">
                    Painel do Consultor
                  </span>
                  {company && (
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-black text-white"
                      style={{ backgroundColor: company.color || "#007DA5" }}
                    >
                      {company.id.toUpperCase()}
                    </span>
                  )}
                </div>

                <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                  {company ? company.name : "Companhia Não Designada"}
                </h1>

                {company?.motto && (
                  <p className="text-xs sm:text-sm font-serif italic text-slate-600 dark:text-slate-400 mt-0.5">
                    &ldquo;{company.motto}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={loadCounselorData}
                disabled={loadingData}
                className="flex items-center gap-1.5 rounded-2xl bg-[#FAF8F5] dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 text-xs font-black shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[38px]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? "animate-spin text-[#007DA5]" : ""}`} />
                <span>Atualizar</span>
              </button>
              <Link href="/dashboard">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="flex items-center gap-1.5 rounded-2xl bg-[#007DA5] text-white px-4 py-2 text-xs font-black shadow-sm hover:bg-[#005E7C] transition-colors min-h-[38px]"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span>Ver Portal do Jovem</span>
                </motion.div>
              </Link>
            </div>
          </div>

          {/* Co-counselors bar */}
          {company && company.counselors && company.counselors.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 dark:text-slate-400">
                  Consultores parceiros:
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {company.counselors.join(" & ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 dark:text-slate-400">
                  Total de Jovens na Companhia:
                </span>
                <span className="rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black px-2.5 py-0.5 border border-emerald-200 dark:border-emerald-800">
                  {youthList.length} jovens
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Warning if no company */}
        {!profile?.company_id && !loadingData && (
          <div className="rounded-3xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-6 text-center space-y-2 shadow-sm">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-600" />
            <h3 className="font-serif text-lg font-bold text-amber-900 dark:text-amber-200">
              Aguardando Designação de Companhia
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto">
              Seu perfil é de consultor, mas a coordenação ainda não vinculou seu usuário a uma companhia.
              Assim que for designado, você poderá publicar comunicados e acompanhar seus jovens aqui.
            </p>
          </div>
        )}

        {/* 2. Top Minimalist Metrics Row */}
        {profile?.company_id && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Metric 1 */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -2 }}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Jovens Alocados
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950 text-[#007DA5]">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {youthList.length}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {youthWithRoom} com alojamento/quarto informado
              </div>
            </motion.div>

            {/* Metric 2 */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -2 }}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Mural & Avisos
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950 text-[#FC4E6D]">
                  <Megaphone className="h-4 w-4" />
                </div>
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {announcements.length}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Comunicados publicados no mural da companhia
              </div>
            </motion.div>

            {/* Metric 3 */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -2 }}
              className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Curtidas Recebidas
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-100 dark:bg-pink-950 text-pink-600">
                  <Heart className="h-4 w-4 fill-pink-500" />
                </div>
              </div>
              <div className="font-serif text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {totalLikes}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Interações dos jovens nos avisos da companhia
              </div>
            </motion.div>
          </div>
        )}

        {/* 3. Navigation Tabs with layoutId */}
        {profile?.company_id && (
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-fit shadow-sm">
            <button
              onClick={() => setActiveTab("announcements")}
              className={`relative z-10 flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors ${
                activeTab === "announcements"
                  ? "text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {activeTab === "announcements" && (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : "counselorTabActive"}
                  className="absolute inset-0 bg-[#007DA5] rounded-xl shadow-sm -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Megaphone className="h-4 w-4" />
              <span>Mural de Avisos ({announcements.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("youth")}
              className={`relative z-10 flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors ${
                activeTab === "youth"
                  ? "text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {activeTab === "youth" && (
                <motion.div
                  layoutId={shouldReduceMotion ? undefined : "counselorTabActive"}
                  className="absolute inset-0 bg-[#007DA5] rounded-xl shadow-sm -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <Users className="h-4 w-4" />
              <span>Quadro de Jovens ({youthList.length})</span>
            </button>
          </div>
        )}

        {/* 4. Tab 1: Announcements & Reminders */}
        {profile?.company_id && activeTab === "announcements" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Publisher Form (5 cols) */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm sticky top-24">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#007DA5] text-white shadow-sm">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white">
                      Publicar para a Companhia
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Aparecerá imediatamente no portal dos seus jovens
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePostAnnouncement} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Título do Comunicado *
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="ex: Reunião da Companhia no Pátio"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      Mensagem / Instruções *
                    </label>
                    <Textarea
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Escreva orientações de horários, pontos de encontro ou recados para seus jovens..."
                      className="rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                        Prioridade
                      </label>
                      <select
                        value={priority}
                        onChange={(e) =>
                          setPriority(e.target.value as "normal" | "important" | "urgent")
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="important">Importante</option>
                        <option value="urgent">Urgente</option>
                        <option value="normal">Geral / Lembrete</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                        Categoria
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="Companhia">Companhia</option>
                        <option value="Atividades">Atividades</option>
                        <option value="Geral">Geral</option>
                      </select>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/50 p-3 text-xs font-bold text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900">
                      {error}
                    </div>
                  )}

                  {postSuccess && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Comunicado publicado com sucesso!</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={posting}
                    className="w-full rounded-2xl bg-[#007DA5] hover:bg-[#005E7C] text-white font-black text-xs py-3 shadow-sm min-h-[42px]"
                  >
                    {posting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-2" />
                        Enviar Comunicado
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Announcements Feed (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-1">
                <h3 className="font-serif text-lg font-bold text-slate-900 dark:text-white">
                  Comunicados Ativos da Companhia
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {announcements.length} publicado(s)
                </span>
              </div>

              {loadingData ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
                </div>
              ) : announcements.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
                  <Megaphone className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                  <p className="font-serif text-base font-bold text-slate-700 dark:text-slate-300">
                    Nenhum comunicado publicado ainda
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Use o formulário ao lado para enviar o primeiro aviso ou instruções para os jovens da sua companhia.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((item) => {
                    const isUrgent = item.priority === "urgent";
                    const isImportant = item.priority === "important";

                    return (
                      <motion.div
                        key={item.id}
                        whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                        className={`rounded-3xl border p-5 bg-white dark:bg-slate-900 shadow-sm transition-all ${
                          isUrgent
                            ? "border-red-300 dark:border-red-800"
                            : isImportant
                            ? "border-[#FC4E6D]/40"
                            : "border-slate-200/80 dark:border-slate-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase ${
                                  isUrgent
                                    ? "bg-red-500 text-white"
                                    : isImportant
                                    ? "bg-[#FC4E6D] text-white"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                {isUrgent ? "Urgente" : isImportant ? "Importante" : "Lembrete"}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(item.created_at).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <h4 className="font-serif text-base font-bold text-slate-900 dark:text-white">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                              {item.content}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setAnnouncementToDelete(item)}
                            className="p-1.5 rounded-xl text-red-600/70 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                            title="Excluir comunicado"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Likes indicator */}
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-[11px] text-slate-500">
                            Categoria: <strong>{item.category || "Companhia"}</strong>
                          </span>
                          <div className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900">
                            <Heart className="h-3 w-3 fill-rose-500" />
                            <span>{item.likes_count ?? (item.liked_by?.length || 0)} curtida(s)</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Tab 2: Youth List */}
        {profile?.company_id && activeTab === "youth" && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  aria-label="Buscar jovem por nome, quarto ou estaca"
                  placeholder="Buscar jovem por nome, quarto ou estaca..."
                  value={youthSearch}
                  onChange={(e) => setYouthSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007DA5]"
                />
              </div>

              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 px-3.5 py-2.5 rounded-2xl shadow-sm shrink-0">
                {filteredYouth.length} jovem(ns) listado(s)
              </span>
            </div>

            {loadingData ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
              </div>
            ) : filteredYouth.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
                <Users className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p className="font-serif text-base font-bold text-slate-700 dark:text-slate-300">
                  Nenhum jovem encontrado
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  A coordenação vincula os jovens registrados às companhias.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredYouth.map((youth) => {
                  const initial = youth.full_name?.charAt(0)?.toUpperCase() ?? "J";
                  const cleanPhone = youth.phone ? youth.phone.replace(/\D/g, "") : null;

                  return (
                    <motion.div
                      key={youth.id}
                      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                      className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-black text-sm shadow-sm shrink-0"
                            style={{ backgroundColor: company?.color || "#007DA5" }}
                          >
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-serif text-sm font-bold text-slate-900 dark:text-white truncate">
                              {youth.full_name}
                            </h4>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                              {youth.stake || "Estaca não informada"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {youth.room ? (
                            <div className="flex items-center gap-1.5 font-medium">
                              <Bed className="h-3.5 w-3.5 text-[#007DA5]" />
                              <span>Quarto: <strong>{youth.room}</strong></span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">
                              Quarto pendente
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Contact Action */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {cleanPhone ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://wa.me/55${cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-colors"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </a>
                            <a
                              href={`tel:${cleanPhone}`}
                              className="flex items-center justify-center rounded-xl bg-[#FAF8F5] dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
                              title="Ligar"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Telefone não informado
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Delete Announcement Modal */}
      <Dialog
        open={!!announcementToDelete}
        onOpenChange={(open) => !open && setAnnouncementToDelete(null)}
      >
        <DialogContent className="sm:max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Excluir Comunicado
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
              Tem certeza que deseja remover o comunicado &ldquo;{announcementToDelete?.title}&rdquo;? Ele não aparecerá mais para os jovens da sua companhia.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnnouncementToDelete(null)}
              className="rounded-2xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDeleteAnnouncement}
              disabled={!!deletingId}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
