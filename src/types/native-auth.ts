/**
 * Autenticação do app iOS nas mesmas APIs do site.
 *
 * O app envia `Authorization: Bearer <access_token do Supabase>` (nunca cookie, nunca service_role).
 * O servidor valida o token no Auth e lê cargo/suspensão do banco a cada requisição, exatamente como faz
 * com o cookie do site. Authorization presente e inválida falha fechada: não há retorno ao cookie.
 */

/** Prefixos de API que aceitam Bearer. Qualquer outra rota com Authorization é recusada. */
export const BEARER_API_PREFIXES = [
  "/api/admin",
  "/api/announcements",
  "/api/companies",
  "/api/inclusion",
  "/api/logistics",
  "/api/media",
  "/api/medical",
  "/api/schedule",
  "/api/users",
] as const;

export type AuthorizationHeader =
  | { kind: "none" }
  | { kind: "bearer"; token: string }
  | { kind: "invalid" };

/** Visão geral do painel (GET /api/admin/overview), mesmas métricas do painel web. */
export interface AdminOverview {
  total_youth: number;
  youth_with_company: number;
  youth_with_room: number;
  total_companies: number;
  total_counselors: number;
  /** Fichas de saúde cadastradas (apenas contagem). */
  medical_records: number;
  total_announcements: number;
  total_photos: number;
  recent_announcements: { id: string; title: string; priority: string; category: string; created_at: string }[];
  generated_at: string;
}
