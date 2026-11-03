"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { PhotoGallery } from "@/components/media/PhotoGallery";
import { MemoriesCard } from "@/components/dashboard/MemoriesCard";
import { getFeaturedPhotos } from "@/services/mediaService";
import type { MediaPhoto } from "@/types/media";

export default function FotosPage() {
  const [photos, setPhotos] = useState<MediaPhoto[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getFeaturedPhotos(controller.signal)
      .then(({ data }) => setPhotos(data))
      .catch(() => setPhotos([]));
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen pb-28 md:pb-12">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6">
        <h1 className="font-heading text-3xl font-bold text-slate-950 dark:text-white">Fotos</h1>
        {photos === null ? (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4" aria-busy aria-label="Carregando fotos">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
        ) : (
          <PhotoGallery photos={photos} />
        )}
        <MemoriesCard />
      </main>
    </div>
  );
}
