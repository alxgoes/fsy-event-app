import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError, pick } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";
const PRIVATE_BACKUP_KEY = "__APPOINTMENTS_STORAGE__";
const EDITABLE = ["bus_number", "stake_city", "driver_name", "driver_phone", "capacity", "passengers_count", "departure_city_time", "arrival_fsy_time", "departure_fsy_time", "status", "notes"] as const;
const STATUSES = ["programado", "a_caminho", "chegou", "retornando", "concluido"];

export async function GET() {
  const auth = await requireIdentity("logisticsManagers");
  if (auth.response) return auth.response;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("transport_logistics")
      .select("*")
      .neq("stake_city", PRIVATE_BACKUP_KEY)
      .order("bus_number", { ascending: true });

    if (error) return serverError("logistics", error);

    return json({ data: data ?? [] });
  } catch (err) {
    return serverError("logistics", err);
  }
}

export async function POST(request: Request) {
  const auth = await requireIdentity("logisticsManagers");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const {
      bus_number,
      stake_city,
      driver_name,
      driver_phone,
      capacity,
      passengers_count,
      departure_city_time,
      arrival_fsy_time,
      departure_fsy_time,
      status,
      notes,
    } = body;

    if (String(stake_city || "").trim() === PRIVATE_BACKUP_KEY) {
      return json({ error: "Identificador reservado." }, 400);
    }

    if (!bus_number || !stake_city || !driver_name) {
      return json({ error: "Número do ônibus, estaca/cidade e motorista são obrigatórios." }, 400);
    }

    const supabase = createAdminClient();
    const payload = {
      bus_number: String(bus_number).trim(),
      stake_city: String(stake_city).trim(),
      driver_name: String(driver_name).trim(),
      driver_phone: String(driver_phone || "+55 (16) 99999-0000").trim(),
      capacity: Number(capacity) || 46,
      passengers_count: Number(passengers_count) || 0,
      departure_city_time: String(departure_city_time || "--").trim(),
      arrival_fsy_time: String(arrival_fsy_time || "--").trim(),
      departure_fsy_time: String(departure_fsy_time || "--").trim(),
      status: STATUSES.includes(status) ? status : "programado",
      notes: notes ? String(notes).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("transport_logistics")
      .insert(payload)
      .select()
      .single();

    if (error) return serverError("logistics", error);

    return json({ success: true, data });
  } catch (err) {
    return serverError("logistics", err);
  }
}

export async function PUT(request: Request) {
  const auth = await requireIdentity("logisticsManagers");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const id = body?.id;
    const updates = pick(body ?? {}, EDITABLE);
    if (updates.status !== undefined && !STATUSES.includes(String(updates.status))) {
      return json({ error: "Status inválido." }, 400);
    }

    if (String(updates.stake_city || "").trim() === PRIVATE_BACKUP_KEY) {
      return json({ error: "Identificador reservado." }, 400);
    }

    if (!id) {
      return json({ error: "ID do ônibus é obrigatório." }, 400);
    }

    const supabase = createAdminClient();
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("transport_logistics")
      .update(updates)
      .eq("id", id)
      .neq("stake_city", PRIVATE_BACKUP_KEY)
      .select()
      .single();

    if (error) return serverError("logistics", error);

    return json({ success: true, data });
  } catch (err) {
    return serverError("logistics", err);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireIdentity("logisticsManagers");
  if (auth.response) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return json({ error: "ID é obrigatório." }, 400);
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("transport_logistics")
      .delete()
      .eq("id", id)
      .neq("stake_city", PRIVATE_BACKUP_KEY);

    if (error) return serverError("logistics", error);

    return json({ success: true });
  } catch (err) {
    return serverError("logistics", err);
  }
}
