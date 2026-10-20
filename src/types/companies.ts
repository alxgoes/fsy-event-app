import { z } from "zod";

/** Identificador textual legado das companhias (ex.: "cia-1"). */
export const companyIdSchema = z.string().trim().min(1, "Informe a companhia.").max(64, "Identificador muito longo.");

export const companySaveSchema = z.object({
  id: companyIdSchema.optional(),
  name: z.string().trim().min(2, "O nome da companhia precisa de ao menos 2 caracteres.").max(100).optional(),
  motto: z.string().trim().max(300, "Lema muito longo.").nullable().optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.").optional(),
  counselor_ids: z.array(z.string().uuid("Consultor inválido.")).max(40).optional(),
});

export type CompanySaveInput = z.infer<typeof companySaveSchema>;

export interface PublicCompany {
  id: string;
  name: string;
  motto: string | null;
  color: string | null;
  counselors: string[];
}
