// Sessão fictícia para o Supabase falso de QA visual (não funciona num projeto real).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const fixtures = JSON.parse(readFileSync(path.join(here, "fixtures.json"), "utf8"));
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

export const authUser = (u) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
  app_metadata: { provider: u.providers[0], providers: u.providers },
  user_metadata: { full_name: u.full_name }, identities: u.providers.map((provider) => ({ provider, id: u.id })),
  created_at: u.created_at, email_confirmed_at: u.email_confirmed_at, last_sign_in_at: u.last_sign_in_at, banned_until: u.banned_until ?? null,
});

/** JWT não assinado: o servidor falso confia apenas no "sub". */
export const tokenFor = (u) => `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: u.id, role: "authenticated", exp: 4102444800, aud: "authenticated", email: u.email })}.fake`;

/** Aceita o id completo ou o número da pessoa fictícia (ex.: "5"). */
export function findUser(who) {
  return fixtures.users.find((u) => u.id === who || u.id.endsWith(String(who).padStart(12, "0")));
}

export function sessionCookie(who) {
  const u = findUser(who);
  if (!u) throw new Error(`Pessoa fictícia desconhecida: ${who}`);
  const session = { access_token: tokenFor(u), refresh_token: `refresh-${u.id}`, token_type: "bearer", expires_in: 31536000, expires_at: 4102444800, user: authUser(u) };
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}
