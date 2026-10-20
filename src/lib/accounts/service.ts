import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Identity } from "@/lib/supabase/server";
import {
  ADMIN_ROLES,
  canAssignRole,
  canPerformAccountAction,
  isRole,
  type AccountAction,
  type Role,
} from "@/lib/auth/permissions";
import type { AccountActionName, AccountStatus, AccountSummary } from "@/types/accounts";

type Db = ReturnType<typeof createAdminClient>;

interface AuthUserLike {
  id: string;
  email?: string | null;
  app_metadata?: { providers?: string[]; provider?: string } | null;
  identities?: Array<{ provider: string }> | null;
  created_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: string | null;
  company_id: string | null;
  stake: string | null;
  room: string | null;
  phone: string | null;
  suspended_at?: string | null;
}

const PROFILE_FIELDS = "id, full_name, role, company_id, stake, room, phone, suspended_at";

export function providersOf(user: AuthUserLike): string[] {
  const set = new Set<string>();
  user.identities?.forEach((identity) => identity?.provider && set.add(identity.provider));
  user.app_metadata?.providers?.forEach((provider) => set.add(provider));
  if (set.size === 0 && user.app_metadata?.provider) set.add(user.app_metadata.provider);
  return Array.from(set).sort();
}

function isBanned(user: AuthUserLike | null) {
  return !!user?.banned_until && new Date(user.banned_until).getTime() > Date.now();
}

export function toSummary(user: AuthUserLike | null, profile: ProfileRow | null, companies: Map<string, string>): AccountSummary {
  const providers = user ? providersOf(user) : [];
  const suspended = !!profile?.suspended_at || isBanned(user);
  let status: AccountStatus = "ativo";
  if (!profile) status = "sem_perfil";
  else if (suspended) status = "suspenso";
  else if (user && providers.includes("email") && !user.email_confirmed_at) status = "aguardando_confirmacao";
  return {
    id: (profile?.id ?? user?.id) as string,
    full_name: profile?.full_name ?? user?.email ?? "Sem nome",
    email: user?.email ?? null,
    role: isRole(profile?.role) ? profile!.role as Role : null,
    company_id: profile?.company_id ?? null,
    company_name: profile?.company_id ? companies.get(profile.company_id) ?? null : null,
    stake: profile?.stake ?? null,
    room: profile?.room ?? null,
    phone: profile?.phone ?? null,
    providers,
    has_password: providers.includes("email"),
    created_at: user?.created_at ?? null,
    email_confirmed_at: user?.email_confirmed_at ?? null,
    last_sign_in_at: user?.last_sign_in_at ?? null,
    suspended,
    status,
  };
}

async function companyNames(db: Db) {
  const { data } = await db.from("companies").select("id, name");
  return new Map<string, string>((data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
}

/** Lista todas as contas (escala do evento: centenas). Limite de segurança: 10 mil. */
export async function loadAllAccounts(db: Db): Promise<AccountSummary[]> {
  const users: AuthUserLike[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...(data?.users ?? []));
    if (!data?.users || data.users.length < 1000) break;
  }
  const [{ data: profiles, error }, companies] = await Promise.all([
    db.from("profiles").select(PROFILE_FIELDS),
    companyNames(db),
  ]);
  if (error) throw error;
  const byId = new Map<string, ProfileRow>((profiles ?? []).map((p: ProfileRow) => [p.id, p]));
  return users.map((user) => toSummary(user, byId.get(user.id) ?? null, companies));
}

export async function loadAccount(db: Db, id: string) {
  const [{ data: authData }, { data: profile }, companies] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("profiles").select(PROFILE_FIELDS).eq("id", id).maybeSingle(),
    companyNames(db),
  ]);
  const user = (authData?.user ?? null) as AuthUserLike | null;
  if (!user && !profile) return null;
  return { user, profile: (profile ?? null) as ProfileRow | null, summary: toSummary(user, profile as ProfileRow | null, companies) };
}

const ACTION_PERMISSION: Record<AccountActionName, AccountAction> = {
  edit: "edit",
  role: "role",
  suspend: "suspend",
  reactivate: "suspend",
  delete: "delete",
  recovery_email: "recovery_email",
  set_password: "set_password",
  email: "email",
};

/** Ações oferecidas na interface para cada conta. O servidor revalida em cada chamada. */
export function allowedActions(actor: Identity, target: AccountSummary): AccountActionName[] {
  const targetRole: Role = target.role ?? "jovem";
  const self = actor.user.id === target.id;
  return (Object.keys(ACTION_PERMISSION) as AccountActionName[]).filter((action) => {
    if (self && ["role", "suspend", "reactivate", "delete", "set_password"].includes(action)) return false;
    if (action === "suspend" && target.suspended) return false;
    if (action === "reactivate" && !target.suspended) return false;
    if ((action === "recovery_email" || action === "email") && !target.email) return false;
    if (action === "role") return canAssignRole(actor.role, targetRole, "jovem");
    return canPerformAccountAction(actor.role, targetRole, ACTION_PERMISSION[action]);
  });
}

export function mayAct(actor: Identity, targetRole: Role, action: AccountActionName) {
  return canPerformAccountAction(actor.role, targetRole, ACTION_PERMISSION[action]);
}

/** Quantas contas de direção/coordenação seguem habilitadas. */
export async function countEnabledAdmins(db: Db) {
  const { count, error } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("role", ADMIN_ROLES)
    .is("suspended_at", null);
  if (error) throw error;
  return count ?? 0;
}

export function isEnabledAdmin(summary: AccountSummary) {
  return !!summary.role && ADMIN_ROLES.includes(summary.role) && !summary.suspended;
}

/** Registros que precisam permanecer e impedem a exclusão física da conta. */
const PRESERVED_REFERENCES: Array<[string, string, string]> = [
  ["inclusion_cases", "created_by", "acompanhamentos de inclusão"],
  ["inclusion_cases", "decided_by", "decisões de inclusão"],
  ["inclusion_history", "actor_id", "histórico de inclusão"],
  ["inclusion_interviews", "created_by", "entrevistas de inclusão"],
  ["media_photos", "author_id", "fotos publicadas"],
  ["medical_appointments", "created_by", "atendimentos registrados"],
];

export async function preservedReferences(db: Db, id: string): Promise<string[]> {
  const results = await Promise.all(
    PRESERVED_REFERENCES.map(async ([table, column, label]) => {
      const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(column, id);
      if (error) return error.code === "42P01" ? null : label;
      return (count ?? 0) > 0 ? label : null;
    })
  );
  return Array.from(new Set(results.filter((label): label is string => !!label)));
}

export async function recordAccountEvent(
  db: Db,
  actor: Identity,
  target: { id: string; label: string },
  action: AccountActionName,
  details: Record<string, unknown> = {}
) {
  const { error } = await db.from("admin_account_events").insert({
    actor_id: actor.user.id,
    actor_name: actor.profile.full_name,
    actor_role: actor.role,
    target_id: target.id,
    target_label: target.label,
    action: action === "reactivate" ? "reactivate" : action,
    details,
  });
  if (error) console.error("[accounts] audit", error.code ?? "");
  return !error;
}

export const targetLabel = (summary: AccountSummary) =>
  summary.email ? `${summary.full_name} <${summary.email}>` : summary.full_name;
