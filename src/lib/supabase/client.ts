import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a browser-side Supabase client using standard cookies
 * so sessions are shared across client components, Server Actions, and Next.js middleware.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
