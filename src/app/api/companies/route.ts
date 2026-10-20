import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/permissions";
import { companySaveSchema } from "@/types/companies";
import { matchesCompany } from "@/lib/companies/match";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  try {
    const supabase = createAdminClient();
    const isManager = hasRole(auth.identity.role, "companyManagers");

    const companiesRes = await supabase.from("companies").select("*").order("name", { ascending: true });
    if (companiesRes.error) return serverError("companies.get", companiesRes.error);
    const companies = companiesRes.data ?? [];

    if (!isManager) {
      // Participantes e consultores recebem apenas dados públicos das companhias.
      return json({
        companies: companies.map(({ id, name, motto, color, counselors }) => ({ id, name, motto, color, counselors: counselors ?? [] })),
      });
    }

    const [profilesRes, medicalRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, role, company_id, avatar_url").order("full_name", { ascending: true }),
      supabase.from("medical_records").select("id, full_name, company_id, emergency_contact_name"),
    ]);
    if (profilesRes.error) return serverError("companies.profiles", profilesRes.error);
    const profiles = profilesRes.data ?? [];
    const medicalRecords = medicalRes.data ?? [];

    const enrichedCompanies = companies.map((comp) => {
      const youth = new Set<string>();
      profiles
        .filter((p) => p.role === "jovem" && matchesCompany(p.company_id, comp))
        .forEach((p) => youth.add((p.full_name || p.id).trim().toLowerCase()));
      medicalRecords
        .filter((m) => m.emergency_contact_name !== "A registrar" && matchesCompany(m.company_id, comp))
        .forEach((m) => m.full_name && youth.add(m.full_name.trim().toLowerCase()));

      const counselorsInComp = profiles.filter((p) => p.role === "consultor" && matchesCompany(p.company_id, comp));
      return {
        ...comp,
        youth_count: youth.size,
        counselor_profiles: counselorsInComp,
        counselors: counselorsInComp.length > 0 ? counselorsInComp.map((c) => c.full_name) : comp.counselors ?? [],
      };
    });

    return json({
      companies: enrichedCompanies,
      all_counselors: profiles.filter((p) => p.role === "consultor"),
    });
  } catch (err) {
    return serverError("companies.get", err);
  }
}

async function saveCompany(request: Request, isNew: boolean) {
  const auth = await requireIdentity("companyManagers");
  if (auth.response) return auth.response;
  try {
    const parsed = companySaveSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Confira os campos da companhia." }, 400);
    const input = parsed.data;
    const companyId = isNew
      ? (input.id || `cia-${Date.now().toString().slice(-4)}`).trim().toLowerCase().replace(/\s+/g, "-")
      : input.id;
    if (!companyId) return json({ error: "ID da companhia é obrigatório." }, 400);

    // Companhia e vínculos dos consultores são gravados numa única transação.
    const { data, error } = await createAdminClient().rpc("admin_save_company", {
      p_id: companyId,
      p_is_new: isNew,
      p_name: input.name ?? null,
      p_motto: input.motto === undefined ? null : input.motto,
      p_set_motto: input.motto !== undefined,
      p_color: input.color ?? null,
      p_counselor_ids: input.counselor_ids ?? null,
      p_actor_id: auth.identity.user.id,
    });
    if (error) {
      if (error.code === "23505") return json({ error: "Já existe uma companhia com este identificador." }, 409);
      if (error.code === "P0002") return json({ error: "Companhia não encontrada." }, 404);
      return serverError("companies.save", error);
    }
    return json({ success: true, company: data });
  } catch (err) {
    return serverError("companies.save", err);
  }
}

export async function POST(request: Request) {
  return saveCompany(request, true);
}

/** Gestores editam tudo; consultores editam somente o lema da própria companhia. */
export async function PUT(request: Request) {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  if (hasRole(auth.identity.role, "companyManagers")) return saveCompany(request, false);
  if (auth.identity.role !== "consultor") return json({ error: "Seu cargo não permite esta ação." }, 403);

  try {
    const body = await request.json();
    const allowedKeys = new Set(["id", "motto", "previous_motto", "author_id", "author_name", "author_role"]);
    if (Object.keys(body ?? {}).some((key) => !allowedKeys.has(key))) {
      return json({ error: "Consultores podem alterar apenas o lema da companhia." }, 403);
    }
    if (!body.id || body.id !== auth.identity.profile.company_id) {
      return json({ error: "Você só pode alterar o lema da sua companhia." }, 403);
    }
    const motto = typeof body.motto === "string" && body.motto.trim() ? body.motto.trim().slice(0, 300) : null;

    const supabase = createAdminClient();
    const { data: previous, error: readError } = await supabase.from("companies").select("id, name, motto").eq("id", body.id).single();
    if (readError || !previous) return json({ error: "Companhia não encontrada." }, 404);

    const { data: updated, error } = await supabase
      .from("companies")
      .update({ motto, updated_at: new Date().toISOString() })
      .eq("id", body.id)
      .select()
      .single();
    if (error) return serverError("companies.motto", error);

    const { error: auditError } = await supabase.from("counselor_audit_logs").insert({
      author_id: auth.identity.user.id,
      author_name: auth.identity.profile.full_name,
      author_role: auth.identity.role,
      company_id: body.id,
      company_name: updated?.name || previous.name || body.id,
      action_type: "atualizou_grito_de_guerra",
      action_label: "Lema / Grito de Guerra Atualizado",
      title: "Novo Lema / Grito de Guerra da Companhia",
      content: motto ?? "(Lema removido)",
      details: { previous_motto: previous.motto ?? null },
    });
    if (auditError) console.error("[api] companies.motto.audit", auditError.code ?? "");

    return json({ success: true, company: updated, audited: !auditError });
  } catch (err) {
    return serverError("companies.motto", err);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireIdentity("companyManagers");
  if (auth.response) return auth.response;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "ID da companhia é obrigatório." }, 400);
    const { error } = await createAdminClient().rpc("admin_delete_company", { p_id: id, p_actor_id: auth.identity.user.id });
    if (error) {
      if (error.code === "P0002") return json({ error: "Companhia não encontrada." }, 404);
      return serverError("companies.delete", error);
    }
    return json({ success: true });
  } catch (err) {
    return serverError("companies.delete", err);
  }
}
