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

const APPT_LOGISTICS_KEY = "__APPOINTMENTS_STORAGE__";

// Helper to fetch appointments from persistent table fallback
async function getStoredAppointments(supabase: ReturnType<typeof createAdminClient>): Promise<AppointmentRecord[]> {
  try {
    // 1. Try dedicated table first
    const { data: dbData, error: dbErr } = await supabase
      .from("medical_appointments")
      .select("*")
      .order("scheduled_at", { ascending: true });

    if (!dbErr && Array.isArray(dbData)) {
      return dbData;
    }

    // 2. Safe fallback storage in transport_logistics (isolated row)
    const { data: logData } = await supabase
      .from("transport_logistics")
      .select("notes")
      .eq("stake_city", APPT_LOGISTICS_KEY)
      .limit(1);

    if (logData && logData[0]?.notes) {
      try {
        const parsed = JSON.parse(logData[0].notes);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return [];
}

// Helper to save appointments to persistent fallback without EVER touching medical_records
async function saveStoredAppointments(
  supabase: ReturnType<typeof createAdminClient>,
  appointments: AppointmentRecord[]
) {
  try {
    const { data: existing } = await supabase
      .from("transport_logistics")
      .select("id")
      .eq("stake_city", APPT_LOGISTICS_KEY)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("transport_logistics")
        .update({
          notes: JSON.stringify(appointments),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing[0].id);
    } else {
      await supabase.from("transport_logistics").insert({
        bus_number: "0",
        stake_city: APPT_LOGISTICS_KEY,
        driver_name: "Sistema",
        driver_phone: "0000",
        departure_city_time: "00:00",
        arrival_fsy_time: "00:00",
        departure_fsy_time: "00:00",
        notes: JSON.stringify(appointments),
      });
    }
  } catch (err) {
    console.error("Error saving fallback appointments:", err);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");
    const unreadOnly = searchParams.get("unread") === "true";

    const supabase = createAdminClient();
    const allAppointments = await getStoredAppointments(supabase);

    let filtered = allAppointments;
    if (userId) {
      filtered = filtered.filter((a) => a.user_id === userId);
    }
    if (unreadOnly) {
      filtered = filtered.filter((a) => !a.is_seen);
    }

    // Sort by scheduled_at ascending
    filtered.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

    return NextResponse.json(
      { data: filtered },
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
      youth_name,
      professional_name,
      reason,
      scheduled_at,
      notes,
    } = body;

    if (!youth_name || !scheduled_at || !professional_name) {
      return NextResponse.json(
        { error: "Nome do jovem, data/hora e profissional são obrigatórios." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newAppt: AppointmentRecord = {
      id: crypto.randomUUID(),
      user_id: user_id || null,
      medical_record_id: null, // decoupled from medical_records
      youth_name: String(youth_name).trim(),
      professional_name: String(professional_name).trim(),
      reason: String(reason || "Atendimento Multidisciplinar").trim(),
      scheduled_at: new Date(scheduled_at).toISOString(),
      status: "agendado",
      is_seen: false,
      seen_at: null,
      notes: notes ? String(notes).trim() : null,
      created_at: now,
      updated_at: now,
    };

    const supabase = createAdminClient();

    // 1. Try table insertion if medical_appointments exists
    const { data: dbData } = await supabase
      .from("medical_appointments")
      .insert(newAppt)
      .select()
      .single();

    // 2. Also save to isolated durable storage
    const currentList = await getStoredAppointments(supabase);
    currentList.push(dbData || newAppt);
    await saveStoredAppointments(supabase, currentList);

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

    const supabase = createAdminClient();
    const allAppts = await getStoredAppointments(supabase);
    const idx = allAppts.findIndex((a) => a.id === id);

    if (idx >= 0) {
      const current = allAppts[idx];
      const updated: AppointmentRecord = {
        ...current,
        is_seen: is_seen !== undefined ? Boolean(is_seen) : current.is_seen,
        seen_at: is_seen === true ? new Date().toISOString() : current.seen_at,
        status: status !== undefined ? status : current.status,
        notes: notes !== undefined ? notes : current.notes,
        scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : current.scheduled_at,
        professional_name: professional_name || current.professional_name,
        reason: reason || current.reason,
        updated_at: new Date().toISOString(),
      };
      allAppts[idx] = updated;

      // Update in table if exists
      await supabase
        .from("medical_appointments")
        .update({
          is_seen: updated.is_seen,
          seen_at: updated.seen_at,
          status: updated.status,
          notes: updated.notes,
          scheduled_at: updated.scheduled_at,
          professional_name: updated.professional_name,
          reason: updated.reason,
          updated_at: updated.updated_at,
        })
        .eq("id", id);

      // Save to persistent storage
      await saveStoredAppointments(supabase, allAppts);

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
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
      return NextResponse.json({ error: "ID do agendamento é obrigatório." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Try table delete
    await supabase.from("medical_appointments").delete().eq("id", id);

    // 2. Remove from persistent storage
    const allAppts = await getStoredAppointments(supabase);
    const filtered = allAppts.filter((a) => a.id !== id);
    await saveStoredAppointments(supabase, filtered);

    return NextResponse.json({ success: true, message: "Agendamento excluído com sucesso." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
