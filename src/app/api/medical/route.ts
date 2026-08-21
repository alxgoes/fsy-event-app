import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("medical_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      full_name,
      user_id,
      company_id,
      room,
      allergies,
      is_severe_allergy,
      dietary_restrictions,
      medications,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_rel,
      blood_type,
      doctor_notes,
    } = body;

    if (!full_name) {
      return NextResponse.json(
        { error: "Nome do participante é obrigatório." },
        { status: 400 }
      );
    }

    const payload = {
      full_name: String(full_name).trim(),
      user_id: user_id || null,
      company_id: company_id ? String(company_id).trim() : null,
      room: room ? String(room).trim() : null,
      allergies: allergies || "",
      is_severe_allergy: Boolean(is_severe_allergy),
      dietary_restrictions: dietary_restrictions ? String(dietary_restrictions).trim() : null,
      medications: medications || "",
      emergency_contact_name: emergency_contact_name?.trim() || "Não informado",
      emergency_contact_phone: emergency_contact_phone?.trim() || "Não informado",
      emergency_contact_rel: emergency_contact_rel?.trim() || "Responsável",
      blood_type: blood_type ? String(blood_type).trim() : null,
      doctor_notes: doctor_notes ? String(doctor_notes).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("medical_records")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID da ficha é obrigatório." }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("medical_records")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("medical_records")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
