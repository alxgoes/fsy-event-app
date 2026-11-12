import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/permissions";
import { resolveAvatarUrl } from "@/lib/profile-photo/server";

export const dynamic = "force-dynamic";

/**
 * Fotos aprovadas dos jovens de uma companhia, para o painel do consultor.
 * Consultor: só a própria companhia. Gestão: qualquer uma (?company_id=).
 */
export async function GET(request: Request) {
  const auth = await requireIdentity("counselorPanel");
  if (auth.response) return auth.response;
  const { identity } = auth;
  const requested = request?.url ? new URL(request.url).searchParams.get("company_id") : null;
  const companyId = hasRole(identity.role, "accountGuardians") ? requested ?? identity.profile.company_id : identity.profile.company_id;
  if (!companyId) return json({ data: {} });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, avatar_url, company_id")
      .eq("company_id", companyId)
      .not("avatar_url", "is", null)
      .limit(200);
    if (error) return serverError("profile-photo.company", error);
    const filteredRows = (data ?? []).filter(
      (row: { id: string; avatar_url: string | null; company_id?: string | null }) =>
        row.company_id === undefined || row.company_id === companyId
    );
    const entries = await Promise.all(
      filteredRows.map(async (row) => [row.id, await resolveAvatarUrl(admin, row.avatar_url)] as const)
    );
    return json({ data: Object.fromEntries(entries.filter(([, url]) => url)) });
  } catch (err) {
    return serverError("profile-photo.company", err);
  }
}
