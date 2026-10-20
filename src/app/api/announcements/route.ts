import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError, pick } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/permissions";
import type { Identity } from "@/lib/supabase/server";
import { announcementSchema, announcementUpdateSchema, baseCategory } from "@/types/announcements";

export const dynamic = "force-dynamic";

const SELECT = "id, title, content, priority, target_company_id, category, created_at, author_id, profiles(full_name, role)";
const COMPANY_ID = /^[\w-]{1,64}$/;

/** Gestores leem tudo; consultores, a própria companhia; demais, a própria companhia e avisos gerais. */
function canManageAll(identity: Identity) {
  return hasRole(identity.role, "announcementManagers");
}

function canTouch(identity: Identity, targetCompanyId: string | null) {
  if (canManageAll(identity)) return true;
  return identity.role === "consultor" && !!targetCompanyId && targetCompanyId === identity.profile.company_id;
}

export async function GET(request: Request) {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  const { identity } = auth;
  try {
    const requested = new URL(request.url).searchParams.get("company_id");
    const supabase = createAdminClient();
    let query = supabase.from("announcements").select(SELECT).order("created_at", { ascending: false });

    const ownCompany = identity.profile.company_id;
    const scope = canManageAll(identity) ? requested : ownCompany;
    if (scope && COMPANY_ID.test(scope)) {
      query = query.or(`target_company_id.eq.${scope},target_company_id.is.null`);
    } else if (!canManageAll(identity) || (requested && !COMPANY_ID.test(requested))) {
      query = query.is("target_company_id", null);
    }

    const { data, error } = await query;
    if (error) return serverError("announcements.get", error);
    const rows = data ?? [];

    const ids = rows.map((row) => row.id);
    const likes = new Map<string, { count: number; mine: boolean }>();
    if (ids.length > 0) {
      const { data: likeRows, error: likeError } = await supabase
        .from("announcement_likes")
        .select("announcement_id, user_id")
        .in("announcement_id", ids);
      if (likeError) console.error("[api] announcements.likes", likeError.code ?? "");
      for (const like of likeRows ?? []) {
        const entry = likes.get(like.announcement_id) ?? { count: 0, mine: false };
        entry.count += 1;
        if (like.user_id === identity.user.id) entry.mine = true;
        likes.set(like.announcement_id, entry);
      }
    }

    return json({
      data: rows.map((row) => {
        const like = likes.get(row.id) ?? { count: 0, mine: false };
        return {
          ...row,
          category: baseCategory(row.category),
          likes_count: like.count,
          liked_by_me: like.mine,
          liked_by: like.mine ? [identity.user.id] : [],
        };
      }),
    });
  } catch (err) {
    return serverError("announcements.get", err);
  }
}

async function recordAudit(
  supabase: ReturnType<typeof createAdminClient>,
  identity: Identity,
  entry: { company_id: string | null; action_type: string; action_label: string; title: string; content: string; details: Record<string, unknown> }
) {
  let companyName: string | null = null;
  if (entry.company_id) {
    const { data: comp } = await supabase.from("companies").select("name").eq("id", entry.company_id).single();
    companyName = comp?.name ?? null;
  }
  const { error } = await supabase.from("counselor_audit_logs").insert({
    author_id: identity.user.id,
    author_name: identity.profile.full_name,
    author_role: identity.role,
    company_name: companyName,
    ...entry,
  });
  if (error) console.error("[api] announcements.audit", error.code ?? "");
  return !error;
}

export async function POST(request: Request) {
  const auth = await requireIdentity("announcementAuthors");
  if (auth.response) return auth.response;
  const { identity } = auth;
  try {
    const parsed = announcementSchema.safeParse(await request.json());
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message || "Dados do comunicado inválidos." }, 400);
    }
    const input = parsed.data;
    const target = input.target_company_id || null;
    if (!canTouch(identity, target)) {
      return json({ error: "Você só pode publicar comunicados para a sua companhia." }, 403);
    }

    const payload = {
      title: input.title,
      content: input.content,
      priority: input.priority,
      category: input.category,
      target_company_id: target,
      author_id: identity.user.id,
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase.from("announcements").insert(payload).select(SELECT).single();
    if (error) return serverError("announcements.post", error);

    const audited = await recordAudit(supabase, identity, {
      company_id: target,
      action_type: "publicou_comunicado",
      action_label: "Novo Comunicado Publicado",
      title: payload.title,
      content: payload.content,
      details: { priority: payload.priority, category: payload.category, target_company_id: target },
    });

    return json({ success: true, data, audited });
  } catch (err) {
    return serverError("announcements.post", err);
  }
}

export async function PUT(request: Request) {
  const auth = await requireIdentity("announcementManagers");
  if (auth.response) return auth.response;
  try {
    const parsed = announcementUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, 400);
    const updates = pick(parsed.data, ["title", "content", "priority", "category", "target_company_id"]);
    updates.updated_at = new Date().toISOString();

    const { data, error } = await createAdminClient()
      .from("announcements")
      .update(updates)
      .eq("id", parsed.data.id)
      .select(SELECT)
      .single();
    if (error) return serverError("announcements.put", error);
    return json({ success: true, data });
  } catch (err) {
    return serverError("announcements.put", err);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireIdentity("announcementAuthors");
  if (auth.response) return auth.response;
  const { identity } = auth;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "ID é obrigatório." }, 400);

    const supabase = createAdminClient();
    const { data: existing, error: readError } = await supabase
      .from("announcements")
      .select("id, title, content, priority, category, target_company_id, author_id")
      .eq("id", id)
      .single();
    if (readError || !existing) return json({ error: "Comunicado não encontrado." }, 404);
    if (!canTouch(identity, existing.target_company_id)) {
      return json({ error: "Você só pode remover comunicados da sua companhia." }, 403);
    }

    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return serverError("announcements.delete", error);

    const audited = await recordAudit(supabase, identity, {
      company_id: existing.target_company_id,
      action_type: "excluiu_comunicado",
      action_label: "Comunicado Removido",
      title: existing.title,
      content: existing.content,
      details: {
        deleted_announcement_id: id,
        original_author_id: existing.author_id,
        original_priority: existing.priority,
        original_category: baseCategory(existing.category),
      },
    });

    return json({ success: true, audited });
  } catch (err) {
    return serverError("announcements.delete", err);
  }
}
