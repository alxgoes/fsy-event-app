import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndRole } from "@/lib/supabase/server";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { ADMIN_ROLES, canAssignRole, canManageAccount, isRole, type Role } from "@/lib/auth/permissions";

/** Respostas com dados pessoais/saúde: nunca em cache compartilhado (site e app). */
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie, Authorization" };
function privateJson(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { ...init, headers: { ...init.headers, ...PRIVATE_HEADERS } });
}


export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_USER_MANAGERS = ["coordenador", "casal_diretor", "logistica"];

export async function GET() {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) {
      return privateJson(
        { error: "Acesso não autorizado. Sessão necessária." },
        { status: 401 }
      );
    }

    if (!role || !ALLOWED_USER_MANAGERS.includes(role)) {
      return privateJson(
        { error: "Acesso negado à gestão de usuários." },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    const [usersRes, companiesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, company_id, stake, room, avatar_url, created_at, updated_at")
        .order("full_name", { ascending: true }),
      supabase.from("companies").select("id, name").order("name", { ascending: true }),
    ]);

    if (usersRes.error) {
      return privateJson(
        { error: usersRes.error.message },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    return privateJson(
      {
        users: usersRes.data ?? [],
        companies: companiesRes.data ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return privateJson(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  const { identity } = auth;
  try {
    const body = await request.json();
    const { id, role, company_id, stake, room, full_name } = body ?? {};
    if (!id || typeof id !== "string") return json({ error: "ID do usuário é obrigatório." }, 400);

    const supabase = createAdminClient();
    const { data: target, error: readError } = await supabase.from("profiles").select("id, role, full_name").eq("id", id).single();
    if (readError || !target) return json({ error: "Conta não encontrada." }, 404);
    const targetRole: Role = isRole(target.role) ? target.role : "jovem";
    const roleChanges = role !== undefined && role !== target.role;
    if (roleChanges && id === identity.user.id) return json({ error: "Você não pode alterar o próprio cargo." }, 409);
    if (!canManageAccount(identity.role, targetRole)) return json({ error: "Seu cargo não permite alterar esta conta." }, 403);

    if (roleChanges) {
      if (!isRole(role) || !canAssignRole(identity.role, targetRole, role)) {
        return json({ error: "Seu cargo não permite atribuir este cargo." }, 403);
      }
      if (ADMIN_ROLES.includes(targetRole) && !ADMIN_ROLES.includes(role)) {
        const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ADMIN_ROLES).is("suspended_at", null);
        if ((count ?? 0) <= 1) return json({ error: "Esta é a última conta administrativa habilitada." }, 409);
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (roleChanges) updates.role = role;
    if (company_id !== undefined) updates.company_id = company_id || null;
    if (stake !== undefined) updates.stake = stake || null;
    if (room !== undefined) updates.room = room || null;
    if (typeof full_name === "string" && full_name.trim()) updates.full_name = full_name.trim().slice(0, 160);

    const { data, error } = await supabase.from("profiles").update(updates).eq("id", id).select().single();
    if (error) return serverError("users.put", error);

    await supabase.from("admin_account_events").insert({
      actor_id: identity.user.id,
      actor_name: identity.profile.full_name,
      actor_role: identity.role,
      target_id: id,
      target_label: target.full_name,
      action: roleChanges ? "role" : "edit",
      details: roleChanges ? { from: targetRole, to: role } : { fields: Object.keys(updates).filter((k) => k !== "updated_at") },
    });

    return json({ success: true, data });
  } catch (err) {
    return serverError("users.put", err);
  }
}
