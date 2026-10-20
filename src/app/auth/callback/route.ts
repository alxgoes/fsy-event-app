import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { homePathForRole, isRole, safeInternalPath } from "@/lib/auth/permissions";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error || errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        errorDescription || error || "Falha na autenticação Google"
      )}`
    );
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
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
              // Ignore in server component context
            }
          },
        },
      }
    );

    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && data?.user) {
      // Fluxos com destino explícito (ex.: redefinição de senha) usam apenas caminhos internos.
      let targetPath = next ? safeInternalPath(next) : "/dashboard";
      if (!next) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .maybeSingle();
        targetPath = homePathForRole(isRole(profile?.role) ? profile.role : null);
      }

      return NextResponse.redirect(`${origin}${targetPath}`);
    }

    if (exchangeError) {
      const expired = next && safeInternalPath(next) === "/redefinir-senha";
      return NextResponse.redirect(
        expired
          ? `${origin}/redefinir-senha?erro=link`
          : `${origin}/login?error=${encodeURIComponent("Não foi possível concluir o acesso. Tente entrar novamente.")}`
      );
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=Código de autorização não encontrado`
  );
}
