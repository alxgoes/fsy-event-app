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
    pathname.startsWith("/loading-preview");

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

    // Fetch user profile to check role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

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
     * - public assets (.svg, .png, .jpg, .webp, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
