import { createClient } from "@/lib/supabase/client";
import { getOfflineCacheKey } from "@/services/offlineCache";
import {
  allowsDirectFallback,
  cachedRequest,
  fetchJson,
  invalidateRequests,
  sessionScope,
} from "@/lib/requests/client";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  category?: string;
  created_at: string;
  target_company_id?: string | null;
  liked_by?: string[];
  likes_count?: number;
  profiles?: { full_name: string; role: string } | null;
}

/** Avisos mudam pouco em segundos; curtidas invalidam a lista. */
const ANNOUNCEMENTS_TTL_MS = 20_000;

export async function getAnnouncements(
  companyId?: string | null, signal?: AbortSignal
): Promise<{ data: Announcement[]; fromCache: boolean }> {
  const storageKey = await getOfflineCacheKey("announcements", companyId);
  try {
    const scope = await sessionScope();
    const endpoint = companyId
      ? `/api/announcements?company_id=${encodeURIComponent(companyId)}`
      : "/api/announcements";

    const data = await cachedRequest(
      `announcements:${scope}:${companyId || "general"}`,
      async (signal) => {
        try {
          const json = await fetchJson<{ data?: Announcement[] }>(endpoint, signal);
          const list = json.data ?? [];
          return companyId ? list : list.filter((a) => !a.target_company_id);
        } catch (error) {
          if (!allowsDirectFallback(error)) throw error;
          const supabase = createClient();
          let query = supabase.from("announcements").select("*, profiles:author_id(full_name, role)");
          if (companyId) {
            query = query.or(`target_company_id.eq.${companyId},target_company_id.is.null`);
          } else {
            query = query.is("target_company_id", null);
          }
          const { data: dbData, error: dbError } = await query
            .order("created_at", { ascending: false })
            .abortSignal(signal);
          if (dbError || !dbData) throw dbError ?? error;
          return dbData as Announcement[];
        }
      },
      { ttlMs: ANNOUNCEMENTS_TTL_MS, signal }
    );

    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {}
    }
    return { data, fromCache: false };
  } catch {
    // Rede indisponível, acesso negado ou falha do servidor
  }

  // Fallback to offline localStorage cache
  if (storageKey && typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        return { data: JSON.parse(cached) as Announcement[], fromCache: true };
      }
    } catch {}
  }

  return { data: [], fromCache: true };
}

export async function toggleLikeAnnouncement(
  announcementId: string
): Promise<{ success: boolean; likesCount?: number }> {
  try {
    const res = await fetch("/api/announcements/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcement_id: announcementId }),
    });
    if (res.ok) {
      const json = await res.json();
      invalidateRequests("announcements:");
      return { success: true, likesCount: json.likes_count };
    }
  } catch {}
  return { success: false };
}
