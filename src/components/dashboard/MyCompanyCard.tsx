"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Users, Pin, Heart, Clock } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  created_at: string;
  profiles?: { full_name: string; role: string } | null;
}

interface MyCompanyCardProps {
  companyName?: string | null;
  counselors?: string[] | null;
  companyMotto?: string | null;
  announcements?: Announcement[];
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
  companyName = null,
  counselors = null,
  companyMotto = null,
  announcements = [],
}: MyCompanyCardProps) {
  const [likedIds, setLikedIds] = useState<Record<string, boolean>>({});

  const toggleLike = (id: string) => {
    setLikedIds((prev) => ({ ...prev, [id]: !prev[id] }));
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
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-slate-900 dark:text-slate-100 shadow-brutal-md"
    >
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FF6B8B] text-white border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-[#4361EE]">
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
              <p className="font-extrabold italic text-slate-800 dark:text-slate-200 text-center text-[11px]">
                {companyMotto}
              </p>
            )}
            {counselors && counselors.length > 0 && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300">
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
              const isLiked = likedIds[item.id];
              const isUrgent = item.priority === "urgent";
              const isImportant = item.priority === "important";
              const authorName = item.profiles?.full_name ?? "Coordenação";

              return (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-2xl p-3.5 transition-all border-2 ${
                    isUrgent
                      ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                      : isImportant
                      ? "border-slate-900 dark:border-slate-600 bg-amber-50/70 dark:bg-amber-950/20 shadow-brutal-sm"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isUrgent && (
                        <span className="flex items-center gap-1 rounded-md bg-red-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                          <Pin className="h-2.5 w-2.5" /> Urgente
                        </span>
                      )}
                      {isImportant && (
                        <span className="flex items-center gap-1 rounded-md bg-[#FF6B8B] px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                          <Pin className="h-2.5 w-2.5" /> Importante
                        </span>
                      )}
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(item.created_at)}
                    </span>
                  </div>

                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                    {item.content}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-slate-900/5 dark:border-slate-700 text-[11px]">
                    <span className="font-bold text-slate-500">
                      Por <strong className="text-slate-800 dark:text-slate-200">{authorName}</strong>
                    </span>

                    <button
                      onClick={() => toggleLike(item.id)}
                      className={`flex items-center gap-1 font-bold rounded-lg px-2 py-0.5 transition-colors ${
                        isLiked
                          ? "text-[#FF6B8B] bg-pink-100 dark:bg-pink-950/50"
                          : "text-slate-400 hover:text-[#FF6B8B]"
                      }`}
                    >
                      <Heart className={`h-3 w-3 ${isLiked ? "fill-[#FF6B8B]" : ""}`} />
                      <span>{isLiked ? "1" : "0"}</span>
                    </button>
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
