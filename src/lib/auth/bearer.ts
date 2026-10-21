import { BEARER_API_PREFIXES, type AuthorizationHeader } from "@/types/native-auth";

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/**
 * Lê o cabeçalho Authorization. Ausente = nenhum. Presente com qualquer valor que não seja um JWT Bearer
 * bem formado (inclusive vazio ou só espaços) é inválido: falha fechada, sem recorrer ao cookie.
 */
export function parseAuthorization(header: string | null | undefined): AuthorizationHeader {
  if (header === null || header === undefined) return { kind: "none" };
  const match = BEARER.exec(header.trim());
  return match ? { kind: "bearer", token: match[1] } : { kind: "invalid" };
}

export function isBearerApiPath(pathname: string): boolean {
  return BEARER_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
