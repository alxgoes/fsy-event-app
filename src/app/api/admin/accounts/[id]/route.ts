import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { ADMIN_ROLES, canAssignRole, type Role } from "@/lib/auth/permissions";
import {
  countEnabledAdmins,
  isEnabledAdmin,
  loadAccount,
  mayAct,
  preservedReferences,
  recordAccountEvent,
  targetLabel,
} from "@/lib/accounts/service";
import { accountDeleteSchema, accountPatchSchema } from "@/types/accounts";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();
const LAST_ADMIN = "Esta é a última conta de direção habilitada. Habilite outra antes de continuar.";
const SELF = "Você não pode alterar o próprio cargo, suspender ou excluir a própria conta.";

type Ctx = { params: Promise<{ id: string }> };

/** Histórico administrativo da conta (sem senhas nem conteúdo de mensagens). */
export async function GET(_request: Request, { params: paramsPromise }: Ctx) {
  const params = await paramsPromise;
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  if (!uuid.safeParse(params.id).success) return json({ error: "Conta inválida." }, 400);
  const { data, error } = await createAdminClient()
    .from("admin_account_events")
    .select("id, actor_name, actor_role, target_label, action, details, created_at")
    .eq("target_id", params.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return serverError("accounts.events", error);
  return json({ data: data ?? [] });
}

export async function PATCH(request: Request, { params: paramsPromise }: Ctx) {
  const params = await paramsPromise;
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  const { identity } = auth;
  if (!uuid.safeParse(params.id).success) return json({ error: "Conta inválida." }, 400);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Envie os dados em JSON." }, 400);
  }
  const parsed = accountPatchSchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Dados inválidos." }, 400);
  const input = parsed.data;

  try {
    const db = createAdminClient();
    const target = await loadAccount(db, params.id);
    if (!target?.profile) return json({ error: "Conta não encontrada." }, 404);
    const targetRole: Role = target.summary.role ?? "jovem";
    const self = identity.user.id === params.id;

    if (self && input.action !== "edit") return json({ error: SELF }, 409);

    if (input.action === "role") {
      if (!canAssignRole(identity.role, targetRole, input.role)) {
        return json({ error: "Seu cargo não permite atribuir este cargo a esta conta." }, 403);
      }
    } else if (!mayAct(identity, targetRole, input.action)) {
      return json({ error: "Seu cargo não permite esta ação nesta conta." }, 403);
    }

    const removesAdmin =
      isEnabledAdmin(target.summary) &&
      ((input.action === "role" && !ADMIN_ROLES.includes(input.role)) || input.action === "suspend");
    if (removesAdmin && (await countEnabledAdmins(db)) <= 1) return json({ error: LAST_ADMIN }, 409);

    const label = { id: params.id, label: targetLabel(target.summary) };
    const now = new Date().toISOString();

    if (input.action === "edit") {
      const { action: _action, ...fields } = input;
      void _action;
      if (fields.company_id) {
        const { data: company } = await db.from("companies").select("id").eq("id", fields.company_id).maybeSingle();
        if (!company) return json({ error: "Companhia inexistente." }, 400);
      }
      const updates: Record<string, unknown> = { updated_at: now };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updates[key] = typeof value === "string" && !value ? null : value;
      }
      const { error } = await db.from("profiles").update(updates).eq("id", params.id);
      if (error) return serverError("accounts.edit", error);
      const audited = await recordAccountEvent(db, identity, label, "edit", { fields: Object.keys(updates).filter((k) => k !== "updated_at") });
      return json({ success: true, audited });
    }

    if (input.action === "role") {
      const { error } = await db.from("profiles").update({ role: input.role, updated_at: now }).eq("id", params.id);
      if (error) return serverError("accounts.role", error);
      const audited = await recordAccountEvent(db, identity, label, "role", { from: targetRole, to: input.role });
      return json({ success: true, audited });
    }

    const suspend = input.action === "suspend";
    // Suspender: grava primeiro o bloqueio protegido pelo trigger transacional.
    // Só então bane no Auth. Se o Auth falhar, o perfil continua bloqueado e a
    // operação pode ser repetida. Reativar usa a ordem inversa (falha fechada).
    if (suspend) {
      const { error } = await db.from("profiles").update({ suspended_at: now, updated_at: now }).eq("id", params.id);
      if (error) return serverError("accounts.suspend", error);
    }
    const { error: banError } = await db.auth.admin.updateUserById(params.id, { ban_duration: suspend ? "876000h" : "none" });
    if (banError) return serverError("accounts.ban", banError);
    if (!suspend) {
      const { error } = await db.from("profiles").update({ suspended_at: null, updated_at: now }).eq("id", params.id);
      if (error) return serverError("accounts.reactivate", error);
    }
    const audited = await recordAccountEvent(db, identity, label, input.action, suspend && input.reason ? { reason: input.reason } : {});
    return json({ success: true, audited });
  } catch (err) {
    return serverError("accounts.patch", err);
  }
}

export async function DELETE(request: Request, { params: paramsPromise }: Ctx) {
  const params = await paramsPromise;
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  const { identity } = auth;
  if (!uuid.safeParse(params.id).success) return json({ error: "Conta inválida." }, 400);
  if (identity.user.id === params.id) return json({ error: SELF }, 409);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Digite a confirmação." }, 400);
  }
  const parsed = accountDeleteSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Digite a confirmação." }, 400);

  try {
    const db = createAdminClient();
    const target = await loadAccount(db, params.id);
    if (!target) return json({ error: "Conta não encontrada." }, 404);
    if (!mayAct(identity, target.summary.role ?? "jovem", "delete")) {
      return json({ error: "Seu cargo não permite excluir esta conta." }, 403);
    }
    const expected = (target.summary.email ?? target.summary.full_name).trim().toLowerCase();
    if (parsed.data.confirm.trim().toLowerCase() !== expected) {
      return json({ error: "A confirmação não corresponde ao e-mail da conta." }, 400);
    }
    if (isEnabledAdmin(target.summary) && (await countEnabledAdmins(db)) <= 1) return json({ error: LAST_ADMIN }, 409);

    const preserved = await preservedReferences(db, params.id);
    if (preserved.length > 0) {
      return json({
        error: `Esta conta está vinculada a ${preserved.join(", ")}, que precisam ser preservados. Suspenda o acesso em vez de excluir.`,
        preserved,
      }, 409);
    }

    const { error } = await db.auth.admin.deleteUser(params.id);
    if (error) return serverError("accounts.delete", error);
    const audited = await recordAccountEvent(db, identity, { id: params.id, label: targetLabel(target.summary) }, "delete", {
      role: target.summary.role,
      providers: target.summary.providers,
    });
    return json({ success: true, audited });
  } catch (err) {
    return serverError("accounts.delete", err);
  }
}
