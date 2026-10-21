import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { parseAuthorization } from "@/lib/auth/bearer";
import type { UserRole } from "@/lib/supabase/useProfile";
import { createAdminClient } from "@/lib/supabase/admin";

/** Authorization da requisição atual (app iOS). Fora de uma requisição, nenhum. */
async function requestAuthorization() {
  try {
    return parseAuthorization((await headers()).get("authorization"));
  } catch {
    return { kind: "none" } as const;
  }
}

/**
 * Creates an authenticated Supabase client for Server Components,
 * Route Handlers, and Server Actions that respects the user's session cookies.
 * Com `Authorization: Bearer` (app iOS) o cliente usa só esse token, sem cookies.
 */
export async function createAuthenticatedServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be defined in environment");
  }

  const authorization = await requestAuthorization();
  if (authorization.kind !== "none") {
    // Cabeçalho inválido vira cliente anônimo: nunca cai no cookie de outra sessão.
    const token = authorization.kind === "bearer" ? authorization.token : null;
    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: { getAll: () => [], setAll: () => {} },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Can occur if setAll is called from an environment where response cookies are immutable
        }
      },
    },
  });
}

export interface Identity {
  user: { id: string; email?: string };
  role: UserRole;
  profile: { id: string; full_name: string; role: UserRole; company_id: string | null };
}

/**
 * Usuário autenticado da requisição: Bearer do app (validado no Auth) ou cookie do site.
 * Authorization presente e inválida → null, sem tentar o cookie.
 */
async function resolveAuthUser(): Promise<{ id: string; email?: string } | null> {
  const authorization = await requestAuthorization();
  if (authorization.kind === "invalid") return null;
  if (authorization.kind === "bearer") {
    const { data, error } = await createAdminClient().auth.getUser(authorization.token);
    return error || !data?.user ? null : data.user;
  }
  const supabase = await createAuthenticatedServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

/**
 * Resolves the session user and the protected profile row in one place.
 * Returns null without a valid session, a profile, or when access is suspended.
 */
export async function getCurrentIdentity(): Promise<Identity | null> {
  try {
    const user = await resolveAuthUser();
    if (!user) return null;

    const { data: profile, error: profileError } = await createAdminClient()
      .from("profiles")
      .select("id, full_name, role, company_id, suspended_at")
      .eq("id", user.id)
      .single();
    if (profileError || !profile?.role) return null;
    // Conta suspensa pela administração: sessões ainda válidas não autorizam nada.
    if (profile.suspended_at) return null;

    return {
      user: { id: user.id, email: user.email },
      role: profile.role as UserRole,
      profile: { id: profile.id, full_name: profile.full_name, role: profile.role, company_id: profile.company_id },
    };
  } catch {
    return null;
  }
}

/**
 * Retrieves the currently authenticated user and their validated role.
 * Safe to call in Route Handlers to verify authorization.
 */
export async function getCurrentUserAndRole(): Promise<{
  user: { id: string; email?: string } | null;
  role: UserRole | null;
}> {
  try {
    const user = await resolveAuthUser();
    if (!user) {
      return { user: null, role: null };
    }

    // Resolve current permissions from the protected profile on every request.
    // User metadata and old JWT/cookie roles must never grant privileges.
    const { data: profile, error: profileError } = await createAdminClient()
      .from("profiles")
      .select("role, suspended_at")
      .eq("id", user.id)
      .single();
    const role = profileError || profile?.suspended_at ? null : profile?.role as UserRole | null;

    return {
      user: { id: user.id, email: user.email },
      role: role || null,
    };
  } catch {
    return { user: null, role: null };
  }
}
