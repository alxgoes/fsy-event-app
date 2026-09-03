"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Megaphone, Users, Pin, Heart, Clock } from "lucide-react";

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: string;
  category?: string;
  created_at: string;
  liked_by?: string[];
  likes_count?: number;
  profiles?: { full_name: string; role: string } | null;
}

interface MyCompanyCardProps {
  currentUserId?: string | null;
  companyName?: string | null;
  counselors?: string[] | null;
  companyMotto?: string | null;
  announcements?: AnnouncementItem[];
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

export function MyCompanyCard({
  currentUserId = null,
  companyName = null,
  counselors = null,
  companyMotto = null,
  announcements = [],
}: MyCompanyCardProps) {
  const shouldReduceMotion = useReducedMotion();
  // Local likes state keyed by announcement ID
  const [likesState, setLikesState] = useState<
    Record<string, { count: number; isLiked: boolean }>
  >({});

  useEffect(() => {
    const nextState: Record<string, { count: number; isLiked: boolean }> = {};
    announcements.forEach((a) => {
      const isLiked = Boolean(
        currentUserId && a.liked_by && a.liked_by.includes(currentUserId)
      );
      const count = a.likes_count ?? (a.liked_by ? a.liked_by.length : 0);
      nextState[a.id] = { count, isLiked };
    });
    setLikesState(nextState);
  }, [announcements, currentUserId]);

  const toggleLike = async (announcementId: string) => {
    if (!currentUserId) return;

    // 1. Optimistic UI update
    setLikesState((prev) => {
      const current = prev[announcementId] || { count: 0, isLiked: false };
      const nextLiked = !current.isLiked;
      const nextCount = nextLiked
        ? current.count + 1
        : Math.max(0, current.count - 1);
      return {
        ...prev,
        [announcementId]: { count: nextCount, isLiked: nextLiked },
      };
    });

    // 2. Persist to API
    try {
      const res = await fetch("/api/announcements/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          announcement_id: announcementId,
          user_id: currentUserId,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setLikesState((prev) => ({
          ...prev,
          [announcementId]: {
            count: json.likes_count,
            isLiked: json.is_liked,
          },
        }));
      }
    } catch (err) {
      console.error("Error saving announcement like:", err);
    }
  };

  // No company assigned yet
  if (!companyName) {
    return (
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="relative flex flex-col justify-between rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100 shadow-brutal-md min-h-[220px]"
      >
        <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700">
            <Users className="h-7 w-7 text-slate-400" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-black text-slate-700 dark:text-slate-300">
              Aguardando Designação
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
              Você ainda não foi designado a uma companhia. A coordenação irá te designar em breve.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100 shadow-lg"
    >
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FC4E6D] text-white border-2 border-slate-900 dark:border-slate-700 shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-[#007DA5]">
                Minha Companhia
              </span>
              <h3 className="font-heading text-xl font-extrabold text-slate-900 dark:text-white">
                {companyName}
              </h3>
            </div>
          </div>

          {announcements.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-[#7209B7] dark:text-purple-300 px-2.5 py-1 text-xs font-black border border-purple-200 dark:border-purple-800">
              <Megaphone className="h-3.5 w-3.5" />
              <span>{announcements.length} avisos</span>
            </span>
          )}
        </div>

        {/* Company Motto & Counselors Info */}
        {(companyMotto || counselors) && (
          <div className="mb-4 rounded-2xl bg-slate-50 dark:bg-slate-800 p-3 border-2 border-slate-900/10 dark:border-slate-700 space-y-1 text-xs">
            {companyMotto && (
              <p className="font-extrabold italic text-slate-800 dark:text-slate-200 text-center text-xs">
                {companyMotto}
              </p>
            )}
            {counselors && counselors.length > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 font-semibold">Consultores:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">{counselors.join(" & ")}</span>
              </div>
            )}
          </div>
        )}

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <div className="text-center py-6 text-slate-400 dark:text-slate-500">
            <Pin className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold">Nenhum aviso ainda</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((item) => {
              const info = likesState[item.id] || {
                count: item.likes_count ?? 0,
                isLiked: Boolean(
                  currentUserId && item.liked_by?.includes(currentUserId)
                ),
              };
              const isUrgent = item.priority === "urgent";
              const isImportant = item.priority === "important";
              const authorName = item.profiles?.full_name ?? "Coordenação";

              return (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.99 }}
                  className={`relative rounded-2xl p-3.5 transition-all border-2 ${
                    isUrgent
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : isImportant
                      ? "border-slate-900 dark:border-slate-600 bg-amber-50/70 dark:bg-amber-950/20 shadow-sm"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isUrgent && (
                        <span className="flex items-center gap-1 rounded-md bg-red-500 px-1.5 py-0.5 text-xs font-black uppercase text-white">
                          <Pin className="h-2.5 w-2.5" /> Urgente
                        </span>
                      )}
                      {isImportant && (
                        <span className="flex items-center gap-1 rounded-md bg-[#FC4E6D] px-1.5 py-0.5 text-xs font-black uppercase text-white">
                          <Pin className="h-2.5 w-2.5" /> Importante
                        </span>
                      )}
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(item.created_at)}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                    {item.content}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-slate-900/5 dark:border-slate-700 text-xs">
                    <span className="font-bold text-slate-500">
                      Por <strong className="text-slate-800 dark:text-slate-200">{authorName}</strong>
                    </span>

                    {/* Like / Heart Action with Micro-interaction & Persistent DB Counter */}
                    <motion.button
                      type="button"
                      aria-label={`Curtir comunicado ${item.title}`}
                      onClick={() => toggleLike(item.id)}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.92 }}
                      whileHover={shouldReduceMotion ? undefined : { y: -1 }}
                      transition={{ type: "spring", stiffness: 450, damping: 25 }}
                      className={`flex items-center gap-1.5 font-black text-xs rounded-xl px-2.5 py-1 border transition-colors cursor-pointer min-h-[36px] ${
                        info.isLiked
                          ? "text-rose-600 bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:text-rose-600 hover:border-rose-300"
                      }`}
                      title={info.isLiked ? "Descurtir" : "Curtir comunicado"}
                    >
                      <motion.span
                        key={info.isLiked ? "liked" : "unliked"}
                        initial={shouldReduceMotion ? false : { scale: info.isLiked ? 0.75 : 1 }}
                        animate={
                          shouldReduceMotion
                            ? { scale: 1 }
                            : info.isLiked
                            ? { scale: [1, 1.4, 0.95, 1] }
                            : { scale: 1 }
                        }
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="inline-flex items-center justify-center"
                      >
                        <Heart
                          className={`h-3.5 w-3.5 ${
                            info.isLiked ? "fill-rose-500 text-rose-500" : ""
                          }`}
                        />
                      </motion.span>
                      <motion.span
                        key={`count-${info.count}`}
                        initial={shouldReduceMotion ? false : { y: -2, opacity: 0.6 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.15 }}
                      >
                        {info.count}
                      </motion.span>
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
