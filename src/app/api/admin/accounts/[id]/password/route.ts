import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { passwordProblem } from "@/lib/auth/password-policy";
import { loadAccount, mayAct, recordAccountEvent, targetLabel } from "@/lib/accounts/service";
import { accountPasswordSchema } from "@/types/accounts";

export const dynamic = "force-dynamic";

/**
 * Define uma nova senha do portal para outra conta (direção apenas).
 * A senha atual nunca é lida; a nova não é registrada nem devolvida.
 */
export async function POST(request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const auth = await requireIdentity("accountGuardians");
  if (auth.response) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return json({ error: "Conta inválida." }, 400);
  if (auth.identity.user.id === params.id) {
    return json({ error: "Para a sua própria conta, use “Esqueci minha senha”." }, 409);
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Informe a nova senha." }, 400);
  }
  const parsed = accountPasswordSchema.safeParse(raw);
  const problem = parsed.success ? passwordProblem(parsed.data.password) : "A senha precisa ter entre 8 e 72 caracteres.";
  if (!parsed.success || problem) return json({ error: problem }, 400);

  try {
    const db = createAdminClient();
    const target = await loadAccount(db, params.id);
    if (!target) return json({ error: "Conta não encontrada." }, 404);
    if (!mayAct(auth.identity, target.summary.role ?? "jovem", "set_password")) {
      return json({ error: "Seu cargo não permite esta ação nesta conta." }, 403);
    }
    const { error } = await db.auth.admin.updateUserById(params.id, { password: parsed.data.password });
    if (error) {
      if (error.code === "weak_password") return json({ error: "A senha não atende à política do projeto. Use uma senha mais longa." }, 400);
      return serverError("accounts.password", error);
    }
    const audited = await recordAccountEvent(db, auth.identity, { id: params.id, label: targetLabel(target.summary) }, "set_password");
    return json({ success: true, audited, message: "Senha do portal redefinida. Informe a pessoa por um canal seguro." });
  } catch (err) {
    return serverError("accounts.password", err);
  }
}
