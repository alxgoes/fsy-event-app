import { z } from "zod";

export const INCLUSION_PHASES = ["triagem", "contato", "entrevistas", "analise", "concluido", "arquivado"] as const;
export const INCLUSION_PHASE_LABELS: Record<InclusionPhase, string> = {
  triagem: "Triagem", contato: "Contato com responsáveis", entrevistas: "Entrevistas",
  analise: "Análise da equipe", concluido: "Decisão registrada", arquivado: "Arquivado",
};
export type InclusionPhase = typeof INCLUSION_PHASES[number];
export const INCLUSION_DECISIONS = ["participacao_confirmada", "participacao_com_apoio", "participacao_nao_recomendada"] as const;
export type InclusionDecision = typeof INCLUSION_DECISIONS[number];
export const INCLUSION_DECISION_LABELS: Record<InclusionDecision, string> = {
  participacao_confirmada: "Participação confirmada", participacao_com_apoio: "Participação com apoio",
  participacao_nao_recomendada: "Participação não recomendada",
};
const text = z.string().trim().max(6000);
export const inclusionContactSchema = z.object({
  name: z.string().trim().max(160).default(""), phone: z.string().trim().max(50).default(""),
  relationship: z.string().trim().max(100).default(""), ward: z.string().trim().max(160).default(""),
}).strict();
export const inclusionContactsSchema = z.object({
  parent: inclusionContactSchema, bishop: inclusionContactSchema,
}).strict();
export type InclusionContacts = z.infer<typeof inclusionContactsSchema>;
export const createInclusionSchema = z.object({
  medical_record_id: z.string().uuid().optional(),
  new_record: z.object({ full_name: z.string().trim().min(2, "Informe o nome do participante.").max(160) }).strict().optional(),
  needs: text.min(1, "Descreva as necessidades de acompanhamento."),
  support_plan: text.default(""), contacts: inclusionContactsSchema,
}).strict().refine((value) => Boolean(value.medical_record_id) !== Boolean(value.new_record), {
  message: "Selecione uma ficha existente ou cadastre um participante.",
});
export const updateInclusionSchema = z.object({
  version: z.number().int().positive(), needs: text.min(1).optional(), support_plan: text.optional(),
  contacts: inclusionContactsSchema.optional(), phase: z.enum(INCLUSION_PHASES).optional(),
}).strict();
export const inclusionInterviewSchema = z.object({
  version: z.number().int().positive(),
  scheduled_at: z.string().datetime({ offset: true, message: "Informe data e horário válidos." }),
  participants: z.string().trim().min(2).max(500),
  status: z.enum(["agendada", "realizada", "cancelada"]), summary: text.default(""),
}).strict().refine((value) => value.status !== "realizada" || value.summary.length > 0, {
  message: "Registre o resumo da entrevista realizada.", path: ["summary"],
});
export const inclusionDecisionSchema = z.object({
  version: z.number().int().positive(), decision: z.enum(INCLUSION_DECISIONS),
  reason: text.min(10, "Descreva o motivo da decisão (mínimo de 10 caracteres)."),
  support_plan: text,
  confirmed_by_human: z.literal(true, { message: "Confirme a decisão da equipe responsável." }),
}).strict().refine((value) => value.decision !== "participacao_com_apoio" || value.support_plan.length > 0, {
  message: "Descreva o apoio necessário para a participação.", path: ["support_plan"],
});
export type CreateInclusionInput = z.infer<typeof createInclusionSchema>;
export type UpdateInclusionInput = z.infer<typeof updateInclusionSchema>;
export type InclusionInterviewInput = z.infer<typeof inclusionInterviewSchema>;
export type InclusionDecisionInput = z.infer<typeof inclusionDecisionSchema>;
export interface InclusionInterview {
  id: string; case_id: string; scheduled_at: string; participants: string;
  status: "agendada" | "realizada" | "cancelada"; summary: string;
  created_by: string; created_at: string; updated_at: string;
}
export interface InclusionHistory {
  id: string; case_id: string; action: string; actor_id: string; actor_name: string;
  created_at: string; details: Record<string, unknown>;
}
export interface InclusionCase {
  id: string; medical_record_id: string; full_name: string; phase: InclusionPhase;
  needs: string; support_plan: string; contacts: InclusionContacts; version: number;
  decision: InclusionDecision | null; decision_reason: string | null;
  decided_by: string | null; decided_at: string | null;
  created_by: string; created_at: string; updated_at: string;
}
export interface InclusionCaseDetail extends InclusionCase {
  interviews: InclusionInterview[]; history: InclusionHistory[];
}
export interface InclusionResponse<T> { data?: T; error?: string; code?: string; }
