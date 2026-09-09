import { createClient } from "@/lib/supabase/client";

/** Partition private offline data; session identity is not server authorization. */
export async function getOfflineCacheKey(
  resource: "company" | "announcements",
  companyId?: string | null
): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    // Older versions shared these entries across signed-in accounts.
    const legacyKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (key === "fsy_offline_announcements" || key?.startsWith("fsy_offline_company_")) {
        legacyKeys.push(key);
      }
    }
    legacyKeys.forEach((key) => localStorage.removeItem(key));

    const { data: { session }, error } = await createClient().auth.getSession();
    if (error || !session?.user.id) return null;

    return `fsy_offline_v2_${resource}_${session.user.id}_${companyId || "general"}`;
  } catch {
    return null;
  }
}