import { z } from "zod";

/** Schema for creating/updating a schedule event */
export const scheduleItemSchema = z.object({
  title: z.string().trim().min(2, "Título deve ter pelo menos 2 caracteres").max(120, "Título muito longo"),
  start_time: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Horário de início deve ser no formato HH:MM"),
  end_time: z.string().trim().default("--"),
  location: z.string().trim().min(2, "Localização deve ter pelo menos 2 caracteres").max(100),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().default("Atividade"),
  day: z.enum(["dia0", "dia1", "dia2", "dia3", "dia4", "dia5"], {
    message: "Dia deve ser entre dia0 e dia5",
  }),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve ser no formato YYYY-MM-DD")
    .optional(),
  is_highlight: z.boolean().default(false),
});

export { announcementSchema, likeAnnouncementSchema } from "@/types/announcements";

/** Schema for company updates */
export const companySchema = z.object({
  name: z.string().trim().min(2).max(100),
  motto: z.string().trim().max(300).nullable().optional(),
  counselors: z.array(z.string().trim()).nullable().optional(),
});

/** Valid FSY Roles */
export const validRoles = [
  "coordenador",
  "casal_diretor",
  "consultor",
  "assistente",
  "midia",
  "saude",
  "logistica",
  "jovem",
] as const;

export const userRoleUpdateSchema = z.object({
  user_id: z.string().uuid("ID de usuário inválido"),
  role: z.enum(validRoles, {
    message: "Cargo inválido",
  }),
});
