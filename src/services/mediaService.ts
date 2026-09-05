import { createClient } from "@/lib/supabase/client";
import { MediaPhoto } from "@/components/media/FeaturedPhotosSection";

const STORAGE_KEY = "fsy_offline_featured_photos";

export async function getFeaturedPhotos(): Promise<{ data: MediaPhoto[]; fromCache: boolean }> {
  try {
    const res = await fetch(`/api/media?_t=${Date.now()}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        const visible = (json.data as MediaPhoto[]).filter((p) => p.visible);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(visible));
          } catch {}
        }
        return { data: visible, fromCache: false };
      }
    }

    // Direct Supabase fallback
    const supabase = createClient();
    const { data } = await supabase
      .from("media_photos")
      .select("*")
      .eq("visible", true)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {}
      }
      return { data: data as MediaPhoto[], fromCache: false };
    }
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
