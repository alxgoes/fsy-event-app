import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Camera, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MagneticCarousel, CarouselImage } from "@/components/ui/MagneticCarousel";
import NeonBorder from "@/components/ui/NeonBorder";

export interface MediaPhoto {
  id: string;
  title: string;
  drive_url: string;
  thumbnail_url: string | null;
  category: string;
  visible: boolean;
  created_at: string;
}

function resolveCardThumbnail(photo: MediaPhoto): string | null {
  if (photo.thumbnail_url) return photo.thumbnail_url;
  const url = photo.drive_url;
  if (!url) return null;

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = fileMatch ? fileMatch[1] : url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }

  return url;
}

function resolveHighResPhoto(photo: MediaPhoto): string | null {
  if (photo.thumbnail_url) {
    if (photo.thumbnail_url.includes("sz=w")) {
      return photo.thumbnail_url.replace(/sz=w\d+/, "sz=w2000");
    }
    return photo.thumbnail_url;
  }
  const url = photo.drive_url;
  if (!url) return null;

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const fileId = fileMatch ? fileMatch[1] : url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
  }

  return url;
}

/** Converts MediaPhoto array into CarouselImage array for MagneticCarousel */
function toCarouselImages(photos: MediaPhoto[]): CarouselImage[] {
  const result: CarouselImage[] = [];
  for (const p of photos) {
    const src = resolveCardThumbnail(p);
    if (src) {
      const highResSrc = resolveHighResPhoto(p) || src;
      result.push({ src, highResSrc, alt: p.title });
    }
  }
  return result;
}

export function FeaturedPhotosSection({
  initialPhotos,
  initialLoading,
}: {
  initialPhotos?: MediaPhoto[];
  initialLoading?: boolean;
} = {}) {
  const [photos, setPhotos] = useState<MediaPhoto[]>(initialPhotos ?? []);
  const [loading, setLoading] = useState(
    initialLoading !== undefined ? initialLoading : initialPhotos === undefined
  );
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (initialPhotos !== undefined) {
      setPhotos(initialPhotos);
      setLoading(false);
      return;
    }

    async function loadFeaturedPhotos() {
      try {
        const res = await fetch(`/api/media?_t=${Date.now()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.data && Array.isArray(json.data)) {
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
  }, [initialPhotos]);

  // Strict conditional rendering: if loading or no photos, render nothing
  if (loading || photos.length === 0) {
    return null;
  }

  const carouselImages = toCarouselImages(photos);

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="relative flex flex-col justify-between rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-7 text-slate-900 dark:text-slate-100 shadow-brutal-md"
    >
      <div>
        {/* Header Bar — consistent with MemoriesCard and overall site layout */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-5 border-b-2 border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#007DA5] via-[#01B6D1] to-[#005E7C] text-white border-2 border-slate-900 dark:border-slate-700 shadow-sm shrink-0">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-[#007DA5] dark:text-[#7DE3F4] flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-[#FFB81C]" /> Galeria Oficial
                </span>
                <span className="rounded-full bg-sky-100 dark:bg-sky-950 px-2.5 py-0.5 text-xs font-black text-[#007DA5] border border-sky-200 dark:border-sky-800">
                  #FSYRibeirao2
                </span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {photos.length} {photos.length === 1 ? "foto" : "fotos"}
                </span>
              </div>
              <h3 className="font-heading text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                Fotos em Destaque ✨
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline-block">
              Passe o mouse para explorar · Clique para ampliar
            </span>
          </div>
        </div>

        {/* Cinematic Stage with Depth & NeonBorder */}
        <div className="relative rounded-2xl border-2 border-slate-900 dark:border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-6 shadow-inner overflow-hidden">
          {/* Animated Neon Border tracing the exact rounded-2xl boundary */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <NeonBorder
              color="#01B6D1"
              rounded={16}
              thickness={3}
              borderSize={40}
              glow={75}
              movement="continuous"
              speed={8}
            />
          </div>

          {/* Ambient stage glow for luxury lighting depth */}
          <div className="absolute top-0 left-1/3 w-1/3 h-28 bg-[#01B6D1]/15 blur-3xl pointer-events-none" />

          {/* Magnetic Carousel */}
          <div className="min-h-[330px] md:h-[380px] relative w-full overflow-hidden flex items-center justify-center">
            <MagneticCarousel
              images={carouselImages}
              collapsedWidth={carouselImages.length <= 4 ? 110 : carouselImages.length <= 6 ? 95 : 75}
              hoverWidth={carouselImages.length <= 4 ? 225 : carouselImages.length <= 6 ? 200 : 180}
              collapsedHeight={320}
              hoverHeight={360}
              gap={14}
              influence={carouselImages.length <= 4 ? 250 : 210}
            />
          </div>

          {/* Mobile interaction hint */}
          <p className="mt-2 text-center text-[11px] font-bold text-slate-300 md:hidden flex items-center justify-center gap-1">
            <span>👈 Deslize para o lado · Toque para ampliar 👉</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
