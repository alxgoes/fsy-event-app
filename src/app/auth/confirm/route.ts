import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createAuthenticatedServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/auth/permissions";

const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "signup", "invite", "magiclink", "email_change", "email"];

/**
 * Confirmação por token_hash (template de e-mail do Supabase). Funciona mesmo
 * quando o link é aberto em outro aparelho, ao contrário do fluxo PKCE.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeInternalPath(searchParams.get("next"), type === "recovery" ? "/redefinir-senha" : "/dashboard");

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createAuthenticatedServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(
    type === "recovery" ? `${origin}/redefinir-senha?erro=link` : `${origin}/login?error=${encodeURIComponent("Link inválido ou expirado. Peça um novo.")}`
  );
}
