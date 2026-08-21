import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [usersRes, companiesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, company_id, stake, room, avatar_url, created_at, updated_at")
        .order("full_name", { ascending: true }),
      supabase.from("companies").select("id, name").order("name", { ascending: true }),
    ]);

    if (usersRes.error) {
      return NextResponse.json(
        { error: usersRes.error.message },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        users: usersRes.data ?? [],
        companies: companiesRes.data ?? [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, role, company_id, stake, room, full_name } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do usuário é obrigatório." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (role !== undefined) updates.role = role;
    if (company_id !== undefined) updates.company_id = company_id || null;
    if (stake !== undefined) updates.stake = stake || null;
    if (room !== undefined) updates.room = room || null;
    if (full_name !== undefined && full_name.trim()) updates.full_name = full_name.trim();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
