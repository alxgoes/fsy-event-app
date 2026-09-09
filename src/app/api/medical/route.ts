import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndRole } from "@/lib/supabase/server";
import { medicalRecordSchema, medicalRecordUpdateSchema } from "@/types/medical";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["medico", "coordenador", "casal_diretor", "logistica"];

interface ExtraContactsPayload {
  contact2?: { name?: string; phone?: string; relationship?: string };
  contact3?: { name?: string; phone?: string; relationship?: string };
  bishop?: { name?: string; phone?: string; ward?: string };
}

function parseRecord(record: Record<string, unknown>) {
  let extra: ExtraContactsPayload = {};
  if (record.emergency_contact_alt_phone && typeof record.emergency_contact_alt_phone === "string") {
    try {
      extra = JSON.parse(record.emergency_contact_alt_phone);
    } catch {
      extra = {};
    }
  }

  return {
    ...record,
    contact_2_name: extra.contact2?.name || "",
    contact_2_phone: extra.contact2?.phone || "",
    contact_2_relationship: extra.contact2?.relationship || "",
    contact_3_name: extra.contact3?.name || "",
    contact_3_phone: extra.contact3?.phone || "",
    contact_3_relationship: extra.contact3?.relationship || "",
    bishop_name: extra.bishop?.name || "",
    bishop_phone: extra.bishop?.phone || "",
    bishop_ward: extra.bishop?.ward || "",
  };
}

export async function GET() {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) {
      return NextResponse.json(
        { error: "Acesso não autorizado. Sessão necessária." },
        { status: 401 }
      );
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Acesso negado aos prontuários médicos confidenciais." },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("medical_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filteredRaw = (data ?? []).filter(
      (r) => r.emergency_contact_name !== "A registrar"
    );
    const parsed = filteredRaw.map((r) => parseRecord(r as Record<string, unknown>));

    return NextResponse.json({ data: parsed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) {
      return NextResponse.json(
        { error: "Acesso não autorizado. Sessão necessária." },
        { status: 401 }
      );
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Acesso negado para alteração de prontuários médicos." },
        { status: 403 }
      );
    }
    const parsedBody = medicalRecordSchema.safeParse(await request.json());
    if (!parsedBody.success) return NextResponse.json({ error: "Confira os dados da ficha médica." }, { status: 400 });
    const body = parsedBody.data;
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
      contact_2_name,
      contact_2_phone,
      contact_2_rel,
      contact_2_relationship,
      contact_3_name,
      contact_3_phone,
      contact_3_rel,
      contact_3_relationship,
      bishop_name,
      bishop_phone,
      bishop_ward,
      blood_type,
      doctor_notes,
    } = body;

    if (!full_name) {
      return NextResponse.json(
        { error: "Nome do participante é obrigatório." },
        { status: 400 }
      );
    }

    const extraContacts: ExtraContactsPayload = {
      contact2: {
        name: contact_2_name?.trim() || "",
        phone: contact_2_phone?.trim() || "",
        relationship: (contact_2_rel || contact_2_relationship)?.trim() || "",
      },
      contact3: {
        name: contact_3_name?.trim() || "",
        phone: contact_3_phone?.trim() || "",
        relationship: (contact_3_rel || contact_3_relationship)?.trim() || "",
      },
      bishop: {
        name: bishop_name?.trim() || "",
        phone: bishop_phone?.trim() || "",
        ward: bishop_ward?.trim() || "",
      },
    };

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
      emergency_contact_alt_phone: JSON.stringify(extraContacts),
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

    return NextResponse.json({ success: true, data: parseRecord(data as Record<string, unknown>) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    if (!role || !ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Acesso negado às fichas médicas." }, { status: 403 });
    const parsedBody = medicalRecordUpdateSchema.safeParse(await request.json());
    if (!parsedBody.success) return NextResponse.json({ error: "Confira os dados da ficha médica." }, { status: 400 });
    const body = parsedBody.data;
    const {
      id,
      contact_2_name,
      contact_2_phone,
      contact_2_rel,
      contact_2_relationship,
      contact_3_name,
      contact_3_phone,
      contact_3_rel,
      contact_3_relationship,
      bishop_name,
      bishop_phone,
      bishop_ward,
      ...otherUpdates
    } = body;

    if (!id) {
      return NextResponse.json({ error: "ID da ficha é obrigatório." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: existing, error: readError } = await supabase.from("medical_records")
      .select("emergency_contact_alt_phone").eq("id", id).maybeSingle();
    if (readError) return NextResponse.json({ error: "Não foi possível consultar a ficha médica." }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Ficha médica não encontrada." }, { status: 404 });
    let oldContacts: ExtraContactsPayload = {};
    try { oldContacts = JSON.parse(existing.emergency_contact_alt_phone || "{}"); } catch { /* Legacy plain text. */ }
    const extraContacts: ExtraContactsPayload = {
      contact2: {
        name: contact_2_name !== undefined ? contact_2_name || "" : oldContacts.contact2?.name || "",
        phone: contact_2_phone !== undefined ? contact_2_phone || "" : oldContacts.contact2?.phone || "",
        relationship: contact_2_rel !== undefined || contact_2_relationship !== undefined ? contact_2_rel || contact_2_relationship || "" : oldContacts.contact2?.relationship || "",
      },
      contact3: {
        name: contact_3_name !== undefined ? contact_3_name || "" : oldContacts.contact3?.name || "",
        phone: contact_3_phone !== undefined ? contact_3_phone || "" : oldContacts.contact3?.phone || "",
        relationship: contact_3_rel !== undefined || contact_3_relationship !== undefined ? contact_3_rel || contact_3_relationship || "" : oldContacts.contact3?.relationship || "",
      },
      bishop: {
        name: bishop_name !== undefined ? bishop_name || "" : oldContacts.bishop?.name || "",
        phone: bishop_phone !== undefined ? bishop_phone || "" : oldContacts.bishop?.phone || "",
        ward: bishop_ward !== undefined ? bishop_ward || "" : oldContacts.bishop?.ward || "",
      },
    };

    const updates = {
      ...otherUpdates,
      emergency_contact_alt_phone: JSON.stringify(extraContacts),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("medical_records")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: parseRecord(data as Record<string, unknown>) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    if (!role || !ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Acesso negado às fichas médicas." }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("medical_records")
      .delete()
      .eq("id", id);

    if (error) {
      if (error.code === "23503") return NextResponse.json({ error: "Esta ficha possui acompanhamento vinculado. Arquive o acompanhamento para preservar o histórico; a ficha não pode ser excluída." }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
