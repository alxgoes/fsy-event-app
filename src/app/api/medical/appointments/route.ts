import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface AppointmentRecord {
  id: string;
  user_id?: string | null;
  medical_record_id?: string | null;
  youth_name: string;
  professional_name: string;
  reason: string;
  scheduled_at: string;
  status: "agendado" | "realizado" | "cancelado";
  is_seen: boolean;
  seen_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to extract JSON appointments stored in doctor_notes fallback if needed
function parseFallbackAppointments(medicalRecords: Record<string, unknown>[]): AppointmentRecord[] {
  const list: AppointmentRecord[] = [];
  for (const rec of medicalRecords) {
    if (rec.doctor_notes && typeof rec.doctor_notes === "string" && rec.doctor_notes.includes("__FSY_APPT__")) {
      try {
        const parts = rec.doctor_notes.split("__FSY_APPT__");
        if (parts[1]) {
          const appts = JSON.parse(parts[1]);
          if (Array.isArray(appts)) {
            list.push(...appts);
          }
        }
      } catch {
        // ignore parse error
      }
    }
  }
  return list;
}

async function syncFallbackAppointment(supabase: ReturnType<typeof createAdminClient>, appt: AppointmentRecord) {
  try {
    // Find or create medical record for this youth/user
    let recordQuery = supabase.from("medical_records").select("*");
    if (appt.user_id) {
      recordQuery = recordQuery.eq("user_id", appt.user_id);
    } else {
      recordQuery = recordQuery.ilike("full_name", appt.youth_name);
    }

    const { data: records } = await recordQuery.limit(1);
    const record = records && records[0];

    if (!record) {
      // Create a minimal medical record to hold appointments
      const { data: newRec } = await supabase
        .from("medical_records")
        .insert({
          user_id: appt.user_id || null,
          full_name: appt.youth_name,
          emergency_contact_name: "A registrar",
          emergency_contact_phone: "A registrar",
          emergency_contact_rel: "Responsável",
          doctor_notes: `__FSY_APPT__${JSON.stringify([appt])}`,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      return newRec;
    } else {
      // Update existing record's doctor_notes
      let existingAppts: AppointmentRecord[] = [];
      let baseNotes = record.doctor_notes || "";
      if (baseNotes.includes("__FSY_APPT__")) {
        const parts = baseNotes.split("__FSY_APPT__");
        baseNotes = parts[0];
        try {
          existingAppts = JSON.parse(parts[1]) || [];
        } catch {
          existingAppts = [];
        }
      }

      const idx = existingAppts.findIndex((a) => a.id === appt.id);
      if (idx >= 0) {
        existingAppts[idx] = appt;
      } else {
        existingAppts.push(appt);
      }

      const newNotes = `${baseNotes}__FSY_APPT__${JSON.stringify(existingAppts)}`;
      await supabase
        .from("medical_records")
        .update({ doctor_notes: newNotes, updated_at: new Date().toISOString() })
        .eq("id", record.id);
    }
  } catch (err) {
    console.error("Fallback appointment sync error:", err);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const unreadOnly = searchParams.get("unread") === "true";

    const supabase = createAdminClient();

    // 1. Try fetching from medical_appointments table
    let query = supabase
      .from("medical_appointments")
      .select("*")
      .order("scheduled_at", { ascending: true });

    if (userId) {
      query = query.eq("user_id", userId);
    }
    if (unreadOnly) {
      query = query.eq("is_seen", false);
    }

    const { data, error } = await query;

    if (!error && data) {
      return NextResponse.json(
        { data },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    // 2. Fallback: Retrieve appointments from medical_records doctor_notes
    const { data: recData } = await supabase.from("medical_records").select("*");
    let fallbackList = parseFallbackAppointments(recData ?? []);

    if (userId) {
      fallbackList = fallbackList.filter((a) => a.user_id === userId);
    }
    if (unreadOnly) {
      fallbackList = fallbackList.filter((a) => !a.is_seen);
    }

    return NextResponse.json(
      { data: fallbackList },
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      medical_record_id,
      youth_name,
      professional_name,
      reason,
      scheduled_at,
      notes,
      created_by,
    } = body;

    if (!youth_name || !youth_name.trim()) {
      return NextResponse.json(
        { error: "Nome do jovem é obrigatório." },
        { status: 400 }
      );
    }

    if (!scheduled_at) {
      return NextResponse.json(
        { error: "Data e horário da consulta são obrigatórios." },
        { status: 400 }
      );
    }

    if (!professional_name || !professional_name.trim()) {
      return NextResponse.json(
        { error: "Nome do profissional é obrigatório." },
        { status: 400 }
      );
    }

    const newAppt: AppointmentRecord = {
      id: crypto.randomUUID(),
      user_id: user_id || null,
      medical_record_id: medical_record_id || null,
      youth_name: youth_name.trim(),
      professional_name: professional_name.trim(),
      reason: (reason && reason.trim()) || "Atendimento geral",
      scheduled_at: new Date(scheduled_at).toISOString(),
      status: "agendado",
      is_seen: false,
      seen_at: null,
      notes: notes ? notes.trim() : null,
      created_by: created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();

    // 1. Try table insertion
    const { data: dbData } = await supabase
      .from("medical_appointments")
      .insert(newAppt)
      .select()
      .single();

    // 2. Always sync to fallback for durability
    await syncFallbackAppointment(supabase, dbData || newAppt);

    return NextResponse.json({
      success: true,
      data: dbData || newAppt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, is_seen, status, notes, scheduled_at, professional_name, reason } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID do agendamento é obrigatório." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (is_seen !== undefined) {
      updates.is_seen = Boolean(is_seen);
      if (is_seen) {
        updates.seen_at = new Date().toISOString();
      }
    }
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (scheduled_at !== undefined) updates.scheduled_at = new Date(scheduled_at).toISOString();
    if (professional_name !== undefined) updates.professional_name = professional_name;
    if (reason !== undefined) updates.reason = reason;

    const supabase = createAdminClient();

    // 1. Try updating table
    const { data: updatedDb } = await supabase
      .from("medical_appointments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    // 2. Also update in fallback
    const { data: recData } = await supabase.from("medical_records").select("*");
    const allAppts = parseFallbackAppointments(recData ?? []);
    const found = allAppts.find((a) => a.id === id);
    if (found) {
      const merged: AppointmentRecord = { ...found, ...updates } as AppointmentRecord;
      await syncFallbackAppointment(supabase, merged);
    }

    return NextResponse.json({
      success: true,
      data: updatedDb || { id, ...updates },
    });
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
      return NextResponse.json(
        { error: "ID do agendamento é obrigatório." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Try delete from table
    await supabase.from("medical_appointments").delete().eq("id", id);

    // 2. Remove from fallback doctor_notes
    const { data: recData } = await supabase.from("medical_records").select("*");
    for (const rec of recData ?? []) {
      if (rec.doctor_notes && rec.doctor_notes.includes(id)) {
        try {
          const parts = rec.doctor_notes.split("__FSY_APPT__");
          const baseNotes = parts[0];
          const appts: AppointmentRecord[] = JSON.parse(parts[1]) || [];
          const filtered = appts.filter((a) => a.id !== id);
          const newNotes = filtered.length > 0 ? `${baseNotes}__FSY_APPT__${JSON.stringify(filtered)}` : baseNotes;
          await supabase
            .from("medical_records")
            .update({ doctor_notes: newNotes, updated_at: new Date().toISOString() })
            .eq("id", rec.id);
        } catch {
          // ignore
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
