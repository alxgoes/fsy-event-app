/**
 * Recusa mutações vindas de outra origem (complementa cookies SameSite=Lax).
 * Quando `Origin` está ausente, inspeciona `Sec-Fetch-Site` e `Referer`,
 * preservando compatibilidade com requisições nativas (`Authorization: Bearer`)
 * e chamadas same-origin sem cabeçalho `Origin`.
 */
export function isSameOriginRequest(request: { headers: { get(name: string): string | null } }): boolean {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const origin = request.headers.get("origin");

  if (origin) {
    if (!host) return false;
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }

  // Sem `Origin`: rejeita se `Sec-Fetch-Site` indicar requisição entre sites distintos.
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase().trim();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }

  // Sem `Origin`: se `Referer` estiver presente, exige mesmo host.
  const referer = request.headers.get("referer");
  if (referer) {
    if (!host) return false;
    try {
      return new URL(referer).host === host;
    } catch {
      return false;
    }
  }

  // Clientes nativos com Bearer token ou fetches same-origin sem Origin/Referer.
  return true;
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
