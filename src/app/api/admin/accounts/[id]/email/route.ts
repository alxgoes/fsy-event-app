import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { sendTransactionalEmail } from "@/lib/email/send";
import { loadAccount, mayAct, recordAccountEvent, targetLabel } from "@/lib/accounts/service";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { accountEmailSchema } from "@/types/accounts";

export const dynamic = "force-dynamic";
const perActor = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 });

/** Mensagem individual para o e-mail cadastrado da conta. O destinatário nunca vem do corpo. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return json({ error: "Conta inválida." }, 400);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Envie assunto e mensagem." }, 400);
  }
  const parsed = accountEmailSchema.safeParse(raw);
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Confira a mensagem." }, 400);

  try {
    const db = createAdminClient();
    const target = await loadAccount(db, params.id);
    if (!target) return json({ error: "Conta não encontrada." }, 404);
    if (!mayAct(auth.identity, target.summary.role ?? "jovem", "email")) {
      return json({ error: "Seu cargo não permite esta ação nesta conta." }, 403);
    }
    if (!target.summary.email) return json({ error: "Esta conta não tem e-mail cadastrado." }, 400);
    if (!perActor.hit(auth.identity.user.id)) return json({ error: "Limite de envios por hora atingido. Tente mais tarde." }, 429);

    const result = await sendTransactionalEmail({
      to: target.summary.email,
      subject: parsed.data.subject,
      text: parsed.data.body,
      replyTo: auth.identity.user.email,
    });
    const label = { id: params.id, label: targetLabel(target.summary) };
    if (result.status === "not_configured") {
      return json({ error: "O envio de e-mails ainda não foi configurado no servidor (RESEND_API_KEY e EMAIL_FROM)." }, 503);
    }
    if (result.status === "failed") {
      await recordAccountEvent(db, auth.identity, label, "email", { subject: parsed.data.subject, status: "failed" });
      return json({ error: "O provedor recusou o envio. Nada foi entregue; tente novamente mais tarde." }, 502);
    }
    const audited = await recordAccountEvent(db, auth.identity, label, "email", { subject: parsed.data.subject, status: "accepted", provider_id: result.id });
    return json({ success: true, audited, status: "accepted", message: "Mensagem aceita pelo provedor para envio. A entrega não é confirmada por aqui." }, 202);
  } catch (err) {
    return serverError("accounts.email", err);
  }
}
