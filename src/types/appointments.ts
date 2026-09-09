import { z } from "zod";
const optionalText = z.string().trim().max(6000).nullish();
export const appointmentCreateSchema = z.object({
  user_id: z.string().uuid().nullish(), medical_record_id: z.string().uuid().nullish(),
  youth_name: z.string().trim().min(2).max(160), professional_name: z.string().trim().min(2).max(160),
  reason: z.string().trim().max(500).default("Atendimento Multidisciplinar"),
  scheduled_at: z.string().datetime({ offset: true }), notes: optionalText,
}).strict();
export const appointmentUpdateSchema = z.object({
  id: z.string().uuid(), is_seen: z.boolean().optional(),
  status: z.enum(["agendado", "realizado", "cancelado"]).optional(), notes: optionalText,
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  professional_name: z.string().trim().min(2).max(160).optional(),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();
