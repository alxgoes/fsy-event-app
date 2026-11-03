import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError, pick } from "@/lib/auth/guard";
import { OFFICIAL_FSY_SCHEDULE } from "@/data/officialSchedule";
import { scheduleItemSchema } from "@/lib/validations/schemas";
import { EVENT_DAY_DATES } from "@/lib/event/identity";

export const dynamic = "force-dynamic";

const SCHEDULE_FIELDS = ["title", "start_time", "end_time", "location", "description", "category", "day", "date", "is_highlight"] as const;

export async function GET(request: Request) {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
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

    if (error) return serverError("schedule", error);

    return json({ data: data ?? [] });
  } catch (err) {
    return serverError("schedule", err);
  }
}

export async function POST(request: Request) {
  const auth = await requireIdentity("scheduleManagers");
  if (auth.response) return auth.response;
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
        const defaultDate = EVENT_DAY_DATES[dayKey] || EVENT_DAY_DATES.dia0;
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

      // A substituição roda numa transação: se a inserção falhar, nada é apagado.
      const { data: inserted, error: insertErr } = body.overwrite
        ? await supabase.rpc("admin_replace_schedule", { p_items: itemsToInsert })
        : await supabase.from("schedule_items").insert(itemsToInsert).select();

      if (insertErr) return serverError("schedule.seed", insertErr);
      const insertedCount = Array.isArray(inserted) ? inserted.length : typeof inserted === "number" ? inserted : itemsToInsert.length;

      return json({
        success: true,
        message: `${insertedCount} eventos sincronizados.`,
        count: insertedCount,
      });
    }

    const parseResult = scheduleItemSchema.safeParse(body);
    if (!parseResult.success) {
      return json(
        {
          error: parseResult.error.issues[0]?.message || "Dados inválidos para o evento da programação.",
          details: parseResult.error.flatten().fieldErrors,
        },
        400
      );
    }

    const validated = parseResult.data;
    const assignedDate = validated.date || EVENT_DAY_DATES[validated.day] || EVENT_DAY_DATES.dia0;

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

    if (error) return serverError("schedule", error);

    return json({ success: true, data });
  } catch (err) {
    return serverError("schedule", err);
  }
}

export async function PUT(request: Request) {
  const auth = await requireIdentity("scheduleManagers");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const id = body?.id;
    const provided = pick(body ?? {}, SCHEDULE_FIELDS);
    const parsedUpdate = scheduleItemSchema.partial().safeParse(provided);
    if (!parsedUpdate.success) {
      return json({ error: parsedUpdate.error.issues[0]?.message || "Dados inválidos." }, 400);
    }
    // Somente campos enviados: defaults do schema não podem sobrescrever dados existentes.
    const updates: Record<string, unknown> = pick(parsedUpdate.data, Object.keys(provided));

    if (!id) {
      return json({ error: "ID do evento é obrigatório." }, 400);
    }

    // If date is missing or empty, ensure a valid date is assigned
    if (typeof updates.day === "string" && !updates.date) {
      updates.date = EVENT_DAY_DATES[updates.day] || EVENT_DAY_DATES.dia0;
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("schedule_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) return serverError("schedule", error);

    return json({ success: true, data });
  } catch (err) {
    return serverError("schedule", err);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireIdentity("scheduleManagers");
  if (auth.response) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return json({ error: "ID é obrigatório." }, 400);
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("schedule_items")
      .delete()
      .eq("id", id);

    if (error) return serverError("schedule", error);

    return json({ success: true });
  } catch (err) {
    return serverError("schedule", err);
  }
}
