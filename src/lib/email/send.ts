import "server-only";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export type SendResult =
  | { status: "accepted"; id: string | null }
  | { status: "not_configured" }
  | { status: "failed"; code: string };

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Envio transacional pelo provedor configurado no servidor (Resend via HTTPS).
 * "accepted" significa aceito pelo provedor para envio, não entrega confirmada.
 * Sem RESEND_API_KEY e EMAIL_FROM o envio fica desabilitado.
 */
export async function sendTransactionalEmail(message: OutgoingEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { status: "not_configured" };

  const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a">${escapeHtml(message.text).replace(/\n/g, "<br>")}<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"><p style="font-size:12px;color:#475569">FSY Sessão Ribeirão Preto 2</p></div>`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!response.ok) return { status: "failed", code: String(response.status) };
    const json = (await response.json().catch(() => ({}))) as { id?: string };
    return { status: "accepted", id: json.id ?? null };
  } catch {
    return { status: "failed", code: "network" };
  }
}
