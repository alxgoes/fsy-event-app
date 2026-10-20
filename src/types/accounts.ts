import { z } from "zod";
import { USER_ROLES } from "@/lib/auth/permissions";

/** Estado de acesso derivado do Supabase Auth e do perfil. Não indica presença "online". */
export type AccountStatus = "ativo" | "suspenso" | "aguardando_confirmacao" | "sem_perfil";

export interface AccountSummary {
  id: string;
  full_name: string;
  email: string | null;
  role: (typeof USER_ROLES)[number] | null;
  company_id: string | null;
  company_name: string | null;
  stake: string | null;
  room: string | null;
  phone: string | null;
  /** Provedores de login vinculados: "email", "google"… */
  providers: string[];
  has_password: boolean;
  created_at: string | null;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  suspended: boolean;
  status: AccountStatus;
}

export interface AccountListResponse {
  data: AccountSummary[];
  total: number;
  page: number;
  per_page: number;
  /** Ações permitidas ao operador atual por id de conta. */
  permissions: Record<string, AccountActionName[]>;
}

export type AccountActionName = "edit" | "role" | "suspend" | "reactivate" | "delete" | "recovery_email" | "set_password" | "email";

export interface AccountEvent {
  id: string;
  actor_name: string;
  actor_role: string;
  target_label: string;
  action: AccountActionName;
  details: Record<string, unknown>;
  created_at: string;
}

export const accountListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  per_page: z.coerce.number().int().min(10).max(100).default(25),
  q: z.string().trim().max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(["ativo", "suspenso", "aguardando_confirmacao", "sem_perfil"]).optional(),
});

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const accountEditSchema = z.object({
  action: z.literal("edit"),
  full_name: z.string().trim().min(2, "Informe o nome completo.").max(160).optional(),
  company_id: z.string().trim().max(64).nullable().optional(),
  stake: optionalText(120),
  room: optionalText(40),
  phone: optionalText(40),
});

export const accountPatchSchema = z.discriminatedUnion("action", [
  accountEditSchema,
  z.object({ action: z.literal("role"), role: z.enum(USER_ROLES, { message: "Cargo inválido." }) }),
  z.object({ action: z.literal("suspend"), reason: z.string().trim().max(300).optional() }),
  z.object({ action: z.literal("reactivate") }),
]);

/** Exclusão exige digitar o e-mail (ou nome) da conta alvo, conferido no servidor. */
export const accountDeleteSchema = z.object({ confirm: z.string().trim().min(1, "Digite a confirmação.").max(254) });

export const accountPasswordSchema = z.object({ password: z.string().min(8).max(72) });

export const accountEmailSchema = z.object({
  subject: z.string().trim().min(3, "Informe o assunto.").max(150),
  body: z.string().trim().min(10, "Escreva a mensagem.").max(5000),
  confirm: z.literal(true, { message: "Confirme o envio." }),
});
