import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { allowedActions, loadAllAccounts } from "@/lib/accounts/service";
import { accountListQuerySchema, type AccountListResponse } from "@/types/accounts";

export const dynamic = "force-dynamic";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Lista contas do portal combinando Supabase Auth e perfis. Somente gestores de usuários. */
export async function GET(request: Request) {
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  const parsed = accountListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return json({ error: "Filtros inválidos." }, 400);
  const { page, per_page, q, role, status } = parsed.data;
  try {
    let accounts = await loadAllAccounts(createAdminClient());
    if (q) {
      const term = normalize(q);
      accounts = accounts.filter((a) => normalize(`${a.full_name} ${a.email ?? ""} ${a.company_name ?? ""} ${a.stake ?? ""}`).includes(term));
    }
    if (role) accounts = accounts.filter((a) => a.role === role);
    if (status) accounts = accounts.filter((a) => a.status === status);
    accounts.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

    const slice = accounts.slice((page - 1) * per_page, page * per_page);
    const body: AccountListResponse = {
      data: slice,
      total: accounts.length,
      page,
      per_page,
      permissions: Object.fromEntries(slice.map((a) => [a.id, allowedActions(auth.identity, a)])),
    };
    return json(body);
  } catch (err) {
    return serverError("accounts.list", err);
  }
}
