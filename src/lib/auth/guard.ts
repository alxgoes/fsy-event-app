import "server-only";
import { NextResponse } from "next/server";
import { getCurrentIdentity, type Identity } from "@/lib/supabase/server";
import { hasRole, type RoleGroup } from "@/lib/auth/permissions";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

type GuardResult = { identity: Identity; response?: undefined } | { identity?: undefined; response: ReturnType<typeof json> };

/** Exige sessão válida; opcionalmente um grupo de cargos. O perfil vem do banco, nunca do cliente. */
export async function requireIdentity(group?: RoleGroup): Promise<GuardResult> {
  const identity = await getCurrentIdentity();
  if (!identity) return { response: json({ error: "Faça login para continuar." }, 401) };
  if (group && !hasRole(identity.role, group)) {
    return { response: json({ error: "Seu cargo não permite esta ação." }, 403) };
  }
  return { identity };
}

/** Converte falhas internas em mensagem genérica sem vazar detalhes do banco. */
export function serverError(context: string, error?: unknown) {
  const code = (error as { code?: string } | undefined)?.code;
  console.error(`[api] ${context}`, code ?? "");
  return json({ error: "Não foi possível concluir a operação. Tente novamente." }, 500);
}

/** Copia somente campos permitidos de um corpo arbitrário. */
export function pick<T extends Record<string, unknown>>(source: T, keys: readonly string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in source && source[key] !== undefined) out[key] = source[key];
  return out;
}
