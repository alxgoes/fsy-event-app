// Camada de requisições de leitura do navegador. Uma instância por aba: limita
// concorrência, deduplica buscas iguais e guarda resultados por poucos segundos,
// sempre com a conta da sessão na chave. Não use para login, escrita clínica ou
// urgências: escritas vão direto, sem fila.
import { createClient } from "@/lib/supabase/client";
import { createLimiter, createRequestCache, type CacheGetOptions, type Task } from "./core";

export { isRequestError, RequestError } from "./core";

/** Leituras simultâneas por aba; o restante espera numa fila curta. */
const MAX_CONCURRENT = 4;
const MAX_QUEUE = 24;
export const DEFAULT_TIMEOUT_MS = 12_000;

const browserCache = createRequestCache({
  limiter: createLimiter({ maxConcurrent: MAX_CONCURRENT, maxQueue: MAX_QUEUE, defaultTimeoutMs: DEFAULT_TIMEOUT_MS }),
  maxEntries: 50,
});

let currentScope: string | null = null;
let listening = false;

/** Conta dona das leituras ("anon" sem sessão). Na troca de conta o cache é descartado. */
export async function sessionScope(): Promise<string> {
  const supabase = createClient();
  if (!listening && typeof window !== "undefined") {
    listening = true;
    supabase.auth.onAuthStateChange((_event, session) => adoptScope(session?.user.id ?? "anon"));
  }
  const { data } = await supabase.auth.getSession();
  const scope = data.session?.user.id ?? "anon";
  adoptScope(scope);
  return scope;
}

function adoptScope(scope: string) {
  if (currentScope !== null && currentScope !== scope) browserCache.clear();
  currentScope = scope;
}

/**
 * Executa uma leitura deduplicada pela chave. A chave deve incluir o escopo de
 * `sessionScope()`. Fora do navegador não há cache compartilhado (evita misturar
 * usuários na memória de uma instância do servidor).
 */
export function cachedRequest<T>(key: string, fetcher: Task<T>, options?: CacheGetOptions): Promise<T> {
  if (typeof window === "undefined") return fetcher(new AbortController().signal);
  return browserCache.get(key, fetcher, options);
}

export function invalidateRequests(prefix: string) {
  browserCache.invalidate(prefix);
}

export class HttpStatusError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
    Object.setPrototypeOf(this, HttpStatusError.prototype);
  }
}

export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store", credentials: "same-origin", headers: { Accept: "application/json" } });
  if (!response.ok) throw new HttpStatusError(response.status);
  return (await response.json()) as T;
}

/**
 * Consulta direta ao Supabase só compensa quando a API falhou do lado do servidor.
 * Autorização negada (401/403), limite (429), rede indisponível ou cancelamento
 * não melhoram com uma segunda chamada.
 */
export function allowsDirectFallback(error: unknown): boolean {
  const status = (error as { name?: string; status?: number } | null)?.name === "HttpStatusError"
    ? (error as HttpStatusError).status
    : 0;
  return status >= 500;
}
