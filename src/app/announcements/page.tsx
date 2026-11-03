"use client";

import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Avatar } from "@/components/profile/Avatar";
import { useProfile, ROLE_LABELS, type UserRole } from "@/lib/supabase/useProfile";
import { getAnnouncements, toggleLikeAnnouncement, type Announcement } from "@/services/announcementsService";
import { markNoticesRead, NOTICES_UPDATED_EVENT, readNoticeIds } from "@/lib/notifications/readState";
import { relativeTime } from "@/lib/ui/relativeTime";
import { cn } from "@/lib/utils";

type FeedItem = Announcement & { liked_by_me?: boolean };

function LikeButton({ liked, count, onToggle }: { liked: boolean; count: number; onToggle: () => void }) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={liked}
      aria-label={liked ? "Remover curtida" : "Curtir"}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors",
        liked ? "text-[#E0284D] dark:text-[#FC4E6D]" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      )}
    >
      <motion.span
        key={liked ? "on" : "off"}
        initial={reduce || !liked ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 18 }}
        className="inline-flex"
      >
        <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} />
      </motion.span>
      <span className="fsy-figure">{count > 0 ? count : ""}</span>
    </button>
  );
}

function Post({ item, unread, onLike }: { item: FeedItem; unread: boolean; onLike: (id: string) => void }) {
  const author = item.profiles?.full_name || "Coordenação";
  const role = item.profiles?.role as UserRole | undefined;
  const urgent = item.priority === "urgent";
  const important = item.priority === "important";
  const liked = Boolean(item.liked_by_me);

  return (
    <article
      id={`aviso-${item.id}`}
      className={cn(
        "scroll-mt-20 rounded-3xl border bg-white p-4 target:ring-4 target:ring-[#FFE48A] dark:bg-slate-900 sm:p-5",
        urgent ? "border-red-300 dark:border-red-900" : "border-slate-200/80 dark:border-slate-800"
      )}
    >
      <header className="flex items-center gap-3">
        <Avatar name={author} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-950 dark:text-white">{author}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {role ? ROLE_LABELS[role] : "Equipe"} · {relativeTime(item.created_at)}
            {item.target_company_id ? " · sua companhia" : ""}
          </p>
        </div>
        {unread && <span role="img" className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#FC4E6D]" aria-label="Novo" />}
      </header>

      {(urgent || important) && (
        <p
          className={cn(
            "mt-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
            urgent ? "bg-red-700 text-white" : "bg-[#FFE48A] text-slate-950"
          )}
        >
          {urgent ? "Urgente" : "Importante"}
        </p>
      )}
      <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-950 dark:text-white">{item.title}</h2>
      <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-800 dark:text-slate-200">{item.content}</p>

      <footer className="-mb-2 -ml-3 mt-2">
        <LikeButton liked={liked} count={item.likes_count ?? 0} onToggle={() => onLike(item.id)} />
      </footer>
    </article>
  );
}

export default function AnnouncementsPage() {
  const { profile } = useProfile();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<"todos" | "novos">("todos");

  useEffect(() => {
    if (!profile) return;
    const controller = new AbortController();
    startTransition(() => setReadIds(readNoticeIds(profile.id)));
    getAnnouncements(profile.company_id, controller.signal)
      .then(({ data }) => setItems(data as FeedItem[]))
      .catch(() => setItems([]));
    const sync = () => setReadIds(readNoticeIds(profile.id));
    window.addEventListener(NOTICES_UPDATED_EVENT, sync);
    return () => {
      controller.abort();
      window.removeEventListener(NOTICES_UPDATED_EVENT, sync);
    };
  }, [profile]);

  // Ao abrir o feed, o que estava novo fica marcado como lido (o ponto continua visível nesta visita).
  const seenOnOpen = useRef<string[] | null>(null);
  const [readBefore, setReadBefore] = useState<string[] | null>(null);
  useEffect(() => {
    if (!items || !profile || seenOnOpen.current) return;
    const before = readNoticeIds(profile.id);
    seenOnOpen.current = before;
    startTransition(() => setReadBefore(before));
    markNoticesRead(profile.id, items.map((i) => i.id).filter((id) => !before.includes(id)));
  }, [items, profile]);

  const known = readBefore ?? readIds;
  const visible = useMemo(
    () => (items ?? []).filter((i) => filter === "todos" || !known.includes(i.id)),
    [items, filter, known]
  );
  const newCount = (items ?? []).filter((i) => !known.includes(i.id)).length;

  async function like(id: string) {
    const previous = items;
    setItems((list) =>
      (list ?? []).map((i) =>
        i.id === id ? { ...i, liked_by_me: !i.liked_by_me, likes_count: Math.max(0, (i.likes_count ?? 0) + (i.liked_by_me ? -1 : 1)) } : i
      )
    );
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    const result = await toggleLikeAnnouncement(id);
    if (!result.success) setItems(previous);
    else if (typeof result.likesCount === "number") {
      setItems((list) => (list ?? []).map((i) => (i.id === id ? { ...i, likes_count: result.likesCount } : i)));
    }
  }

  return (
    <div className="min-h-screen pb-28 md:pb-12">
      <Header />
      <main className="mx-auto max-w-xl px-4 pt-6">
        <div className="flex min-w-0 flex-col items-start gap-3">
          <h1 className="font-heading text-3xl font-bold text-slate-950 dark:text-white">Avisos</h1>
          <div role="tablist" aria-label="Filtrar avisos" className="grid w-full min-w-0 max-w-sm grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-1 rounded-2xl bg-slate-200/60 p-1 dark:bg-slate-800">
            {(["todos", "novos"] as const).map((key) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "relative min-h-11 min-w-0 whitespace-normal break-words rounded-full px-3 py-2 text-sm font-medium transition-colors",
                  filter === key ? "text-slate-950 dark:text-white" : "text-slate-600 dark:text-slate-300"
                )}
              >
                {filter === key && (
                  <motion.span layoutId="avisos-filter" className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-slate-950" transition={{ type: "spring", stiffness: 500, damping: 44 }} />
                )}
                <span className="relative">{key === "todos" ? "Todos" : `Novos${newCount ? ` (${newCount})` : ""}`}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {items === null ? (
            [0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800" />)
          ) : visible.length === 0 ? (
            <p className="rounded-3xl bg-white px-5 py-10 text-center text-[15px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {filter === "novos" ? "Você já viu todos os avisos." : "Nenhum aviso por enquanto. Quando a coordenação ou seus consultores postarem, aparece aqui."}
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {visible.map((item) => (
                <motion.div key={item.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Post item={item} unread={!known.includes(item.id)} onLike={like} />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
}
