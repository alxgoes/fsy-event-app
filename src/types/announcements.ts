import { z } from "zod";
import { companyIdSchema } from "@/types/companies";

export const ANNOUNCEMENT_PRIORITIES = ["normal", "important", "urgent"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

const LEGACY_PRIORITY: Record<string, AnnouncementPriority> = { baixa: "normal", alta: "important", urgente: "urgent" };

export const announcementPrioritySchema = z.preprocess(
  (value) => (typeof value === "string" && LEGACY_PRIORITY[value]) || value,
  z.enum(ANNOUNCEMENT_PRIORITIES, { message: "Prioridade inválida." })
);

export const announcementSchema = z.object({
  title: z.string().trim().min(2, "Título deve ter pelo menos 2 caracteres").max(150, "Título muito longo"),
  content: z.string().trim().min(2, "Conteúdo deve ter pelo menos 2 caracteres").max(5000),
  priority: announcementPrioritySchema.default("normal"),
  category: z.string().trim().min(1).max(60).default("Geral"),
  target_company_id: companyIdSchema.nullable().optional(),
});

export const announcementUpdateSchema = announcementSchema.partial().extend({ id: z.string().uuid("Comunicado inválido.") });

export const likeAnnouncementSchema = z.object({
  announcement_id: z.string().uuid("ID de anúncio inválido"),
});

export interface AnnouncementView {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  target_company_id: string | null;
  category: string;
  created_at: string;
  author_id: string | null;
  profiles?: { full_name: string; role: string } | null;
  likes_count: number;
  liked_by_me: boolean;
  /** Compatibilidade: contém somente o próprio id quando curtido. */
  liked_by: string[];
}

/** Remove o sufixo legado de curtidas que era gravado dentro da categoria. */
export function baseCategory(raw: string | null | undefined): string {
  const value = raw || "Geral";
  return value.includes("__LIKES__") ? value.split("__LIKES__")[0] || "Geral" : value;
}
