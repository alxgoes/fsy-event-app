"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Megaphone,
  Pin,
  Clock,
  Heart,
  Check,
  CheckCircle2,
  Search,
  RefreshCw,
  Building2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { useProfile } from "@/lib/supabase/useProfile";
import { VoluteLoader } from "@/components/ui/VoluteLoader";

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
  profiles?: { full_name: string; role: string } | null;
}

interface CompanyItem {
  id: string;
  name: string;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `há ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays}d`;
}

export default function AnnouncementsPage() {
  const { profile } = useProfile();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todas" | "minha_cia" | "urgentes" | "nao_lidos">("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [likesMap, setLikesMap] = useState<
    Record<string, { count: number; isLiked: boolean }>
  >({});

  const storageKey = profile?.id
    ? `fsy_read_announcements_${profile.id}`
    : "fsy_read_announcements_guest";

  // Load read status from localStorage
  const loadReadStatus = useCallback(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setReadIds(JSON.parse(raw) || []);
      } else {
        setReadIds([]);
      }
    } catch {
      setReadIds([]);
    }
  }, [storageKey]);

  // Load announcements from API
  const loadData = useCallback(async () => {
    setLoading(true);
    loadReadStatus();

    try {
      const [annRes, compRes] = await Promise.all([
        fetch(`/api/announcements?_t=${Date.now()}`),
        fetch(`/api/companies?_t=${Date.now()}`),
      ]);

      if (annRes.ok) {
        const annJson = await annRes.json();
        const data: Announcement[] = annJson.data ?? [];
        setAnnouncements(data);

        // Populate initial likes
        const initialLikes: Record<string, { count: number; isLiked: boolean }> = {};
        data.forEach((a) => {
          const isLiked = Boolean(
            profile?.id && a.liked_by && a.liked_by.includes(profile.id)
          );
          const count = a.likes_count ?? (a.liked_by ? a.liked_by.length : 0);
          initialLikes[a.id] = { count, isLiked };
        });
        setLikesMap(initialLikes);
      }

      if (compRes.ok) {
        const compJson = await compRes.json();
        setCompanies(compJson.companies ?? []);
      }
    } catch (err) {
      console.error("Error loading announcements:", err);
    } finally {
      setLoading(false);
    }
  }, [loadReadStatus, profile?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle mark as read
  const markAsRead = (id: string) => {
    try {
      const next = Array.from(new Set([...readIds, id]));
      localStorage.setItem(storageKey, JSON.stringify(next));
      setReadIds(next);
      window.dispatchEvent(new Event("fsy_notifications_updated"));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  // Mark all as read
  const markAllAsRead = () => {
    try {
      const allIds = announcements.map((a) => a.id);
      localStorage.setItem(storageKey, JSON.stringify(allIds));
      setReadIds(allIds);
      window.dispatchEvent(new Event("fsy_notifications_updated"));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  // Toggle Like with backend sync
  const toggleLike = async (id: string) => {
    if (!profile?.id) return;

    // Optimistic UI
    setLikesMap((prev) => {
      const cur = prev[id] || { count: 0, isLiked: false };
      const nextLiked = !cur.isLiked;
      const nextCount = nextLiked ? cur.count + 1 : Math.max(0, cur.count - 1);
      return { ...prev, [id]: { count: nextCount, isLiked: nextLiked } };
    });

    try {
      const res = await fetch("/api/announcements/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement_id: id,
          user_id: profile.id,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setLikesMap((prev) => ({
          ...prev,
          [id]: { count: json.likes_count, isLiked: json.is_liked },
        }));
      }
    } catch (err) {
      console.error("Error saving like:", err);
    }
  };

  // Company Name Helper
  const getTargetLabel = (targetCompId: string | null) => {
    if (!targetCompId) return "Todas as Companhias";
    const found = companies.find(
      (c) =>
        c.id.toLowerCase() === targetCompId.toLowerCase() ||
        c.name.toLowerCase().includes(targetCompId.toLowerCase())
    );
    return found ? found.name : targetCompId.toUpperCase();
  };

  // Filtered List
  const filteredAnnouncements = announcements.filter((a) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      a.title.toLowerCase().includes(q) ||
      a.content.toLowerCase().includes(q) ||
      (a.profiles?.full_name && a.profiles.full_name.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q));

    if (!matchSearch) return false;

    if (filter === "urgentes") {
      return a.priority === "urgent" || a.priority === "important";
    }

    if (filter === "minha_cia") {
      if (!profile?.company_id) return true;
      const userCia = profile.company_id.toLowerCase().replace(/[\s\-_]/g, "");
      const targetCia = (a.target_company_id || "")
        .toLowerCase()
        .replace(/[\s\-_]/g, "");
      return !a.target_company_id || targetCia === userCia || targetCia.includes(userCia);
    }

    if (filter === "nao_lidos") {
      return !readIds.includes(a.id);
    }

    return true;
  });

  const unreadCount = announcements.filter((a) => !readIds.includes(a.id)).length;

  return (
    <div className="min-h-screen bg-fsy-watermark text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header />

      <main className="mx-auto max-w-4xl w-full px-4 pt-6 pb-16 sm:px-6">
        {/* Top Back Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-black text-slate-900 dark:text-white border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar ao Dashboard</span>
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-3.5 py-2 text-xs font-black border-2 border-emerald-600 shadow-brutal-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all"
              >
                <Check className="h-4 w-4" />
                <span>Marcar todos como lidos ({unreadCount})</span>
              </button>
            )}

            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3.5 py-2 text-xs font-black border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm hover:bg-slate-50 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* Page Hero Banner */}
        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-lg mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FC4E6D] text-white border-2 border-slate-900 shadow-sm">
                <Megaphone className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#007DA5] dark:text-cyan-400">
                  Lembretes & Mensagens Oficiais
                </span>
                <h1 className="font-heading text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  Mural da sua Companhia
                </h1>
              </div>
            </div>

            {profile?.company_id && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-[#7209B7] dark:text-purple-300 px-3 py-1 text-xs font-black border border-purple-300 dark:border-purple-800">
                <Building2 className="h-3.5 w-3.5" />
                <span>{profile.company_id}</span>
              </span>
            )}
          </div>

          <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mt-3 leading-relaxed">
            Aqui você acompanha todas as mensagens, instruções, horários e lembretes lançados pelos consultores da sua companhia e pela coordenação geral.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-400" />
            <input
              type="text"
              aria-label="Pesquisar comunicados, avisos ou recados"
              placeholder="Pesquisar comunicados, avisos ou recados..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#007DA5]"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("todas")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black border-2 border-slate-900 dark:border-slate-700 transition-all min-h-[36px] ${
                filter === "todas"
                  ? "bg-[#007DA5] text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50"
              }`}
            >
              Todos ({announcements.length})
            </button>

            <button
              onClick={() => setFilter("minha_cia")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black border-2 border-slate-900 dark:border-slate-700 transition-all min-h-[36px] ${
                filter === "minha_cia"
                  ? "bg-[#FFE48A] text-amber-950 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50"
              }`}
            >
              Minha Companhia {profile?.company_id ? `(${profile.company_id})` : ""}
            </button>

            <button
              onClick={() => setFilter("urgentes")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black border-2 border-slate-900 dark:border-slate-700 transition-all min-h-[36px] ${
                filter === "urgentes"
                  ? "bg-[#FC4E6D] text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50"
              }`}
            >
              Urgentes & Importantes
            </button>

            <button
              onClick={() => setFilter("nao_lidos")}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black border-2 border-slate-900 dark:border-slate-700 transition-all min-h-[36px] ${
                filter === "nao_lidos"
                  ? "bg-[#06D6A0] text-emerald-950 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 shadow-sm hover:bg-slate-50"
              }`}
            >
              Não Lidos ({unreadCount})
            </button>
          </div>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600 dark:text-slate-300">
            <VoluteLoader size={60} variant="brand" />
            <p className="text-xs font-bold tracking-wide">Sincronizando comunicados da sessão...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
            <Pin className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <h3 className="font-heading text-lg font-black text-slate-700 dark:text-slate-300">
              Nenhum comunicado encontrado
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "Nenhum resultado para os termos pesquisados."
                : filter === "nao_lidos"
                ? "Você já visualizou todos os comunicados disponíveis!"
                : "Ainda não foram postados comunicados nesta categoria."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {filteredAnnouncements.map((item) => {
                const isRead = readIds.includes(item.id);
                const isUrgent = item.priority === "urgent";
                const isImportant = item.priority === "important";
                const authorName = item.profiles?.full_name || "Consultores da Companhia";
                const targetLabel = getTargetLabel(item.target_company_id);
                const likeInfo = likesMap[item.id] || {
                  count: item.likes_count ?? 0,
                  isLiked: Boolean(
                    profile?.id && item.liked_by?.includes(profile.id)
                  ),
                };

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`rounded-3xl border-2 p-5 shadow-brutal-md transition-all ${
                      !isRead
                        ? isUrgent
                          ? "border-red-500 bg-red-50/80 dark:bg-red-950/40"
                          : isImportant
                          ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/30"
                          : "border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 opacity-80"
                    }`}
                  >
                    {/* Top Metadata Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded-xl px-2.5 py-0.5 text-[10px] font-black uppercase border-2 border-slate-900 ${
                            isUrgent
                              ? "bg-red-500 text-white animate-pulse"
                              : isImportant
                              ? "bg-[#FFE48A] text-amber-950"
                              : "bg-[#007DA5] text-white"
                          }`}
                        >
                          {isUrgent ? "Urgente" : isImportant ? "Importante" : "Lembrete"}
                        </span>

                        <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-black text-slate-800 dark:text-slate-200 border border-slate-900 dark:border-slate-700">
                          {item.category || "Geral"}
                        </span>

                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(item.created_at)}
                        </span>
                      </div>

                      <span className="text-xs font-black text-[#007DA5] dark:text-cyan-400 flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>Para: {targetLabel}</span>
                      </span>
                    </div>

                    {/* Announcement Title & Content */}
                    <h3 className="font-heading text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight mb-2">
                      {item.title}
                    </h3>

                    <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                      {item.content}
                    </p>

                    {/* Footer Actions: Author, Heart Likes, and Marcar como Lido */}
                    <div className="mt-4 pt-3 border-t-2 border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        Postado por: <strong className="text-slate-950 dark:text-white">{authorName}</strong>
                      </span>

                      <div className="flex items-center gap-2.5">
                        {/* Like Button */}
                        <button
                          type="button"
                          onClick={() => toggleLike(item.id)}
                          className={`flex items-center gap-1.5 font-black text-xs rounded-xl px-3 py-1 border transition-all cursor-pointer ${
                            likeInfo.isLiked
                              ? "text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 shadow-sm"
                              : "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 hover:text-rose-600 hover:border-rose-300"
                          }`}
                          title={likeInfo.isLiked ? "Descurtir" : "Curtir lembrete"}
                        >
                          <Heart
                            className={`h-3.5 w-3.5 transition-transform active:scale-125 ${
                              likeInfo.isLiked ? "fill-rose-500 text-rose-500" : ""
                            }`}
                          />
                          <span>{likeInfo.count} curtida(s)</span>
                        </button>

                        {/* Read / Unread Toggle */}
                        {!isRead ? (
                          <button
                            type="button"
                            onClick={() => markAsRead(item.id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-[#06D6A0] hover:bg-emerald-400 text-emerald-950 text-xs font-black px-3 py-1.5 border border-slate-900 shadow-sm transition-all cursor-pointer min-h-[36px]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Marcar como lido</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-xl border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Lido</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
