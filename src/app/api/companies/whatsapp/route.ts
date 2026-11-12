import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/permissions";
import { matchesCompany } from "@/lib/companies/match";
import { isSameOriginRequest } from "@/lib/security/origin";
import { createRateLimiter } from "@/lib/security/rate-limit";
import {
  INVALID_WHATSAPP_INVITE_MESSAGE,
  companyWhatsappUpdateSchema,
  normalizeWhatsappInvite,
  type CompanyWhatsappLink,
} from "@/types/company-whatsapp";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const updateRateLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

interface CompanyRow {
  id: string;
  name: string;
  counselors?: string[] | null;
}

interface WhatsappLinkRow {
  company_id: string;
  invite_url: string;
  updated_by: string | null;
  updated_at: string | null;
}

interface ProfileSummaryRow {
  id: string;
  full_name: string | null;
  role: string | null;
  company_id: string | null;
  suspended_at?: string | null;
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist")
  );
}

function computeHasCounselor(company: CompanyRow, profiles: ProfileSummaryRow[]): boolean {
  const companyCounselors = profiles.filter(
    (p) => p.role === "consultor" && matchesCompany(p.company_id, company)
  );
  if (companyCounselors.some((p) => !p.suspended_at)) {
    return true;
  }
  if (companyCounselors.length > 0) {
    return false;
  }
  return (
    Array.isArray(company.counselors) &&
    company.counselors.some((c) => typeof c === "string" && c.trim().length > 0)
  );
}

export async function GET() {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  const { identity } = auth;

  const isManager = hasRole(identity.role, "companyManagers");
  const isCounselor = identity.role === "consultor";
  const isYouth = identity.role === "jovem";

  if (!isManager && !isCounselor && !isYouth) {
    return json({ data: [] as CompanyWhatsappLink[] });
  }

  const ownCompanyId = identity.profile.company_id?.trim() || null;
  if (!isManager && !ownCompanyId) {
    return json({ data: [] as CompanyWhatsappLink[] });
  }

  try {
    const supabase = createAdminClient();

    if (isManager) {
      const [companiesRes, linksRes, profilesRes] = await Promise.all([
        supabase.from("companies").select("id, name, counselors").order("name", { ascending: true }),
        supabase
          .from("company_whatsapp_links")
          .select("company_id, invite_url, updated_by, updated_at"),
        supabase
          .from("profiles")
          .select("id, full_name, role, company_id, suspended_at"),
      ]);

      if (companiesRes.error) return serverError("companies.whatsapp.companies", companiesRes.error);
      if (linksRes.error && !isMissingTableError(linksRes.error)) {
        return serverError("companies.whatsapp.links", linksRes.error);
      }
      if (profilesRes.error) return serverError("companies.whatsapp.profiles", profilesRes.error);

      const companies = ((companiesRes.data ?? []) as CompanyRow[]).slice().sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "pt-BR")
      );
      const links = (linksRes.data ?? []) as WhatsappLinkRow[];
      const profiles = (profilesRes.data ?? []) as ProfileSummaryRow[];

      const linkByCompany = new Map<string, WhatsappLinkRow>();
      for (const row of links) {
        if (row && typeof row.company_id === "string") {
          linkByCompany.set(row.company_id, row);
        }
      }
      const profileNameById = new Map<string, string>();
      for (const p of profiles) {
        if (p && typeof p.id === "string" && p.full_name) {
          profileNameById.set(p.id, p.full_name);
        }
      }

      const data: CompanyWhatsappLink[] = companies.map((comp) => {
        const link = linkByCompany.get(comp.id);
        const normalizedUrl = link?.invite_url ? normalizeWhatsappInvite(link.invite_url) : null;
        return {
          company_id: comp.id,
          company_name: comp.name,
          invite_url: normalizedUrl,
          updated_at: normalizedUrl ? link?.updated_at ?? null : null,
          updated_by_name:
            normalizedUrl && link?.updated_by
              ? profileNameById.get(link.updated_by) ?? null
              : null,
          can_edit: true,
          has_counselor: computeHasCounselor(comp, profiles),
        };
      });

      return json({ data });
    }

    // Escopo estrito para jovem ou consultor: apenas a própria companhia
    const [companiesRes, linksRes] = await Promise.all([
      supabase.from("companies").select("id, name, counselors").eq("id", ownCompanyId),
      supabase
        .from("company_whatsapp_links")
        .select("company_id, invite_url, updated_by, updated_at")
        .eq("company_id", ownCompanyId),
    ]);

    if (companiesRes.error) return serverError("companies.whatsapp.company", companiesRes.error);
    if (linksRes.error && !isMissingTableError(linksRes.error)) {
      return serverError("companies.whatsapp.link", linksRes.error);
    }

    const company = ((companiesRes.data ?? []) as CompanyRow[]).find(
      (c) => c.id === ownCompanyId
    );
    if (!company) {
      return json({ data: [] as CompanyWhatsappLink[] });
    }

    const link = ((linksRes.data ?? []) as WhatsappLinkRow[]).find(
      (l) => l.company_id === ownCompanyId
    );
    const normalizedUrl = link?.invite_url ? normalizeWhatsappInvite(link.invite_url) : null;

    let updatedByName: string | null = null;
    if (isCounselor && normalizedUrl && link?.updated_by) {
      const { data: updaterRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", link.updated_by);
      const updater = ((updaterRows ?? []) as Array<{ id: string; full_name: string | null }>).find(
        (u) => u.id === link.updated_by
      );
      updatedByName = updater?.full_name ?? null;
    }

    const item: CompanyWhatsappLink = {
      company_id: company.id,
      company_name: company.name,
      invite_url: normalizedUrl,
      updated_at: normalizedUrl ? link?.updated_at ?? null : null,
      updated_by_name: isYouth ? null : updatedByName,
      can_edit: isCounselor,
      has_counselor: isCounselor ? true : computeHasCounselor(company, []),
    };

    return json({ data: [item] });
  } catch (err) {
    return serverError("companies.whatsapp.get", err);
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }

  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  const { identity } = auth;

  const isManager = hasRole(identity.role, "companyManagers");
  const isCounselor = identity.role === "consultor";

  if (!isManager && !isCounselor) {
    return json(
      { error: "Seu cargo não permite alterar o link do grupo da companhia." },
      403
    );
  }

  if (!updateRateLimiter.hit(identity.user.id)) {
    return json(
      { error: "Muitas alterações seguidas. Aguarde um minuto e tente novamente." },
      429
    );
  }

  const parsed = companyWhatsappUpdateSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? INVALID_WHATSAPP_INVITE_MESSAGE },
      400
    );
  }

  const companyId = parsed.data.company_id.trim();
  const rawInviteUrl = parsed.data.invite_url;

  if (isCounselor) {
    const ownCompanyId = identity.profile.company_id?.trim() || null;
    if (!ownCompanyId || ownCompanyId !== companyId) {
      return json({ error: "Companhia não encontrada." }, 404);
    }
  }

  let normalizedInvite: string | null = null;
  if (rawInviteUrl !== null) {
    normalizedInvite = normalizeWhatsappInvite(rawInviteUrl);
    if (!normalizedInvite) {
      return json({ error: INVALID_WHATSAPP_INVITE_MESSAGE }, 400);
    }
  }

  try {
    const supabase = createAdminClient();

    const { data: companyRows, error: companyError } = await supabase
      .from("companies")
      .select("id, name, counselors")
      .eq("id", companyId);
    if (companyError) return serverError("companies.whatsapp.company", companyError);

    const company = ((companyRows ?? []) as CompanyRow[]).find(
      (c) => c.id === companyId
    );
    if (!company) {
      return json({ error: "Companhia não encontrada." }, 404);
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("company_whatsapp_links")
      .select("company_id, invite_url, updated_by, updated_at")
      .eq("company_id", companyId);
    if (existingError && !isMissingTableError(existingError)) {
      return serverError("companies.whatsapp.read", existingError);
    }

    const existing = ((existingRows ?? []) as WhatsappLinkRow[]).find(
      (row) => row.company_id === companyId
    );

    const actionVerb: "adicionou" | "alterou" | "removeu" =
      normalizedInvite === null
        ? "removeu"
        : existing?.invite_url
        ? "alterou"
        : "adicionou";

    const nowIso = new Date().toISOString();

    if (normalizedInvite === null) {
      const { error: deleteError } = await supabase
        .from("company_whatsapp_links")
        .delete()
        .eq("company_id", companyId);
      if (deleteError) return serverError("companies.whatsapp.delete", deleteError);
    } else {
      const { error: upsertError } = await supabase
        .from("company_whatsapp_links")
        .upsert(
          {
            company_id: companyId,
            invite_url: normalizedInvite,
            updated_by: identity.user.id,
            updated_at: nowIso,
          },
          { onConflict: "company_id" }
        );
      if (upsertError) return serverError("companies.whatsapp.upsert", upsertError);
    }

    const actionLabel =
      actionVerb === "removeu"
        ? "Link do WhatsApp Removido"
        : actionVerb === "alterou"
        ? "Link do WhatsApp Atualizado"
        : "Link do WhatsApp Adicionado";

    const { error: auditError } = await supabase.from("counselor_audit_logs").insert({
      author_id: identity.user.id,
      author_name: identity.profile.full_name,
      author_role: identity.role,
      company_id: company.id,
      company_name: company.name,
      action_type: "atualizou_whatsapp_companhia",
      action_label: actionLabel,
      title: actionLabel,
      content: `${identity.profile.full_name} ${actionVerb} o link do grupo do WhatsApp da companhia ${company.name}.`,
      details: {
        operation: actionVerb,
        had_previous_link: Boolean(existing?.invite_url),
        has_link: Boolean(normalizedInvite),
      },
    });
    if (auditError) {
      console.error("[api] companies.whatsapp.audit", auditError.code ?? "");
    }

    let hasCounselor = true;
    if (!isCounselor) {
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, role, company_id, suspended_at");
      if (profilesError) return serverError("companies.whatsapp.profiles", profilesError);
      hasCounselor = computeHasCounselor(
        company,
        (profileRows ?? []) as ProfileSummaryRow[]
      );
    }

    const result: CompanyWhatsappLink = {
      company_id: company.id,
      company_name: company.name,
      invite_url: normalizedInvite,
      updated_at: normalizedInvite ? nowIso : null,
      updated_by_name: normalizedInvite ? identity.profile.full_name : null,
      can_edit: true,
      has_counselor: hasCounselor,
    };

    return json({ data: result, audited: !auditError });
  } catch (err) {
    return serverError("companies.whatsapp.put", err);
  }
}
