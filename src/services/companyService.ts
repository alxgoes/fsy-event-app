import { createClient } from "@/lib/supabase/client";

export interface CompanyData {
  id: string;
  name: string;
  motto: string | null;
  counselors: string[] | null;
}

export async function getCompany(
  companyId: string
): Promise<{ data: CompanyData | null; fromCache: boolean }> {
  if (!companyId) return { data: null, fromCache: false };

  const storageKey = `fsy_offline_company_${companyId}`;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single();

    if (data && !error) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch {}
      }
      return { data: data as CompanyData, fromCache: false };
    }
  } catch {
    // Network or fetch error
  }

  // Fallback to cache
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        return { data: JSON.parse(cached) as CompanyData, fromCache: true };
      }
    } catch {}
  }

  return { data: null, fromCache: true };
}
