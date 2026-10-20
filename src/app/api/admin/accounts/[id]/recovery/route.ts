import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { sendRecoveryEmail } from "@/lib/auth/recovery";
import { loadAccount, mayAct, recordAccountEvent, targetLabel } from "@/lib/accounts/service";
import { publicSiteOrigin } from "@/lib/security/origin";
import { createRateLimiter } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
const perTarget = createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 });

/** Envia ao titular o link de redefinição da senha do portal. Nunca expõe o link ao operador. */
export async function POST(request: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return json({ error: "Conta inválida." }, 400);
  try {
    const db = createAdminClient();
    const target = await loadAccount(db, params.id);
    if (!target) return json({ error: "Conta não encontrada." }, 404);
    if (!mayAct(auth.identity, target.summary.role ?? "jovem", "recovery_email")) {
      return json({ error: "Seu cargo não permite esta ação nesta conta." }, 403);
    }
    if (!target.summary.email) return json({ error: "Esta conta não tem e-mail cadastrado." }, 400);
    if (!perTarget.hit(params.id)) return json({ error: "Já enviamos links recentemente para esta conta. Aguarde alguns minutos." }, 429);

    const result = await sendRecoveryEmail(target.summary.email, publicSiteOrigin(request.url));
    if (!result.ok) return serverError("accounts.recovery", { code: result.code });

    const googleOnly = target.summary.providers.includes("google") && !target.summary.has_password;
    const audited = await recordAccountEvent(db, auth.identity, { id: params.id, label: targetLabel(target.summary) }, "recovery_email", { google_only: googleOnly });
    return json({
      success: true,
      audited,
      message: googleOnly
        ? "Link enviado ao e-mail da conta. Ela entra com Google; o link cria uma senha do portal para o mesmo cadastro e não altera a senha do Google."
        : "Link de redefinição enviado ao e-mail da conta.",
    });
  } catch (err) {
    return serverError("accounts.recovery", err);
  }
}
