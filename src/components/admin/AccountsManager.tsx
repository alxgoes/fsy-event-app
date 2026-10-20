"use client";
import { startTransition } from "react";


import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, PasswordInput } from "@/components/ui/field";
import { ROLE_LABELS, useProfile } from "@/lib/supabase/useProfile";
import { USER_ROLES, canAssignRole, type Role } from "@/lib/auth/permissions";
import { passwordProblem } from "@/lib/auth/password-policy";
import type { AccountActionName, AccountEvent, AccountListResponse, AccountStatus, AccountSummary } from "@/types/accounts";

const STATUS_LABEL: Record<AccountStatus, string> = {
  ativo: "Ativa",
  suspenso: "Suspensa",
  aguardando_confirmacao: "E-mail não confirmado",
  sem_perfil: "Sem perfil",
};
const STATUS_STYLE: Record<AccountStatus, string> = {
  ativo: "bg-[#EAF5DC] text-[#2F5413] dark:bg-[#1C2B10] dark:text-[#CDEBA9]",
  suspenso: "bg-[#FDECE8] text-[#8A2314] dark:bg-[#2E1410] dark:text-[#FFC9BD]",
  aguardando_confirmacao: "bg-[#FFF4CC] text-[#6B4A00] dark:bg-[#2D2408] dark:text-[#FFE48A]",
  sem_perfil: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};
const EVENT_LABEL: Record<AccountActionName, string> = {
  edit: "Dados alterados",
  role: "Cargo alterado",
  suspend: "Acesso suspenso",
  reactivate: "Acesso reativado",
  delete: "Conta excluída",
  recovery_email: "Link de recuperação enviado",
  set_password: "Senha do portal redefinida",
  email: "Mensagem enviada",
};

const dateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : null;

const providerLabel = (provider: string) => (provider === "google" ? "Google" : provider === "email" ? "E-mail e senha" : provider);

interface Company {
  id: string;
  name: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Não foi possível concluir. Tente novamente.");
  return body as T;
}

export function AccountsManager() {
  const { profile } = useProfile();
  const [result, setResult] = useState<AccountListResponse | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AccountSummary | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => startTransition(() => { setPage(1); }), [debounced, role, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), per_page: "25" });
    if (debounced) params.set("q", debounced);
    if (role) params.set("role", role);
    if (status) params.set("status", status);
    try {
      setResult(await api<AccountListResponse>(`/api/admin/accounts?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar as contas.");
    } finally {
      setLoading(false);
    }
  }, [page, debounced, role, status]);

  useEffect(() => {
    startTransition(() => { void load(); });
  }, [load]);

  useEffect(() => {
    api<{ companies: Company[] }>("/api/companies")
      .then((r) => setCompanies(r.companies ?? []))
      .catch(() => setCompanies([]));
  }, []);

  const pages = result ? Math.max(1, Math.ceil(result.total / result.per_page)) : 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007DA5] text-white dark:bg-[#01B6D1] dark:text-slate-950">
            <Users className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Contas e acessos</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {result ? `${result.total} conta(s)` : "Carregando…"} · “Último acesso” é o último login, não presença em tempo real.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()} className="h-11 gap-2 rounded-xl px-4">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Atualizar
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-300" aria-hidden="true" />
          <Input aria-label="Buscar por nome, e-mail, companhia ou estaca" placeholder="Buscar nome, e-mail, companhia…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10" type="search" />
        </div>
        <NativeSelect aria-label="Filtrar por cargo" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Todos os cargos</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Filtrar por situação" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas as situações</option>
          {(Object.keys(STATUS_LABEL) as AccountStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </NativeSelect>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-[#F4B4A8] bg-[#FDF1EE] px-4 py-3 text-sm text-[#7A1F12] dark:border-[#7A2E22] dark:bg-[#2A1410] dark:text-[#FFD2C8]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {error}
        </div>
      )}

      {loading && !result ? (
        <p role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-700 dark:text-slate-200">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Carregando contas…
        </p>
      ) : result && result.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
          Nenhuma conta encontrada com estes filtros.
        </p>
      ) : (
        <ul className="grid gap-3" aria-busy={loading}>
          {result?.data.map((account) => (
            <li key={account.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">{account.full_name}</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[account.status]}`}>{STATUS_LABEL[account.status]}</span>
                  </div>
                  <p className="truncate text-sm text-slate-700 dark:text-slate-300">{account.email ?? "Sem e-mail"}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <span>{account.role ? ROLE_LABELS[account.role] : "Sem cargo"}</span>
                    {account.company_name && <span>{account.company_name}</span>}
                    <span>Login: {account.providers.map(providerLabel).join(" + ") || "—"}</span>
                    <span>Último acesso: {dateTime(account.last_sign_in_at) ?? "nunca entrou"}</span>
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="h-11 shrink-0 gap-2 rounded-xl px-4"
                  onClick={() => setSelected(account)}
                  disabled={(result?.permissions[account.id] ?? []).length === 0}
                  aria-label={`Gerenciar conta de ${account.full_name}`}
                >
                  <UserCog className="h-4 w-4" aria-hidden="true" /> Gerenciar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {result && pages > 1 && (
        <nav aria-label="Paginação das contas" className="flex items-center justify-center gap-3">
          <Button variant="outline" className="h-11 w-11 rounded-xl p-0" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="text-sm text-slate-700 dark:text-slate-200">Página {page} de {pages}</span>
          <Button variant="outline" className="h-11 w-11 rounded-xl p-0" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      )}

      {selected && result && profile && (
        <AccountDialog
          account={selected}
          actions={result.permissions[selected.id] ?? []}
          actorRole={profile.role as Role}
          companies={companies}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

type Tab = "dados" | "acesso" | "mensagem" | "historico";

function AccountDialog({
  account,
  actions,
  actorRole,
  companies,
  onClose,
  onChanged,
}: {
  account: AccountSummary;
  actions: AccountActionName[];
  actorRole: Role;
  companies: Company[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const can = (action: AccountActionName) => actions.includes(action);
  const tabs = useMemo(() => {
    const list: Array<[Tab, string]> = [];
    if (can("edit") || can("role")) list.push(["dados", "Dados e cargo"]);
    if (["suspend", "reactivate", "recovery_email", "set_password", "delete"].some((a) => can(a as AccountActionName))) list.push(["acesso", "Acesso"]);
    if (can("email")) list.push(["mensagem", "Mensagem"]);
    list.push(["historico", "Histórico"]);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);
  const [tab, setTab] = useState<Tab>(tabs[0][0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const run = async (key: string, fn: () => Promise<{ message?: string }>, success: string) => {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fn();
      setNotice({ kind: "ok", text: res.message || success });
      onChanged();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Falha na operação." });
    } finally {
      setBusy(null);
    }
  };

  const patch = (body: Record<string, unknown>) =>
    api<{ message?: string }>(`/api/admin/accounts/${account.id}`, { method: "PATCH", body: JSON.stringify(body) });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="pr-10 font-heading text-xl font-bold text-slate-900 dark:text-white">{account.full_name}</DialogTitle>
          <DialogDescription className="text-sm text-slate-700 dark:text-slate-300">
            {account.email ?? "Sem e-mail"} · {account.role ? ROLE_LABELS[account.role] : "Sem cargo"} · Login por {account.providers.map(providerLabel).join(" + ") || "—"}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-xs dark:bg-slate-800/60 sm:grid-cols-4">
          {[
            ["Criada em", dateTime(account.created_at) ?? "—"],
            ["E-mail confirmado", dateTime(account.email_confirmed_at) ?? "não"],
            ["Último acesso", dateTime(account.last_sign_in_at) ?? "nunca"],
            ["Situação", STATUS_LABEL[account.status]],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="font-semibold text-slate-600 dark:text-slate-400">{k}</dt>
              <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{v}</dd>
            </div>
          ))}
        </dl>

        <div role="tablist" aria-label="Seções da conta" className="flex gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={tab === value}
              onClick={() => {
                setTab(value);
                setNotice(null);
              }}
              className={`min-h-11 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors ${
                tab === value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div aria-live="polite">
          {notice && (
            <p
              role={notice.kind === "error" ? "alert" : "status"}
              className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
                notice.kind === "ok" ? "bg-[#F2FAEA] text-[#2F5413] dark:bg-[#14210B] dark:text-[#D6F0BC]" : "bg-[#FDF1EE] text-[#7A1F12] dark:bg-[#2A1410] dark:text-[#FFD2C8]"
              }`}
            >
              {notice.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
              {notice.text}
            </p>
          )}
        </div>

        {tab === "dados" && (
          <DataTab account={account} actorRole={actorRole} companies={companies} canEdit={can("edit")} canRole={can("role")} busy={busy} run={run} patch={patch} />
        )}
        {tab === "acesso" && <AccessTab account={account} can={can} busy={busy} run={run} patch={patch} onDeleted={onClose} />}
        {tab === "mensagem" && <MessageTab account={account} busy={busy} run={run} />}
        {tab === "historico" && <HistoryTab accountId={account.id} />}
      </DialogContent>
    </Dialog>
  );
}

type Runner = (key: string, fn: () => Promise<{ message?: string }>, success: string) => Promise<void>;
type Patcher = (body: Record<string, unknown>) => Promise<{ message?: string }>;

function DataTab({ account, actorRole, companies, canEdit, canRole, busy, run, patch }: {
  account: AccountSummary; actorRole: Role; companies: Company[]; canEdit: boolean; canRole: boolean; busy: string | null; run: Runner; patch: Patcher;
}) {
  const [form, setForm] = useState({
    full_name: account.full_name,
    company_id: account.company_id ?? "",
    stake: account.stake ?? "",
    room: account.room ?? "",
    phone: account.phone ?? "",
  });
  const [nextRole, setNextRole] = useState<Role>(account.role ?? "jovem");
  const assignable = USER_ROLES.filter((r) => r === account.role || canAssignRole(actorRole, account.role ?? "jovem", r));
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      {canEdit && (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run("edit", () => patch({ action: "edit", ...form, company_id: form.company_id || null }), "Dados salvos.");
          }}
        >
          <Field id="acc-name" label="Nome completo" required className="sm:col-span-2">
            {(a) => <Input {...a} value={form.full_name} onChange={set("full_name")} autoComplete="off" />}
          </Field>
          <Field id="acc-company" label="Companhia">
            {(a) => (
              <NativeSelect {...a} value={form.company_id} onChange={set("company_id")}>
                <option value="">Sem companhia</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field id="acc-room" label="Quarto">
            {(a) => <Input {...a} value={form.room} onChange={set("room")} autoComplete="off" />}
          </Field>
          <Field id="acc-stake" label="Estaca">
            {(a) => <Input {...a} value={form.stake} onChange={set("stake")} autoComplete="off" />}
          </Field>
          <Field id="acc-phone" label="Celular">
            {(a) => <Input {...a} type="tel" inputMode="tel" value={form.phone} onChange={set("phone")} autoComplete="off" />}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" className="h-11 rounded-xl px-5" disabled={busy === "edit"}>
              {busy === "edit" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Salvar dados
            </Button>
          </div>
        </form>
      )}

      {canRole && (
        <form
          className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
          onSubmit={(e) => {
            e.preventDefault();
            if (nextRole === account.role) return;
            void run("role", () => patch({ action: "role", role: nextRole }), "Cargo alterado.");
          }}
        >
          <Field id="acc-role" label="Cargo no portal" hint="Só aparecem cargos que o seu cargo pode atribuir. O cargo define o que a pessoa vê e pode alterar.">
            {(a) => (
              <NativeSelect {...a} value={nextRole} onChange={(e) => setNextRole(e.target.value as Role)}>
                {assignable.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Button type="submit" variant="outline" className="h-11 gap-2 rounded-xl px-5" disabled={busy === "role" || nextRole === account.role}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Aplicar cargo
          </Button>
        </form>
      )}
    </div>
  );
}

function AccessTab({ account, can, busy, run, patch, onDeleted }: {
  account: AccountSummary; can: (a: AccountActionName) => boolean; busy: string | null; run: Runner; patch: Patcher; onDeleted: () => void;
}) {
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState("");
  const googleOnly = account.providers.includes("google") && !account.has_password;
  const expected = account.email ?? account.full_name;

  return (
    <div className="space-y-4">
      {can("recovery_email") && (
        <section className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Mail className="h-4 w-4" aria-hidden="true" /> Link de recuperação</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {googleOnly
              ? "Esta conta entra com Google. O link cria uma senha do portal para o mesmo cadastro; não recupera nem altera a senha do Google."
              : "Envia para o e-mail da conta um link que expira, para a pessoa criar uma nova senha do portal."}
          </p>
          <Button variant="outline" className="h-11 gap-2 rounded-xl px-4" disabled={busy === "recovery"} onClick={() => void run("recovery", () => api(`/api/admin/accounts/${account.id}/recovery`, { method: "POST", body: "{}" }), "Link enviado.")}>
            {busy === "recovery" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Enviar link para {account.email}
          </Button>
        </section>
      )}

      {can("set_password") && (
        <form
          className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700"
          onSubmit={(e) => {
            e.preventDefault();
            const problem = passwordProblem(password);
            setPasswordError(problem);
            if (problem) return;
            void run("password", async () => {
              const res = await api<{ message?: string }>(`/api/admin/accounts/${account.id}/password`, { method: "POST", body: JSON.stringify({ password }) });
              setPassword("");
              return res;
            }, "Senha redefinida.");
          }}
        >
          <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><KeyRound className="h-4 w-4" aria-hidden="true" /> Definir senha do portal</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">Use só quando a pessoa não consegue receber o e-mail. A senha atual nunca é exibida; repasse a nova por um canal seguro e peça a troca.</p>
          <input type="text" name="username" autoComplete="username" value={account.email ?? ""} readOnly className="sr-only" tabIndex={-1} aria-hidden="true" />
          <Field id="acc-new-password" label="Nova senha" error={passwordError} hint="Mínimo de 8 caracteres, com letras e números.">
            {(a) => <PasswordInput {...a} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" variant="outline" className="h-11 rounded-xl px-4" disabled={busy === "password" || !password}>
            Salvar nova senha
          </Button>
        </form>
      )}

      {(can("suspend") || can("reactivate")) && (
        <section className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Ban className="h-4 w-4" aria-hidden="true" /> {account.suspended ? "Reativar acesso" : "Suspender acesso"}</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {account.suspended
              ? "A pessoa volta a entrar com os mesmos dados. Nenhum registro foi apagado."
              : "Bloqueia novos logins e invalida o cargo imediatamente. Dados, fichas e histórico ficam preservados; dá para reativar depois."}
          </p>
          <Button
            variant={account.suspended ? "outline" : "destructive"}
            className="h-11 rounded-xl px-4"
            disabled={busy === "suspend"}
            onClick={() => {
              if (!account.suspended && !window.confirm(`Suspender o acesso de ${account.full_name}?`)) return;
              void run("suspend", () => patch({ action: account.suspended ? "reactivate" : "suspend" }), account.suspended ? "Acesso reativado." : "Acesso suspenso.");
            }}
          >
            {account.suspended ? "Reativar acesso" : "Suspender acesso"}
          </Button>
        </section>
      )}

      {can("delete") && (
        <form
          className="space-y-3 rounded-2xl border border-[#F4B4A8] bg-[#FFF8F6] p-4 dark:border-[#7A2E22] dark:bg-[#1F0F0C]"
          onSubmit={(e) => {
            e.preventDefault();
            void run("delete", async () => {
              const res = await api<{ message?: string }>(`/api/admin/accounts/${account.id}`, { method: "DELETE", body: JSON.stringify({ confirm: confirmDelete }) });
              setTimeout(onDeleted, 1200);
              return res;
            }, "Conta excluída.");
          }}
        >
          <h3 className="flex items-center gap-2 font-semibold text-[#8A2314] dark:text-[#FFC9BD]"><Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir conta</h3>
          <p className="text-sm text-slate-800 dark:text-slate-200">
            Remove o login e o perfil de <strong>{account.full_name}</strong> de forma definitiva. Fichas médicas permanecem, sem vínculo com a conta.
            Se houver registros que precisam ser preservados (inclusão, atendimentos, fotos), a exclusão é recusada: suspenda o acesso.
          </p>
          <Field id="acc-delete-confirm" label={<>Digite <span className="font-mono">{expected}</span> para confirmar</>}>
            {(a) => <Input {...a} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} autoComplete="off" />}
          </Field>
          <Button type="submit" variant="destructive" className="h-11 rounded-xl px-4" disabled={busy === "delete" || confirmDelete.trim().toLowerCase() !== expected.trim().toLowerCase()}>
            Excluir definitivamente
          </Button>
        </form>
      )}
    </div>
  );
}

function MessageTab({ account, busy, run }: { account: AccountSummary; busy: string | null; run: Runner }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const valid = subject.trim().length >= 3 && body.trim().length >= 10;

  if (preview) {
    return (
      <div className="space-y-4">
        <article className="space-y-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-700" aria-label="Prévia da mensagem">
          <p className="text-xs text-slate-600 dark:text-slate-400">Para: <strong className="text-slate-900 dark:text-white">{account.full_name} &lt;{account.email}&gt;</strong></p>
          <p className="text-xs text-slate-600 dark:text-slate-400">Assunto: <strong className="text-slate-900 dark:text-white">{subject}</strong></p>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-900 dark:text-slate-100">{body}</p>
        </article>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-800 dark:text-slate-200">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-5 w-5 accent-[#007DA5]" />
          Confirmo o destinatário e o conteúdo desta mensagem.
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => setPreview(false)}>Editar</Button>
          <Button
            className="h-11 gap-2 rounded-xl px-4"
            disabled={!confirmed || busy === "email"}
            onClick={() =>
              void run("email", async () => {
                const res = await api<{ message?: string }>(`/api/admin/accounts/${account.id}/email`, { method: "POST", body: JSON.stringify({ subject, body, confirm: true }) });
                setSubject("");
                setBody("");
                setPreview(false);
                setConfirmed(false);
                return res;
              }, "Mensagem aceita para envio.")
            }
          >
            {busy === "email" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Enviar mensagem
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setPreview(true);
      }}
    >
      <p className="text-sm text-slate-700 dark:text-slate-300">A mensagem vai somente para o e-mail cadastrado ({account.email}). As respostas chegam ao seu e-mail.</p>
      <Field id="msg-subject" label="Assunto" required>
        {(a) => <Input {...a} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />}
      </Field>
      <Field id="msg-body" label="Mensagem" required hint="Não inclua senhas nem informações de saúde.">
        {(a) => <Textarea {...a} rows={7} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />}
      </Field>
      <Button type="submit" className="h-11 rounded-xl px-5" disabled={!valid}>Revisar antes de enviar</Button>
    </form>
  );
}

function HistoryTab({ accountId }: { accountId: string }) {
  const [events, setEvents] = useState<AccountEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<{ data: AccountEvent[] }>(`/api/admin/accounts/${accountId}`)
      .then((r) => setEvents(r.data))
      .catch((err) => setError(err.message));
  }, [accountId]);

  if (error) return <p role="alert" className="text-sm text-[#7A1F12] dark:text-[#FFD2C8]">{error}</p>;
  if (!events) return <p role="status" className="text-sm text-slate-700 dark:text-slate-200">Carregando histórico…</p>;
  if (events.length === 0) return <p className="text-sm text-slate-700 dark:text-slate-200">Nenhuma ação administrativa registrada para esta conta.</p>;
  return (
    <ol className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 dark:text-slate-300" aria-hidden="true" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{EVENT_LABEL[event.action] ?? event.action}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {event.actor_name} ({ROLE_LABELS[event.actor_role as Role] ?? event.actor_role}) · {dateTime(event.created_at)}
              {event.action === "role" && event.details?.to ? ` · ${ROLE_LABELS[event.details.from as Role] ?? event.details.from} → ${ROLE_LABELS[event.details.to as Role] ?? event.details.to}` : ""}
              {event.action === "email" && event.details?.subject ? ` · “${String(event.details.subject)}”` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
