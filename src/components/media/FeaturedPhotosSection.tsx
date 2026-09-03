import React, { useState, useEffect } from "react";
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

function resolveOriginalDownloadUrl(photo: MediaPhoto): string {
  const url = photo.drive_url;
  if (!url) return photo.thumbnail_url || "#";

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
  }

  return url;
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

/** Converts MediaPhoto array into CarouselImage array for MagneticCarousel */
function toCarouselImages(photos: MediaPhoto[]): CarouselImage[] {
  return photos
    .map((p) => {
      const src = resolveCardThumbnail(p);
      if (!src) return null;
      return { src, alt: p.title };
    })
    .filter((x): x is CarouselImage => x !== null);
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
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#007DA5] text-white shadow-sm">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#005E7C] dark:text-[#7DE3F4]">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Fotos em Destaque</span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              Registros da Sessão
            </h3>
          </div>
        </div>
      </div>

      {/* Magnetic Carousel — card-style panel with NeonBorder */}
      <div className="relative rounded-3xl border-2 border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/60 overflow-visible">
        {/* Animated neon border */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
          <NeonBorder
            color="#007DA5"
            rounded={100}
            thickness={3}
            borderSize={45}
            glow={80}
            movement="continuous"
            speed={8}
          />
        </div>

        <div style={{ height: 380, position: "relative", padding: "20px 16px 0" }}>
          <MagneticCarousel
            images={carouselImages}
            collapsedWidth={75}
            hoverWidth={200}
            collapsedHeight={340}
            hoverHeight={380}
            openSize={500}
            gap={10}
            influence={220}
            blur={2}
            transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
          />
        </div>

        {/* Hint */}
        <p className="py-3 text-center text-xs font-bold text-slate-400 dark:text-slate-500">
          Passe o mouse para explorar · Clique para ampliar
        </p>
      </div>
    </div>
  );
}
