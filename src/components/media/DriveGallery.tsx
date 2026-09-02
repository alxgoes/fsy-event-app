"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, FolderOpen, Image as ImageIcon, X, Loader2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DRIVE_FOLDER_ID = "1dfwsm7KDII2bhk5gZZGwKDP4H2NiNIdH";
const DRIVE_EMBED_URL = `https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER_ID}#grid`;
const DRIVE_OPEN_URL = `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}`;

interface MediaPhoto {
  id: string;
  title: string;
  drive_url: string;
  thumbnail_url: string | null;
  category: string;
  visible: boolean;
  created_at: string;
}

function resolveThumbnail(photo: MediaPhoto): string | null {
  if (photo.thumbnail_url) return photo.thumbnail_url;
  const url = photo.drive_url;
  if (!url) return null;

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=w600`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}=w600`;
  }
  return null;
}

export function DriveGallery() {
  const [photos, setPhotos] = useState<MediaPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [activePhoto, setActivePhoto] = useState<MediaPhoto | null>(null);
  const [viewMode, setViewMode] = useState<"gallery" | "drive">("gallery");

  useEffect(() => {
    async function loadPublishedPhotos() {
      setLoading(true);
      try {
        const res = await fetch("/api/media");
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            setPhotos(json.data as MediaPhoto[]);
            setViewMode("gallery");
            setLoading(false);
            return;
          }
        }

        const supabase = createClient();
        const { data } = await supabase
          .from("media_photos")
          .select("*")
          .eq("visible", true)
          .order("created_at", { ascending: false });

        if (data && data.length > 0) {
          setPhotos(data as MediaPhoto[]);
          setViewMode("gallery");
        } else {
          setPhotos([]);
          setViewMode("drive");
        }
      } catch (err) {
        console.error("Error loading gallery:", err);
        setViewMode("drive");
      } finally {
        setLoading(false);
      }
    }

    loadPublishedPhotos();
  }, []);

  const categories = ["Todas", ...Array.from(new Set(photos.map((p) => p.category)))];

  const filteredPhotos =
    selectedCategory === "Todas"
      ? photos
      : photos.filter((p) => p.category === selectedCategory);

  return (
    <div className="space-y-5">
      {/* Sub-Header / View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007DA5] text-white border border-slate-900 shadow-sm">
            <FolderOpen className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-900 dark:text-white">Fotos Oficiais FSY 2027</p>
            <p className="text-xs font-medium text-slate-500">Registros diários da equipe de mídia oficial</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {photos.length > 0 && (
            <div className="flex rounded-xl bg-white dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode("gallery")}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all min-h-[36px] ${
                  viewMode === "gallery"
                    ? "bg-[#007DA5] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Mural de Fotos ({photos.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode("drive")}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all min-h-[36px] ${
                  viewMode === "drive"
                    ? "bg-[#007DA5] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Pasta no Drive
              </button>
            </div>
          )}

          <a
            href={DRIVE_OPEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 px-3.5 py-1.5 text-xs font-black text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm min-h-[36px]"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#007DA5]" />
            Abrir Pasta Completa
          </a>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
        </div>
      ) : viewMode === "gallery" && photos.length > 0 ? (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border min-h-[36px] ${
                    selectedCategory === cat
                      ? "bg-slate-900 text-white dark:bg-[#007DA5] border-slate-900 dark:border-sky-500 shadow-sm -translate-y-0.5"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Photo Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredPhotos.map((photo) => {
              const thumb = resolveThumbnail(photo);
              return (
                <motion.div
                  key={photo.id}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActivePhoto(photo)}
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm aspect-square flex flex-col justify-between"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={photo.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}

                  {/* Fallback card content when image is loading / direct link */}
                  <div className="absolute inset-0 p-3 flex flex-col justify-between bg-gradient-to-br from-[#007DA5]/10 to-[#06D6A0]/10 -z-0">
                    <span className="self-start rounded-md bg-slate-900/90 text-white text-xs font-black px-2 py-0.5 backdrop-blur-sm">
                      {photo.category}
                    </span>
                    <div className="flex flex-col items-center justify-center flex-1 my-auto">
                      <ImageIcon className="h-8 w-8 text-[#007DA5] opacity-60 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {photo.title}
                    </p>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <span className="text-xs font-black uppercase text-[#FFD166]">{photo.category}</span>
                    <p className="text-xs font-black text-white line-clamp-2">{photo.title}</p>
                    <span className="text-xs text-slate-300 mt-1 flex items-center gap-1 font-bold">
                      <Sparkles className="h-3 w-3 text-amber-400" /> Clique para ampliar
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Embedded Google Drive View */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full overflow-hidden rounded-2xl border-2 border-slate-900 dark:border-slate-700 shadow-sm bg-slate-50 dark:bg-slate-800"
          style={{ height: "480px" }}
        >
          <iframe
            src={DRIVE_EMBED_URL}
            title="Fotos FSY Sessão Ribeirão Preto 2"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </motion.div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {activePhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePhoto(null)}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full rounded-3xl border-2 border-slate-900 bg-white dark:bg-slate-900 overflow-hidden shadow-xl"
            >
              <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                {resolveThumbnail(activePhoto) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveThumbnail(activePhoto)!}
                    alt={activePhoto.title}
                    loading="lazy"
                    decoding="async"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-16 w-16 text-slate-600" />
                )}
                <button
                  onClick={() => setActivePhoto(null)}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black uppercase text-[#007DA5] dark:text-cyan-400">
                    {activePhoto.category}
                  </span>
                  <h3 className="font-heading font-black text-base text-slate-900 dark:text-white">
                    {activePhoto.title}
                  </h3>
                </div>

                <a
                  href={activePhoto.drive_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl bg-[#007DA5] text-white px-4 py-2 text-xs font-black border-2 border-slate-900 shadow-sm hover:bg-[#005E7C] transition-colors shrink-0 min-h-[36px]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir no Drive
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
