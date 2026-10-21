import { Buffer } from "node:buffer";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthenticatedServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/security/origin";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { NATIVE_SESSION_MAX_TOKEN_AGE_SECONDS, type NativeSessionError, type NativeSessionResponse } from "@/types/native-session";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0", Pragma: "no-cache" };
const byUser = createRateLimiter({ limit: 20, windowMs: 15 * 60 * 1000 });
const BEARER = /^Bearer ([A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+)$/;

function reply(body: NativeSessionResponse | NativeSessionError, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** `iat` do JWT (o token em si é validado pelo Auth logo depois); só para exigir token recém-renovado. */
function issuedAt(payload: string): number | null {
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { iat?: unknown };
    return typeof claims.iat === "number" ? claims.iat : null;
  } catch {
    return null;
  }
}

/**
 * Abre o painel web dentro do app iOS sem segundo login. Sem cookie de entrada, sem corpo, sem destino
 * (o app escolhe a rota pela própria allowlist) e sem tokens no corpo da resposta: a sessão web nova
 * chega só como cookies SSR oficiais. Navegadores não alcançam esta rota com credenciais de terceiros:
 * `Authorization` em requisição de outra origem exige preflight CORS, que não é respondido.
 */
export async function POST(request: Request) {
  // Defesa em profundidade além do proxy: o app nativo não envia Origin; navegador de outra origem é recusado.
  if (!isSameOriginRequest(request)) return reply({ error: "Origem não permitida." }, 403);
  const match = BEARER.exec(request.headers.get("authorization") ?? "");
  if (!match) return reply({ error: "Sessão do app ausente." }, 401);
  const [, token, payload] = match;

  const iat = issuedAt(payload);
  const now = Math.floor(Date.now() / 1000);
  if (iat === null || now - iat > NATIVE_SESSION_MAX_TOKEN_AGE_SECONDS || iat - now > 60) {
    return reply({ error: "Sessão do app precisa ser renovada." }, 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return reply({ error: "Serviço temporariamente indisponível." }, 503);

  try {
    const admin = createAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user?.email) return reply({ error: "Sessão do app inválida. Entre novamente." }, 401);
    if (!byUser.hit(user.id)) return reply({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429);

    // Mesmas regras de getCurrentIdentity: perfil do banco e suspensão conferidos a cada abertura.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, suspended_at")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.role) return reply({ error: "Perfil não encontrado." }, 403);
    if (profile.suspended_at) return reply({ error: "Este acesso está suspenso." }, 403);

    // Sessão web independente: link de uso único gerado e consumido no servidor (nenhum e-mail enviado).
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("[api] native-session link", (linkError as { code?: string } | null)?.code ?? "");
      return reply({ error: "Não foi possível abrir o painel. Tente novamente." }, 500);
    }

    const pending: { name: string; value: string; options: CookieOptions }[] = [];
    const web = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => [],
        setAll: (cookies) => { pending.push(...cookies); },
      },
    });
    const { data: verified, error: verifyError } = await web.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (verifyError || verified?.user?.id !== user.id || pending.length === 0) {
      console.error("[api] native-session verify", (verifyError as { code?: string } | null)?.code ?? "");
      return reply({ error: "Não foi possível abrir o painel. Tente novamente." }, 500);
    }

    const response = reply({ success: true });
    for (const { name, value, options } of pending) response.cookies.set(name, value, options);
    return response;
  } catch {
    return reply({ error: "Não foi possível abrir o painel. Tente novamente." }, 500);
  }
}

/**
 * Encerra só a sessão web do painel (escopo local = apenas esta sessão). O app chama ao fechar o painel,
 * ao sair e ao trocar de conta, com os cookies do armazenamento isolado do WKWebView. A sessão nativa é
 * outra sessão do Auth e não é afetada.
 */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return reply({ error: "Origem não permitida." }, 403);
  try {
    const web = await createAuthenticatedServerClient();
    await web.auth.signOut({ scope: "local" });
  } catch {
    // Sem sessão válida não há o que revogar; a resposta é a mesma.
  }
  return reply({ success: true });
}
