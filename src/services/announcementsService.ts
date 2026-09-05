import { createClient } from "@/lib/supabase/client";

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

const STORAGE_KEY = "fsy_offline_announcements";

export async function getAnnouncements(
  companyId?: string | null
): Promise<{ data: Announcement[]; fromCache: boolean }> {
  try {
    const endpoint = companyId
      ? `/api/announcements?company_id=${encodeURIComponent(companyId)}&_t=${Date.now()}`
      : `/api/announcements?_t=${Date.now()}`;

    const res = await fetch(endpoint, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const list = (json.data ?? []) as Announcement[];
      const filtered = companyId
        ? list
        : list.filter((a) => !a.target_company_id);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        } catch {}
      }
      return { data: filtered, fromCache: false };
    }

    // Direct Supabase fallback
    const supabase = createClient();
    let query = supabase.from("announcements").select("*, profiles:author_id(full_name, role)");
    if (companyId) {
      query = query.or(`target_company_id.eq.${companyId},target_company_id.is.null`);
    } else {
      query = query.is("target_company_id", null);
    }
    const { data: dbData } = await query.order("created_at", { ascending: false });
    if (dbData) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData));
        } catch {}
      }
      return { data: dbData as Announcement[], fromCache: false };
    }
  } catch {
    // Network error or offline
  }

  // Fallback to offline localStorage cache
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
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
      return { success: true, likesCount: json.likes_count };
    }
  } catch {}
  return { success: false };
}
