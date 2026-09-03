"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Camera, Sparkles, X, ZoomIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface MediaPhoto {
  id: string;
  title: string;
  drive_url: string;
  thumbnail_url: string | null;
  category: string;
  visible: boolean;
  created_at: string;
}

function resolveHighResPhoto(photo: MediaPhoto): string | null {
  const url = photo.drive_url;
  if (!url) return photo.thumbnail_url || null;

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=w1600`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}=w1600`;
  }

  return photo.thumbnail_url || url;
}

function resolveCardThumbnail(photo: MediaPhoto): string | null {
  if (photo.thumbnail_url) return photo.thumbnail_url;
  const url = photo.drive_url;
  if (!url) return null;

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=w700`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}=w700`;
  }

  return url;
}

export function FeaturedPhotosSection() {
  const [photos, setPhotos] = useState<MediaPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState<MediaPhoto | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    async function loadFeaturedPhotos() {
      try {
        const res = await fetch(`/api/media?_t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
            // Keep only visible photos
            const visiblePhotos = (json.data as MediaPhoto[]).filter((p) => p.visible);
            setPhotos(visiblePhotos);
            setLoading(false);
            return;
          }
        }

        // Fallback directly to supabase
        const supabase = createClient();
        const { data } = await supabase
          .from("media_photos")
          .select("*")
          .eq("visible", true)
          .order("created_at", { ascending: false });

        if (data) {
          setPhotos(data as MediaPhoto[]);
        }
      } catch (err) {
        console.error("Error loading featured photos:", err);
      } finally {
        setLoading(false);
      }
    }

    loadFeaturedPhotos();
  }, []);

  // Strict conditional rendering: if loading or no photos, render nothing
  if (loading || photos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#007DA5] text-white shadow-sm">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#007DA5] dark:text-[#7DE3F4]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Fotos em Destaque</span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              Registros da Sessão
            </h3>
          </div>
        </div>

        <span className="rounded-full bg-white dark:bg-slate-800 px-3 py-1 text-xs font-black text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 shadow-sm">
          {photos.length} {photos.length === 1 ? "foto" : "fotos"}
        </span>
      </div>

      {/* Modular Bento Box Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo, index) => {
          const thumbUrl = resolveCardThumbnail(photo);
          if (!thumbUrl) return null;

          return (
            <motion.div
              key={photo.id}
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              onClick={() => setActivePhoto(photo)}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Image Container */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl}
                  alt={photo.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading={index < 4 ? "eager" : "lazy"}
                />

                {/* Gradient Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 opacity-70 group-hover:opacity-90 transition-opacity" />

                {/* Top Category Badge */}
                <div className="absolute top-3 left-3">
                  <span className="rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-black text-slate-900 dark:text-white border border-white/20 shadow-sm">
                    {photo.category || "Destaque"}
                  </span>
                </div>

                {/* Zoom Hint Icon */}
                <div className="absolute top-3 right-3 h-8 w-8 rounded-xl bg-black/40 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="h-4 w-4" />
                </div>

                {/* Bottom Title */}
                <div className="absolute bottom-3 left-3 right-3">
                  <h4 className="font-heading text-sm font-black text-white drop-shadow-sm truncate">
                    {photo.title}
                  </h4>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* In-App Lightbox Modal (Zero links to Google Drive) */}
      <AnimatePresence>
        {activePhoto && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            onClick={() => setActivePhoto(null)}
          >
            <motion.div
              initial={shouldReduceMotion ? false : { scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={shouldReduceMotion ? false : { scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative max-h-[90vh] max-w-4xl w-full overflow-hidden rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Bar with Title and Close Button */}
              <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 text-white">
                <div className="flex items-center gap-2.5 min-w-0 pr-4">
                  <span className="rounded-md bg-[#007DA5] px-2 py-0.5 text-[11px] font-black uppercase text-white shrink-0">
                    {activePhoto.category || "Destaque"}
                  </span>
                  <h3 className="font-heading text-base sm:text-lg font-bold truncate">
                    {activePhoto.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors shrink-0"
                  aria-label="Fechar foto"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Lightbox Image Stage */}
              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-2 sm:p-4 min-h-[300px] sm:min-h-[500px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveHighResPhoto(activePhoto) || ""}
                  alt={activePhoto.title}
                  className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-md"
                />
              </div>

              {/* Bottom Details (No Drive Links) */}
              <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/60 px-6 py-3 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-[#007DA5]" />
                  <span>Registro oficial FSY 2027 • Sessão Ribeirão Preto 2</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  className="font-bold text-slate-300 hover:text-white transition-colors"
                >
                  Fechar (Esc)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
