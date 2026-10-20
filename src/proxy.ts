import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/security/origin";

const PUBLIC_PREFIXES = ["/login", "/auth", "/acesso-negado", "/offline", "/icons", "/redefinir-senha"];
const PUBLIC_EXACT = new Set([
  "/api/auth/recover",
  "/api/instagram",
  "/icon.svg",
  "/sw.js",
  "/manifest.webmanifest",
  "/manifest.json",
]);

function isPublicPath(pathname: string) {
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/loading-preview")) return true;
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request: NextRequest) {
  // Mutações de API só a partir do próprio site (defesa contra requisições forjadas).
  if (
    request.nextUrl.pathname.startsWith("/api") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !isSameOriginRequest(request)
  ) {
    return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sem configuração não há como validar sessão: falha fechada fora das rotas públicas.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isPublicPath(request.nextUrl.pathname)) return supabaseResponse;
    return NextResponse.json(
      { error: "Serviço temporariamente indisponível: configuração de autenticação ausente." },
      { status: 503 }
    );
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

  // 1. Unauthenticated users: protect every internal page and API.
  const isPublicRoute = isPublicPath(pathname);

  if (!user && !isPublicRoute) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Acesso não autorizado. Autenticação necessária." },
        { status: 401 }
      );
    }
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profileError ? null : profile?.role;

    // JOVEM: blocked entirely — show access denied page
    if (!role || !["midia", "medico", "consultor", "logistica", "coordenador", "casal_diretor"].includes(role)) {
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
