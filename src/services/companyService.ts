import { createClient } from "@/lib/supabase/client";
import { getOfflineCacheKey } from "@/services/offlineCache";
import { cachedRequest, sessionScope } from "@/lib/requests/client";

const COMPANY_TTL_MS = 60_000;

export interface CompanyData {
  id: string;
  name: string;
  motto: string | null;
  counselors: string[] | null;
}

export async function getCompany(
  companyId: string, signal?: AbortSignal
): Promise<{ data: CompanyData | null; fromCache: boolean }> {
  if (!companyId) return { data: null, fromCache: false };

  const storageKey = await getOfflineCacheKey("company", companyId);

  try {
    const scope = await sessionScope();
    const data = await cachedRequest(
      `company:${scope}:${companyId}`,
      async (signal) => {
        const { data, error } = await createClient()
          .from("companies")
          .select("*")
          .eq("id", companyId)
          .abortSignal(signal)
          .single();
        if (error || !data) throw error ?? new Error("Companhia não encontrada");
        return data as CompanyData;
      },
      { ttlMs: COMPANY_TTL_MS, signal }
    );

    if (storageKey && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {}
    }
    return { data, fromCache: false };
  } catch {
    // Network or fetch error
  }

  // Fallback to cache
  if (storageKey && typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        return { data: JSON.parse(cached) as CompanyData, fromCache: true };
      }
    } catch {}
  }

  return { data: null, fromCache: true };
}
