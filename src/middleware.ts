import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Unauthenticated users: Protect all internal pages (/, /dashboard, /admin, /schedule, /announcements)
  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/acesso-negado") ||
    pathname.startsWith("/loading-preview") ||
    pathname.startsWith("/offline") ||
    pathname.startsWith("/icons") ||
    pathname === "/icon.svg" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json";

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Authenticated user visiting /login or / -> redirect to /dashboard
  if (user && (pathname === "/login" || pathname === "/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  // 3. Protect /admin routes with RBAC
  if (pathname.startsWith("/admin")) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // 3.1 Fast-path: Check role in JWT metadata (0ms latency)
    let role: string | undefined =
      (user.app_metadata?.role as string) ||
      (user.user_metadata?.role as string);

    // 3.2 Fast-path: Check cached session cookie
    if (!role) {
      const cachedRole = request.cookies.get("fsy_role")?.value;
      if (cachedRole) {
        role = cachedRole;
      }
    }

    // 3.3 Fallback: Query profiles table only if metadata and cookie are absent
    if (!role) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      role = profile?.role;

      // Cache role in cookie for subsequent fast-path navigations
      if (role) {
        supabaseResponse.cookies.set("fsy_role", role, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }
    }

    // JOVEM: blocked entirely — show access denied page
    if (!role || role === "jovem") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/acesso-negado";
      return NextResponse.redirect(redirectUrl);
    }

    // MIDIA: can only access /admin/media
    if (role === "midia" && !pathname.startsWith("/admin/media")) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin/media";
      return NextResponse.redirect(redirectUrl);
    }

    // MEDICO (Equipe Multidisciplinar): can only access /admin/medical or /admin (which defaults to medical)
    if (role === "medico" && !pathname.startsWith("/admin/medical") && pathname !== "/admin") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin/medical";
      return NextResponse.redirect(redirectUrl);
    }

    // CONSULTOR: redirected to their dedicated counselor panel /consultor
    if (role === "consultor") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/consultor";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 4. Protect /consultor route
  if (pathname.startsWith("/consultor")) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    if (
      role !== "consultor" &&
      role !== "coordenador" &&
      role !== "casal_diretor" &&
      role !== "logistica"
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/acesso-negado";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - sw.js, manifest.webmanifest (PWA files)
     * - public assets (.svg, .png, .jpg, .webp, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
