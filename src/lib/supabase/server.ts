import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { UserRole } from "@/lib/supabase/useProfile";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates an authenticated Supabase client for Server Components,
 * Route Handlers, and Server Actions that respects the user's session cookies.
 */
export async function createAuthenticatedServerClient() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL and Anon Key must be defined in environment");
  }

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

/**
 * Retrieves the currently authenticated user and their validated role.
 * Safe to call in Route Handlers to verify authorization.
 */
export async function getCurrentUserAndRole(): Promise<{
  user: { id: string; email?: string } | null;
  role: UserRole | null;
}> {
  try {
    const supabase = await createAuthenticatedServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, role: null };
    }

    // Resolve current permissions from the protected profile on every request.
    // User metadata and old JWT/cookie roles must never grant privileges.
    const { data: profile, error: profileError } = await createAdminClient()
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profileError ? null : profile?.role as UserRole | null;

    return {
      user: { id: user.id, email: user.email },
      role: role || null,
    };
  } catch {
    return { user: null, role: null };
  }
}
