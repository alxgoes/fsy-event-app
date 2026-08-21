import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("transport_logistics")
      .select("*")
      .order("bus_number", { ascending: true });

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

    if (!bus_number || !stake_city || !driver_name) {
      return NextResponse.json(
        { error: "Número do ônibus, estaca/cidade e motorista são obrigatórios." },
        { status: 400 }
      );
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
      status: status || "programado",
      notes: notes ? String(notes).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("transport_logistics")
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
      return NextResponse.json({ error: "ID do ônibus é obrigatório." }, { status: 400 });
    }

    const supabase = createAdminClient();
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("transport_logistics")
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
      .from("transport_logistics")
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
