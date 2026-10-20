import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

/**
 * Complementa o próprio perfil após o cadastro. O perfil é criado pelo trigger
 * do banco com cargo "jovem"; esta rota nunca altera cargo nem outro usuário.
 */
export async function POST(request: Request) {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const fullName = clean(body?.full_name, 160);
    if (!fullName || fullName.length < 2) {
      return json({ error: "Informe seu nome completo." }, 400);
    }

    const { data, error } = await createAdminClient()
      .from("profiles")
      .update({
        full_name: fullName,
        stake: clean(body?.stake, 120),
        phone: clean(body?.phone, 40),
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.identity.user.id)
      .select("id, full_name, role, stake, phone")
      .single();

    if (error) return serverError("register.update", error);
    return json({ success: true, profile: data });
  } catch (err) {
    return serverError("register", err);
  }
}
