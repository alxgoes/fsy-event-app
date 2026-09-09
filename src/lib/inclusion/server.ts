import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserAndRole } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const INCLUSION_ROLES = ["medico", "coordenador", "casal_diretor", "logistica"];
const uuid = z.string().uuid();
const headers = { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie" };
const caseSelection = "*, medical_record:medical_records(full_name, emergency_contact_name, emergency_contact_phone, emergency_contact_rel, emergency_contact_alt_phone)";
function withMedicalContacts(row: Record<string, unknown>) {
  const { medical_record, ...caseData } = row;
  const record = medical_record as Record<string, string | null> | null;
  if (!record) return caseData;
  let bishop: Record<string, string> = {};
  try {
    const extra = JSON.parse(record.emergency_contact_alt_phone || "{}");
    if (extra && typeof extra.bishop === "object" && extra.bishop) bishop = extra.bishop;
  } catch { /* Legacy records can contain a plain alternate phone number. */ }
  return { ...caseData, full_name: record.full_name || caseData.full_name, contacts: {
    parent: { name: record.emergency_contact_name || "", phone: record.emergency_contact_phone || "", relationship: record.emergency_contact_rel || "", ward: "" },
    bishop: { name: bishop.name || "", phone: bishop.phone || "", relationship: bishop.relationship || "", ward: bishop.ward || "" },
  } };
}
export function inclusionJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers });
}
export async function authorizeInclusion() {
  const { user, role } = await getCurrentUserAndRole();
  if (!user) return { response: inclusionJson({ error: "Faça login para acessar a inclusão." }, 401) };
  if (!role || !INCLUSION_ROLES.includes(role)) {
    return { response: inclusionJson({ error: "Acesso restrito à equipe responsável pela inclusão." }, 403) };
  }
  return { user };
}
export function inclusionDatabaseError(error: { code?: string; message?: string }) {
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code || "")) {
    return inclusionJson({ error: "O módulo de inclusão ainda não foi habilitado no banco de dados.", code: "INCLUSION_NOT_CONFIGURED" }, 503);
  }
  if (["40001", "40P01"].includes(error.code || "")) return inclusionJson({ error: "Outra pessoa alterou este acompanhamento. Atualize os dados antes de salvar.", code: "VERSION_CONFLICT" }, 409);
  if (error.code === "23505") return inclusionJson({ error: "Esta ficha já possui um acompanhamento de inclusão.", code: "DUPLICATE_CASE" }, 409);
  if (error.code === "P0002") return inclusionJson({ error: "Registro não encontrado." }, 404);
  if (error.code === "42501") return inclusionJson({ error: "Acesso negado à inclusão." }, 403);
  if (["22023", "23514", "23502", "22P02", "22007", "22008"].includes(error.code || "")) {
    return inclusionJson({ error: error.code === "22023" ? error.message : "Confira os campos informados." }, 400);
  }
  console.error("Falha na persistência de inclusão:", error.code);
  return inclusionJson({ error: "Não foi possível salvar ou consultar o acompanhamento." }, 500);
}

export async function readInclusion(id?: string) {
  try {
    const auth = await authorizeInclusion();
    if (auth.response) return auth.response;
    if (id && !uuid.safeParse(id).success) return inclusionJson({ error: "Identificador inválido." }, 400);
    const db = createAdminClient();
    if (!id) {
      const { data, error } = await db.from("inclusion_cases").select(caseSelection).order("updated_at", { ascending: false });
      return error ? inclusionDatabaseError(error) : inclusionJson({ data: (data ?? []).map(withMedicalContacts) });
    }
    const [caseResult, interviewsResult, historyResult] = await Promise.all([
      db.from("inclusion_cases").select(caseSelection).eq("id", id).maybeSingle(),
      db.from("inclusion_interviews").select("*").eq("case_id", id).order("scheduled_at", { ascending: false }),
      db.from("inclusion_history").select("*").eq("case_id", id).order("created_at", { ascending: false }),
    ]);
    const error = caseResult.error || interviewsResult.error || historyResult.error;
    if (error) return inclusionDatabaseError(error);
    if (!caseResult.data) return inclusionJson({ error: "Acompanhamento não encontrado." }, 404);
    return inclusionJson({ data: { ...withMedicalContacts(caseResult.data), interviews: interviewsResult.data ?? [], history: historyResult.data ?? [] } });
  } catch {
    return inclusionJson({ error: "Não foi possível consultar a inclusão." }, 500);
  }
}

export async function mutateInclusion(
  request: Request, schema: z.ZodType, action: string,
  caseId?: string, interviewId?: string
) {
  try {
    const auth = await authorizeInclusion();
    if (auth.response) return auth.response;
    if ((caseId && !uuid.safeParse(caseId).success) || (interviewId && !uuid.safeParse(interviewId).success)) {
      return inclusionJson({ error: "Identificador inválido." }, 400);
    }
    let raw: unknown;
    if (action === "archive") {
      raw = { version: Number(new URL(request.url).searchParams.get("version")) };
    } else {
      try { raw = await request.json(); } catch { return inclusionJson({ error: "Envie os dados em formato JSON válido." }, 400); }
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return inclusionJson({ error: parsed.error.issues[0]?.message || "Confira os campos informados." }, 400);
    const { data, error } = await createAdminClient().rpc("mutate_inclusion", {
      p_action: action, p_actor_id: auth.user!.id, p_payload: parsed.data,
      p_case_id: caseId ?? null, p_interview_id: interviewId ?? null,
    });
    return error ? inclusionDatabaseError(error) : inclusionJson({ data }, action === "create" ? 201 : 200);
  } catch {
    return inclusionJson({ error: "Não foi possível salvar o acompanhamento." }, 500);
  }
}
