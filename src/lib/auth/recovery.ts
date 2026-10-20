import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Pede ao Supabase Auth o e-mail de redefinição da senha do portal.
 * Cliente sem cookies e fluxo implícito: o link funciona em qualquer aparelho.
 * Não altera nem recupera senha de conta Google.
 */
export async function sendRecoveryEmail(email: string, origin: string): Promise<{ ok: boolean; code?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, code: "not_configured" };
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false, flowType: "implicit" } });
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/redefinir-senha` });
  return error ? { ok: false, code: error.code || error.name } : { ok: true };
}
