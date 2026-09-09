import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndRole } from "@/lib/supabase/server";
import { appointmentCreateSchema, appointmentUpdateSchema } from "@/types/appointments";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const STAFF = ["medico", "coordenador", "casal_diretor", "logistica"];
const headers = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
const failure = () => reply({ error: "Não foi possível acessar os agendamentos. Tente novamente." }, 500);

export async function GET(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) return reply({ error: "Autenticação necessária." }, 401);
    const staff = Boolean(role && STAFF.includes(role));
    const params = new URL(request.url).searchParams;
    const requestedUser = params.get("user_id");
    if (!staff && requestedUser && requestedUser !== user.id) return reply({ error: "Acesso negado." }, 403);
    let query = createAdminClient().from("medical_appointments").select(staff ? "*" : "id,user_id,youth_name,professional_name,reason,scheduled_at,status,is_seen,created_at,updated_at");
    if (!staff) query = query.eq("user_id", user.id);
    else if (requestedUser) query = query.eq("user_id", requestedUser);
    if (params.get("unread") === "true") query = query.eq("is_seen", false);
    const { data, error } = await query.order("scheduled_at", { ascending: true });
    if (error) return failure();
    return reply({ data: data ?? [] });
  } catch { return failure(); }
}

export async function POST(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) return reply({ error: "Autenticação necessária." }, 401);
    if (!role || !STAFF.includes(role)) return reply({ error: "Acesso negado aos agendamentos." }, 403);
    const parsed = appointmentCreateSchema.safeParse(await request.json());
    if (!parsed.success) return reply({ error: "Confira participante, profissional e data do agendamento." }, 400);
    const { data, error } = await createAdminClient().from("medical_appointments")
      .insert({ ...parsed.data, created_by: user.id, status: "agendado", is_seen: false }).select().single();
    if (error) return failure();
    return reply({ success: true, data }, 201);
  } catch (error) { return error instanceof SyntaxError ? reply({ error: "Dados inválidos." }, 400) : failure(); }
}

export async function PUT(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) return reply({ error: "Autenticação necessária." }, 401);
    const parsed = appointmentUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return reply({ error: "Confira os dados do agendamento." }, 400);
    const { id, ...updates } = parsed.data;
    const staff = Boolean(role && STAFF.includes(role));
    if (!staff && (updates.is_seen !== true || Object.keys(updates).some((key) => key !== "is_seen"))) return reply({ error: "Você pode apenas confirmar a leitura do seu agendamento." }, 403);
    let query = createAdminClient().from("medical_appointments").update({
      ...updates, ...(updates.is_seen !== undefined ? { seen_at: updates.is_seen ? new Date().toISOString() : null } : {}),
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (!staff) query = query.eq("user_id", user.id);
    const { data, error } = await query.select(staff ? "*" : "id,is_seen,seen_at").maybeSingle();
    if (error) return failure();
    if (!data) return reply({ error: "Agendamento não encontrado." }, 404);
    return reply({ success: true, data });
  } catch (error) { return error instanceof SyntaxError ? reply({ error: "Dados inválidos." }, 400) : failure(); }
}

export async function DELETE(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) return reply({ error: "Autenticação necessária." }, 401);
    if (!role || !STAFF.includes(role)) return reply({ error: "Acesso negado aos agendamentos." }, 403);
    const id = new URL(request.url).searchParams.get("id");
    if (!z.string().uuid().safeParse(id).success) return reply({ error: "ID de agendamento inválido." }, 400);
    const { data, error } = await createAdminClient().from("medical_appointments").delete().eq("id", id).select("id").maybeSingle();
    if (error) return failure();
    if (!data) return reply({ error: "Agendamento não encontrado." }, 404);
    return reply({ success: true });
  } catch { return failure(); }
}
