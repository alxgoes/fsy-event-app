"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Megaphone,
  Trash2,
  Search,
  Compass,
  AlertTriangle,
  Pin,
  Clock,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Phone,
  Home,
  Send,
  Heart,
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
      const res = await fetch(`/api/announcements?company_id=${encodeURIComponent(companyId)}&_t=${Date.now()}`);
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

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-fsy-watermark flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#4361EE]" />
          <p className="font-bold text-sm text-slate-600 dark:text-slate-400">
            Carregando Painel do Consultor...
          </p>
        </div>
      </div>
    );
  }

  const filteredYouth = youthList.filter((y) => {
    const q = youthSearch.toLowerCase();
    const matchName = y.full_name.toLowerCase().includes(q);
    const matchRoom = (y.room || "").toLowerCase().includes(q);
    const matchStake = (y.stake || "").toLowerCase().includes(q);
    return matchName || matchRoom || matchStake;
  });

  return (
    <div className="min-h-screen bg-fsy-watermark pb-24 text-slate-900 dark:text-slate-100">
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-6 space-y-6">
        {/* Banner: Counselor & Company Overview */}
        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-brutal-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-white font-black text-xl border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm shrink-0"
                style={{ backgroundColor: company?.color || "#4361EE" }}
              >
                <Users className="h-7 w-7" />
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded-md bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 text-xs font-black text-[#4361EE] border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                    Painel do Consultor
                  </span>
                  {company && (
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-black text-white border border-slate-900/30"
                      style={{ backgroundColor: company.color || "#4361EE" }}
                    >
                      {company.id.toUpperCase()}
                    </span>
                  )}
                </div>

                <h1 className="font-heading text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                  {company ? company.name : "Companhia Não Designada"}
                </h1>

                {company?.motto && (
                  <p className="text-xs sm:text-sm font-semibold italic text-slate-600 dark:text-slate-400 mt-0.5">
                    &ldquo;{company.motto}&rdquo;
                  </p>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={loadCounselorData}
                className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 px-3.5 py-2 text-xs font-black shadow-brutal-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar
              </button>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 rounded-2xl bg-[#4361EE] text-white border-2 border-slate-900 dark:border-slate-700 px-3.5 py-2 text-xs font-black shadow-brutal-sm hover:bg-blue-600 transition-colors"
              >
                <Compass className="h-3.5 w-3.5" />
                Ver Portal Jovem
              </Link>
            </div>
          </div>

          {/* Co-counselors bar */}
          {company && company.counselors && company.counselors.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 dark:text-slate-400">
                  Consultores desta companhia:
                </span>
                <span className="font-black text-slate-900 dark:text-white">
                  {company.counselors.join(" & ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500 dark:text-slate-400">
                  Jovens sob sua responsabilidade:
                </span>
                <span className="rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-black px-2 py-0.5 border border-emerald-300 dark:border-emerald-800">
                  {youthList.length} jovens
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Warning if no company */}
        {!profile?.company_id && !loadingData && (
          <div className="rounded-3xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-6 shadow-brutal-sm text-center space-y-2">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-600" />
            <h3 className="font-heading text-lg font-black text-amber-900 dark:text-amber-200">
              Aguardando Designação de Companhia
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 max-w-md mx-auto">
              Você tem acesso ao perfil de consultor, mas a coordenação ainda não vinculou seu usuário a uma companhia.
              Assim que for designado, você poderá publicar comunicados e acompanhar seus jovens aqui.
            </p>
          </div>
        )}

        {/* Navigation Tabs */}
        {profile?.company_id && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("announcements")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-black border-2 transition-all ${
                activeTab === "announcements"
                  ? "bg-slate-900 text-white dark:bg-[#4361EE] border-slate-900 dark:border-blue-400 shadow-brutal-sm"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-900 dark:border-slate-700 hover:bg-slate-50"
              }`}
            >
              <Megaphone className="h-4 w-4" />
              Mural & Comunicados ({announcements.length})
            </button>

            <button
              onClick={() => setActiveTab("youth")}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-black border-2 transition-all ${
                activeTab === "youth"
                  ? "bg-slate-900 text-white dark:bg-[#4361EE] border-slate-900 dark:border-blue-400 shadow-brutal-sm"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-900 dark:border-slate-700 hover:bg-slate-50"
              }`}
            >
              <Users className="h-4 w-4" />
              Jovens da Companhia ({youthList.length})
            </button>
          </div>
        )}

        {/* Tab 1: Announcements & Reminders */}
        {profile?.company_id && activeTab === "announcements" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Publisher Form (5 cols) */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-brutal-md sticky top-24">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6B8B] text-white border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-black text-slate-900 dark:text-white">
                      Publicar para sua Companhia
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Aparecerá no mural dos seus jovens
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePostAnnouncement} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      Título do Comunicado / Lembrete *
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="ex: Reunião de Companhia no Pátio"
                      className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                      Mensagem *
                    </label>
                    <Textarea
                      rows={4}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Escreva as instruções, horários ou recados para os jovens da sua companhia..."
                      className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Prioridade
                      </label>
                      <select
                        value={priority}
                        onChange={(e) =>
                          setPriority(e.target.value as "normal" | "important" | "urgent")
                        }
                        className="w-full px-3 py-2 rounded-xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="important">Importante</option>
                        <option value="urgent">Urgente</option>
                        <option value="normal">Geral / Lembrete</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-700 dark:text-slate-300 mb-1">
                        Categoria
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="Companhia">Companhia</option>
                        <option value="Espiritual">Espiritual</option>
                        <option value="Atividade">Atividade</option>
                        <option value="Logística">Logística</option>
                        <option value="Geral">Geral</option>
                      </select>
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-red-600 font-bold">{error}</p>
                  )}

                  {postSuccess && (
                    <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Comunicado publicado com sucesso!
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={posting}
                    className="w-full rounded-2xl bg-[#06D6A0] hover:bg-emerald-400 text-slate-950 font-black text-xs border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm"
                  >
                    {posting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <Megaphone className="h-4 w-4 mr-1.5" />
                        Publicar Comunicado
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>

            {/* Announcements Feed (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-black text-slate-900 dark:text-white">
                  Comunicados Ativos da sua Companhia
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  {announcements.length} publicado(s)
                </span>
              </div>

              {loadingData ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-7 w-7 animate-spin text-[#4361EE]" />
                </div>
              ) : announcements.length === 0 ? (
                <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
                  <Pin className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="font-heading text-base font-black text-slate-700 dark:text-slate-300">
                    Nenhum comunicado publicado ainda
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    Use o formulário ao lado para postar o primeiro recado para os jovens da sua companhia.
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
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl border-2 p-4 shadow-brutal-sm transition-all ${
                          isUrgent
                            ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                            : isImportant
                            ? "border-slate-900 dark:border-slate-700 bg-amber-50/60 dark:bg-amber-950/20"
                            : "border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                  isUrgent
                                    ? "bg-red-500 text-white"
                                    : isImportant
                                    ? "bg-[#FFD166] text-slate-950"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                {item.priority === "urgent"
                                  ? "Urgente"
                                  : item.priority === "important"
                                  ? "Importante"
                                  : "Lembrete"}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(item.created_at).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <h4 className="font-heading text-base font-extrabold text-slate-900 dark:text-white">
                              {item.title}
                            </h4>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
                              {item.content}
                            </p>
                          </div>

                          <button
                            onClick={() => setAnnouncementToDelete(item)}
                            className="p-1.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                            title="Excluir comunicado"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Likes counter indicator */}
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="text-[11px] font-bold text-slate-500">
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

        {/* Tab 2: Youth List */}
        {profile?.company_id && activeTab === "youth" && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar jovem por nome, quarto ou estaca..."
                  value={youthSearch}
                  onChange={(e) => setYouthSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4361EE]"
                />
              </div>

              <span className="text-xs font-black text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 px-3.5 py-2.5 rounded-2xl shadow-brutal-sm shrink-0">
                {filteredYouth.length} jovem(ns) listado(s)
              </span>
            </div>

            {loadingData ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-[#4361EE]" />
              </div>
            ) : filteredYouth.length === 0 ? (
              <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                <Users className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p className="font-heading text-base font-black text-slate-700 dark:text-slate-300">
                  Nenhum jovem encontrado nesta companhia
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                  A coordenação e o casal diretor alocam os jovens registrados nas companhias.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredYouth.map((youth) => {
                  const initial = youth.full_name?.charAt(0)?.toUpperCase() ?? "J";

                  return (
                    <motion.div
                      key={youth.id}
                      whileHover={{ y: -2 }}
                      className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-brutal-sm flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4361EE] text-white font-black text-base border border-slate-900 dark:border-slate-700 shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-heading text-sm font-black text-slate-900 dark:text-white truncate">
                            {youth.full_name}
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                            {youth.stake || "Estaca não informada"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                        {youth.room && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold">
                            <Home className="h-3.5 w-3.5 text-slate-400" />
                            <span>Quarto: <strong>{youth.room}</strong></span>
                          </div>
                        )}
                        {youth.phone && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{youth.phone}</span>
                          </div>
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
        <DialogContent className="sm:max-w-md rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-black text-red-600 dark:text-red-400 flex items-center gap-2">
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
              className="rounded-2xl text-xs font-black"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDeleteAnnouncement}
              disabled={!!deletingId}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black"
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
