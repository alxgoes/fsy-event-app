/**
 * Ponte de sessão do app iOS para o painel web (POST /api/auth/native-session).
 *
 * O app envia `Authorization: Bearer <access_token do Supabase>` recém-renovado. O servidor valida o
 * token no Auth, confere perfil e suspensão e abre uma sessão web NOVA e independente (cookies SSR na
 * resposta). O refresh token do app nunca sai do Keychain, então a rotação de um lado não invalida o outro.
 */
export interface NativeSessionResponse {
  success: true;
}

export interface NativeSessionError {
  error: string;
}

/** Idade máxima (s) do access token aceito: o app renova antes de abrir o painel. */
export const NATIVE_SESSION_MAX_TOKEN_AGE_SECONDS = 300;

/**
 * Marca adicionada pelo app ao user agent do WKWebView. Só ajusta a interface (sem convite de instalação
 * PWA); nunca concede permissão: autorização continua vindo da sessão e do perfil no servidor.
 */
export const NATIVE_APP_UA_TOKEN = "FSYiOSApp";

export function isNativeAppUserAgent(userAgent: string | null | undefined): boolean {
  return new RegExp(`(^|\\s)${NATIVE_APP_UA_TOKEN}/\\d`).test(userAgent ?? "");
}
