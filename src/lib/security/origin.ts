/** Recusa mutações vindas de outra origem (complementa cookies SameSite=Lax). */
export function isSameOriginRequest(request: { headers: { get(name: string): string | null } }): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Origem pública usada em links enviados por e-mail. Preferir a variável fixa do ambiente. */
export function publicSiteOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      /* valor inválido: cai para a origem da requisição */
    }
  }
  return new URL(requestUrl).origin;
}

export function clientKey(request: { headers: { get(name: string): string | null } }): string {
  return (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "desconhecido";
}
