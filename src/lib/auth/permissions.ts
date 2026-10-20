/**
 * Matriz de permissões do FSY. Fonte única para servidor, middleware e interface.
 * A interface usa estas funções apenas para esconder ações; quem autoriza é o servidor.
 */
export const USER_ROLES = [
  "jovem",
  "consultor",
  "midia",
  "medico",
  "logistica",
  "coordenador",
  "casal_diretor",
] as const;

export type Role = (typeof USER_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

const DIRECTORS: Role[] = ["coordenador", "casal_diretor"];
const MASTER: Role[] = ["coordenador", "casal_diretor", "logistica"];

/** Papéis que operam cada módulo. Saúde/inclusão preservam o acesso atual da logística (pendente de confirmação). */
export const ROLE_GROUPS = {
  userManagers: MASTER,
  companyManagers: MASTER,
  scheduleManagers: MASTER,
  logisticsManagers: MASTER,
  announcementManagers: MASTER,
  announcementAuthors: [...MASTER, "consultor"] as Role[],
  mediaManagers: ["midia", ...MASTER] as Role[],
  medicalStaff: ["medico", ...MASTER] as Role[],
  auditReaders: MASTER,
  counselorPanel: ["consultor", ...MASTER] as Role[],
  /** Ações destrutivas ou sensíveis de conta exigem direção. */
  accountGuardians: DIRECTORS,
} satisfies Record<string, Role[]>;

export type RoleGroup = keyof typeof ROLE_GROUPS;

export function hasRole(role: Role | null | undefined, group: RoleGroup): boolean {
  return !!role && ROLE_GROUPS[group].includes(role);
}

/** Hierarquia para a gestão de contas. Maior número = maior autoridade. */
const RANK: Record<Role, number> = {
  jovem: 1,
  consultor: 1,
  midia: 1,
  medico: 1,
  logistica: 2,
  coordenador: 3,
  casal_diretor: 4,
};

/** Papéis que contam como administração habilitada para a proteção do último administrador. */
export const ADMIN_ROLES: Role[] = DIRECTORS;

export function canManageAccount(actor: Role | null | undefined, target: Role): boolean {
  if (!actor || !hasRole(actor, "userManagers")) return false;
  if (actor === "casal_diretor") return true;
  return RANK[target] < RANK[actor];
}

export function canAssignRole(actor: Role | null | undefined, target: Role, next: Role): boolean {
  if (!canManageAccount(actor, target)) return false;
  if (actor === "casal_diretor") return true;
  return RANK[next] < RANK[actor!];
}

export type AccountAction = "edit" | "role" | "suspend" | "delete" | "recovery_email" | "set_password" | "email";

export function canPerformAccountAction(actor: Role | null | undefined, target: Role, action: AccountAction): boolean {
  if (!canManageAccount(actor, target)) return false;
  if (action === "suspend" || action === "delete" || action === "set_password") return hasRole(actor, "accountGuardians");
  return true;
}

/** Rota inicial após login, por cargo. */
export function homePathForRole(role: Role | null | undefined): string {
  switch (role) {
    case "casal_diretor":
    case "coordenador":
    case "logistica":
      return "/admin";
    case "medico":
      return "/admin/medical";
    case "consultor":
      return "/consultor";
    case "midia":
      return "/admin/media";
    default:
      return "/dashboard";
  }
}

/** Aceita apenas caminhos internos relativos para evitar redirecionamento aberto. */
export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
