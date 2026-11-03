"use client";

import React, { startTransition, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { Avatar } from "@/components/profile/Avatar";
import { relativeTime } from "@/lib/ui/relativeTime";
import type { ProfilePhotoReview } from "@/types/profile-photo";

/** Fotos de perfil aguardando a decisão do consultor (ou da gestão). */
export function PhotoReviews({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const reduce = useReducedMotion();
  const [items, setItems] = useState<ProfilePhotoReview[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ProfilePhotoReview | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile/photo/reviews", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível carregar as fotos.");
      setItems(body.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as fotos.");
      setItems((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      load();
    });
  }, [load]);

  useEffect(() => {
    if (items) onCountChange?.(items.length);
  }, [items, onCountChange]);

  async function decide(item: ProfilePhotoReview, decision: "approve" | "reject", reason?: string) {
    setBusy(item.user_id);
    setError(null);
    try {
      const res = await fetch("/api/profile/photo/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: item.user_id, decision, note: reason }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) throw new Error(body.error || "Não foi possível registrar a decisão.");
      setItems((list) => (list ?? []).filter((i) => i.user_id !== item.user_id));
      setRejecting(null);
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a decisão.");
    } finally {
      setBusy(null);
    }
  }

  if (items === null) return <div className="h-28 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-slate-800" />;
  if (items.length === 0 && !error) return null;

  return (
    <section aria-labelledby="photo-reviews-title" className="rounded-3xl border border-[#FFE48A] bg-[#FFE48A]/25 p-5 dark:border-amber-900 dark:bg-amber-950/20">
      <h2 id="photo-reviews-title" className="font-heading text-xl font-bold text-slate-950 dark:text-white">
        Fotos para aprovar <span className="fsy-figure text-base font-semibold text-slate-600 dark:text-slate-300">({items.length})</span>
      </h2>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">A foto só aparece para os outros depois da sua aprovação.</p>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.user_id}
              layout={!reduce}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-4 rounded-2xl bg-white p-3 dark:bg-slate-900"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.pending_url} alt={`Foto enviada por ${item.full_name}`} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-slate-950 dark:text-white">{item.full_name}</p>
                <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  {item.current_url && <Avatar name={item.full_name} src={item.current_url} size={18} />}
                  {item.company_name ? `${item.company_name} · ` : ""}
                  {relativeTime(item.submitted_at)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy === item.user_id}
                    onClick={() => decide(item, "approve")}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#007DA5] px-3 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#005E7C] active:scale-95 disabled:opacity-60"
                  >
                    {busy === item.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Aprovar
                  </button>
                  <button
                    type="button"
                    disabled={busy === item.user_id}
                    onClick={() => {
                      setRejecting(item);
                      setNote("");
                    }}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-slate-300 px-3 text-sm font-medium text-slate-800 transition-[background-color,transform] hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" /> Não aprovar
                  </button>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center" role="dialog" aria-modal aria-labelledby="reject-title">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              decide(rejecting, "reject", note.trim());
            }}
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-float dark:bg-slate-900"
          >
            <h3 id="reject-title" className="text-lg font-semibold text-slate-950 dark:text-white">Não aprovar a foto de {rejecting.full_name.split(" ")[0]}</h3>
            <label htmlFor="reject-note" className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Motivo (a pessoa vai ler)
            </label>
            <textarea
              id="reject-note"
              autoFocus
              required
              minLength={3}
              maxLength={280}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: use uma foto em que seu rosto apareça bem."
              className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-[15px] text-slate-950 focus:border-[#007DA5] focus:outline-none focus:ring-4 focus:ring-[#007DA5]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="min-h-11 rounded-full px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                Voltar
              </button>
              <button
                type="submit"
                disabled={busy === rejecting.user_id || note.trim().length < 3}
                className="min-h-11 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
              >
                Enviar decisão
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
