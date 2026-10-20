import { createClient } from "@/lib/supabase/client";
import type { MediaPhoto } from "@/types/media";
import { allowsDirectFallback, cachedRequest, fetchJson, sessionScope } from "@/lib/requests/client";

const STORAGE_KEY = "fsy_offline_featured_photos";
const PHOTOS_TTL_MS = 60_000;

export async function getFeaturedPhotos(signal?: AbortSignal): Promise<{ data: MediaPhoto[]; fromCache: boolean }> {
  try {
    const scope = await sessionScope();
    const data = await cachedRequest(
      `media:${scope}:featured`,
      async (signal) => {
        try {
          const json = await fetchJson<{ data?: MediaPhoto[] }>("/api/media", signal);
          if (!Array.isArray(json.data)) throw new Error("Resposta inválida de /api/media");
          return json.data.filter((p) => p.visible);
        } catch (error) {
          if (!allowsDirectFallback(error)) throw error;
          const { data: dbData, error: dbError } = await createClient()
            .from("media_photos")
            .select("*")
            .eq("visible", true)
            .order("created_at", { ascending: false })
            .abortSignal(signal);
          if (dbError || !dbData?.length) throw dbError ?? error;
          return dbData as MediaPhoto[];
        }
      },
      { ttlMs: PHOTOS_TTL_MS, signal }
    );

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {}
    }
    return { data, fromCache: false };
  } catch {}

  // Fallback to cache
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        return { data: JSON.parse(cached) as MediaPhoto[], fromCache: true };
      }
    } catch {}
  }

  return { data: [], fromCache: true };
}
