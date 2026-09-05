import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OFFICIAL_FSY_SCHEDULE } from "@/data/officialSchedule";
import { scheduleItemSchema } from "@/lib/validations/schemas";

export const dynamic = "force-dynamic";

// Standard conference dates mapping (FSY 2027: 05 a 10 de Fevereiro)
const DAY_DEFAULT_DATES: Record<string, string> = {
  dia0: "2027-02-05",
  dia1: "2027-02-06",
  dia2: "2027-02-07",
  dia3: "2027-02-08",
  dia4: "2027-02-09",
  dia5: "2027-02-10",
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const day = searchParams.get("day");

    const supabase = createAdminClient();
    let query = supabase.from("schedule_items").select("*");

    if (day && day !== "all") {
      query = query.eq("day", day);
    }

    const { data, error } = await query
      .order("day", { ascending: true })
      .order("start_time", { ascending: true });

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

    // Support batch seed action
    if (body.action === "seed") {
      const supabase = createAdminClient();

      const itemsToInsert: Array<{
        day: string;
        date: string;
        start_time: string;
        end_time: string;
        title: string;
        location: string;
        description: string | null;
        category: string;
        is_highlight: boolean;
      }> = [];

      for (const [dayKey, dayData] of Object.entries(OFFICIAL_FSY_SCHEDULE)) {
        const defaultDate = DAY_DEFAULT_DATES[dayKey] || "2027-02-05";
        for (const event of dayData.events) {
          itemsToInsert.push({
            day: dayKey,
            date: defaultDate,
            start_time: event.time === "Horário a definir" ? "07:00" : event.time,
            end_time: event.endTime || "--",
            title: event.title,
            location: event.location,
            description: event.description || null,
            category: event.category || "Geral",
            is_highlight: Boolean(event.isHighlight),
          });
        }
      }

      // If already populated, we can replace or append
      if (body.overwrite) {
        await supabase.from("schedule_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("schedule_items")
        .insert(itemsToInsert)
        .select();

      if (insertErr) {
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `${inserted?.length ?? itemsToInsert.length} eventos sincronizados com sucesso!`,
        count: inserted?.length ?? itemsToInsert.length,
      });
    }

    const parseResult = scheduleItemSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Payload inválido para o evento da programação.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const validated = parseResult.data;
    const assignedDate = validated.date || DAY_DEFAULT_DATES[validated.day] || "2027-02-05";

    const payload = {
      title: validated.title,
      start_time: validated.start_time,
      end_time: validated.end_time,
      location: validated.location,
      description: validated.description || null,
      category: validated.category,
      day: validated.day,
      date: assignedDate,
      is_highlight: validated.is_highlight,
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("schedule_items")
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
      return NextResponse.json({ error: "ID do evento é obrigatório." }, { status: 400 });
    }

    // If date is missing or empty, ensure a valid date is assigned
    if (updates.day && (!updates.date || !updates.date.trim())) {
      updates.date = DAY_DEFAULT_DATES[updates.day] || "2027-02-05";
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("schedule_items")
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
      .from("schedule_items")
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
