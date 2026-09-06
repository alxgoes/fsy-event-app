import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, full_name, role: requestedRole, stake, phone } = body;

    if (!id || !full_name) {
      return NextResponse.json(
        { error: "Dados incompletos para criação de perfil." },
        { status: 400 }
      );
    }

    // Security check: self-registration is strictly role: "jovem".
    // Only authenticated coordinators / casal diretor can provision staff roles.
    let assignedRole = "jovem";
    if (requestedRole && requestedRole !== "jovem") {
      const { user, role: callerRole } = await getCurrentUserAndRole();
      const ALLOWED_ADMINS = ["coordenador", "casal_diretor", "logistica"];
      if (user && callerRole && ALLOWED_ADMINS.includes(callerRole)) {
        assignedRole = requestedRole;
      } else {
        assignedRole = "jovem";
      }
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id,
          full_name: full_name.trim(),
          role: assignedRole,
          stake: stake?.trim() || null,
          phone: phone?.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Error upserting profile in /api/auth/register:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
