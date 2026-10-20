import { z } from "zod";
import { json } from "@/lib/auth/guard";
import { sendRecoveryEmail } from "@/lib/auth/recovery";
import { clientKey, isSameOriginRequest, publicSiteOrigin } from "@/lib/security/origin";
import { createRateLimiter } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const NEUTRAL = {
  success: true,
  message: "Se este e-mail tiver uma conta com senha no portal, você receberá um link para criar uma nova senha. Confira também o spam.",
};
const byEmail = createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 });
const byClient = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
const schema = z.object({ email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254) });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Origem não permitida." }, 403);
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Informe um e-mail válido." }, 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return json({ error: "Informe um e-mail válido." }, 400);
  const { email } = parsed.data;

  if (!byClient.hit(clientKey(request)) || !byEmail.hit(email)) {
    return json({ error: "Muitas tentativas. Aguarde alguns minutos antes de pedir outro link." }, 429);
  }

  // A resposta é a mesma exista ou não a conta, para não revelar cadastros.
  const result = await sendRecoveryEmail(email, publicSiteOrigin(request.url));
  if (!result.ok) console.error("[api] recover", result.code ?? "");
  return json(NEUTRAL);
}
