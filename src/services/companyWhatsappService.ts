import { getOfflineCacheKey } from "@/services/offlineCache";
import { cachedRequest, sessionScope } from "@/lib/requests/client";
import {
  normalizeWhatsappInvite,
  type CompanyWhatsappLink,
} from "@/types/company-whatsapp";

const COMPANY_WHATSAPP_TTL_MS = 60_000;

export async function getCompanyWhatsappLink(
  companyId: string,
  signal?: AbortSignal
): Promise<CompanyWhatsappLink | null> {
  if (!companyId) return null;

  const storageKey = await getOfflineCacheKey("company_whatsapp", companyId);

  try {
    const scope = await sessionScope();
    const item = await cachedRequest(
      `company_whatsapp:${scope}:${companyId}`,
      async (reqSignal) => {
        const res = await fetch("/api/companies/whatsapp", {
          cache: "no-store",
          signal: reqSignal,
        });
        if (!res.ok) throw new Error("Falha ao carregar link do WhatsApp");
        const body = (await res.json()) as { data?: CompanyWhatsappLink[] };
        const rows = Array.isArray(body.data) ? body.data : [];
        const match = rows.find((row) => row.company_id === companyId) ?? null;
        if (!match) return null;
        return {
          ...match,
          invite_url: match.invite_url
            ? normalizeWhatsappInvite(match.invite_url)
            : null,
        };
      },
      { ttlMs: COMPANY_WHATSAPP_TTL_MS, signal }
    );

    if (storageKey && typeof window !== "undefined") {
      try {
        if (item) {
          localStorage.setItem(storageKey, JSON.stringify(item));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {}
    }
    return item;
  } catch {
    // Fallback to offline cache
  }

  if (storageKey && typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as CompanyWhatsappLink;
        return {
          ...parsed,
          invite_url: parsed.invite_url
            ? normalizeWhatsappInvite(parsed.invite_url)
            : null,
        };
      }
    } catch {}
  }

  return null;
}
