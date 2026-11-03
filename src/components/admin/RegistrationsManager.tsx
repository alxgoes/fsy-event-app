"use client";

import React, { startTransition, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ClipboardList, FileDown, FileSpreadsheet, Loader2, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/lib/supabase/useProfile";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, ErrorState, OfflineBanner, PermissionState } from "@/components/ui/states";
import { PrivacyShield } from "@/components/privacy/PrivacyShield";
import type { RegistrationListResponse, RegistrationRecord, RegistrationRoleCategory } from "@/types/registrations";
import { downloadAuthorizationPdf, downloadExportXlsx, listRegistrations, RegistrationsApiError, USER_MANAGER_ROLES } from "./RegistrationsApi";
import { RegistrationsImport } from "./RegistrationsImport";
import { RegistrationsBatches } from "./RegistrationsBatches";
import { RegistrationsAuthorizations } from "./RegistrationsAuthorizations";
import { RegistrationsDetail } from "./RegistrationsDetail";
import { Metric, Notice, RecordFlags, StatusBadge, btn, displayName, isCancelledRegistration } from "./RegistrationsUi";

type Tab = "list" | "import" | "pdf" | "batches";
const TABS: { id: Tab; label: string }[] = [
  { id: "list", label: "Inscritos" },
  { id: "import", label: "Importar planilha" },
  { id: "pdf", label: "Autorizações" },
  { id: "batches", label: "Lotes" },
];

interface Filters {
  search: string;
  roleCategory: RegistrationRoleCategory | "all";
  status: string;
  stakeName: string;
  wardName: string;
  alert: "all" | "health" | "issues" | "clean";
  page: number;
  pageSize: number;
}

const INITIAL: Filters = { search: "", roleCategory: "all", status: "", stakeName: "", wardName: "", alert: "all", page: 1, pageSize: 50 };

export function RegistrationsManager() {
  const { profile, loading: profileLoading } = useProfile();
  const [tab, setTab] = useState<Tab>("list");
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [searchDraft, setSearchDraft] = useState("");
  const [data, setData] = useState<RegistrationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RegistrationsApiError | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<RegistrationRecord | null>(null);
  const [normalizedNames, setNormalizedNames] = useState(true);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const requestRef = useRef<AbortController | null>(null);

  const filtersActive = Boolean(filters.search || filters.roleCategory !== "all" || filters.status || filters.stakeName || filters.wardName || filters.alert !== "all");
  const allowed = !profile || (USER_MANAGER_ROLES as readonly string[]).includes(profile.role);

  const load = useCallback(async (next: Filters) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const response = await listRegistrations(
        {
          search: next.search || undefined,
          roleCategory: next.roleCategory,
          status: next.status || undefined,
          stakeName: next.stakeName || undefined,
          wardName: next.wardName || undefined,
          hasHealthAlert: next.alert === "health" ? true : undefined,
          hasIssues: next.alert === "issues" ? true : next.alert === "clean" ? false : undefined,
          page: next.page,
          pageSize: next.pageSize,
        },
        controller.signal
      );
      setData(response);
      setError(null);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof RegistrationsApiError ? err : new RegistrationsApiError("server", 0, "Não foi possível carregar as inscrições."));
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profileLoading || !allowed) return;
    startTransition(() => {
      void load(filters);
    });
  }, [filters, load, profileLoading, allowed]);

  useEffect(() => () => requestRef.current?.abort(), []);

  // Busca com atraso curto: não dispara uma requisição por tecla.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => (current.search === searchDraft.trim() ? current : { ...current, search: searchDraft.trim(), page: 1 }));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const update = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));

  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current.get(next)?.focus();
  };

  const toggleSelected = (id: string) => {
    if (selected.includes(id)) return setSelected(selected.filter((value) => value !== id));
    setSelected([...selected, id]);
  };

  const rowPdf = async (record: RegistrationRecord) => {
    setRowBusy(record.id);
    setNotice(null);
    try {
      const result = await downloadAuthorizationPdf(record.id, normalizedNames);
      const overflow = result.headers.get("x-authorization-overflow-warning") === "1";
      setNotice(
        overflow
          ? { tone: "warn", text: `${result.filename}: texto além do espaço em ${result.headers.get("x-authorization-overflow-fields") || "alguns campos"}. Confira a ficha.` }
          : { tone: "ok", text: `${result.filename} baixado.` }
      );
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof RegistrationsApiError ? err.message : "Não foi possível gerar a ficha." });
    } finally {
      setRowBusy(null);
    }
  };

  const exportXlsx = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const result = await downloadExportXlsx({
        roleCategory: filters.roleCategory,
        status: filters.status || undefined,
        stakeName: filters.stakeName || undefined,
        wardName: filters.wardName || undefined,
        hasHealthAlert: filters.alert === "health" ? true : undefined,
        hasIssues: filters.alert === "issues" ? true : filters.alert === "clean" ? false : undefined,
        search: filters.search || undefined,
        useNormalizedNames: normalizedNames,
      });
      setNotice({ tone: "ok", text: `${result.filename} baixado com as 3 abas e 34 colunas do modelo oficial${filtersActive ? ", só com o recorte filtrado" : ""}.` });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof RegistrationsApiError ? err.message : "Não foi possível exportar." });
    } finally {
      setExporting(false);
    }
  };

  const refreshAfterChange = () => {
    setSelected([]);
    void load(filters);
  };

  if (profileLoading) {
    return <p className="flex items-center gap-2 p-6 text-sm text-slate-700 dark:text-slate-300"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Verificando seu acesso…</p>;
  }
  if (!allowed || error?.kind === "forbidden") {
    return (
      <PermissionState
        headingLevel="h1"
        title="Inscrições restritas à coordenação"
        description="Somente coordenação, Casal Diretor e logística gerenciam inscrições e autorizações. Peça a revisão do seu cargo se precisar deste acesso."
      />
    );
  }

  const metrics = data?.metrics ?? null;
  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const noData = !!data && data.metrics.totalCount === 0 && data.batches.length === 0;

  return (
    <PrivacyShield label="Dados das inscrições">
      <div className="space-y-5 text-slate-900 dark:text-slate-100">
        <header className="fsy-panel rounded-3xl bg-white p-5 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#007DA5] text-white dark:bg-[#01B6D1] dark:text-slate-950">
                <ClipboardList className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h1 className="font-heading text-2xl font-bold text-slate-900 dark:text-white">Inscrições e autorizações</h1>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {data?.activeBatch
                    ? <>Lote ativo: <span className="font-semibold">{data.activeBatch.filename}</span> · revisão <span className="fsy-figure">{data.currentRevision}</span></>
                    : "Lista isolada da planilha oficial. Não altera contas, fichas médicas nem companhias."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2"><button type="button" className={btn.primary} onClick={() => setTab("pdf")}><FileDown className="h-4 w-4" aria-hidden="true" /> Baixar autorizações</button><button type="button" className={btn.secondary} onClick={() => void load(filters)} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" /> Atualizar
            </button></div>
          </div>
          {metrics && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Metric label="Inscritos" value={metrics.totalCount} />
              <Metric label="Participantes" value={metrics.participantCount} />
              <Metric label="Consultores" value={metrics.counselorCount} />
              <Metric label="Com saúde" value={metrics.healthAlertCount} tone={metrics.healthAlertCount ? "danger" : "neutral"} />
              <Metric label="Menores sem responsável" value={metrics.missingGuardianMinorCount} tone={metrics.missingGuardianMinorCount ? "warning" : "neutral"} />
              <Metric label="Documento a conferir" value={metrics.documentWarningCount} tone={metrics.documentWarningCount ? "warning" : "neutral"} />
            </div>
          )}
        </header>

        <OfflineBanner />

        <div role="tablist" aria-label="Seções de inscrições" className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800 sm:flex">
          {TABS.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                if (el) tabRefs.current.set(item.id, el);
              }}
              type="button"
              role="tab"
              id={`reg-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`reg-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => onTabKey(event, index)}
              className={cn(
                "min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors",
                tab === item.id ? "bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

        <div role="tabpanel" id={`reg-panel-${tab}`} aria-labelledby={`reg-tab-${tab}`} className="fsy-fade-in">
          {tab === "import" && (
            <RegistrationsImport
              onCommitted={() => {
                refreshAfterChange();
              }}
            />
          )}

          {tab === "batches" && (
            <RegistrationsBatches batches={data?.batches ?? []} onDeleted={refreshAfterChange} />
          )}

          {tab === "pdf" && (
            <RegistrationsAuthorizations
              metrics={metrics}
              selectedIds={selected}
              onClearSelection={() => setSelected([])}
            />
          )}

          {tab === "list" && (
            <div className="space-y-4">
              {error ? (
                <ErrorState
                  title={error.kind === "unauthenticated" ? "Sessão expirada" : "Não foi possível carregar as inscrições"}
                  description={error.message}
                  actions={
                    error.kind === "unauthenticated" ? (
                      <Link href="/login" className={cn("fsy-action-link", btn.primary)}>Entrar novamente</Link>
                    ) : (
                      <button type="button" className={btn.primary} onClick={() => void load(filters)}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Tentar novamente
                      </button>
                    )
                  }
                />
              ) : noData ? (
                <EmptyState
                  icon={FileSpreadsheet}
                  title="Nenhuma inscrição importada"
                  description="Importe a planilha oficial do Excel para ver os inscritos, conferir alertas e gerar as fichas de autorização."
                  actions={<button type="button" className={btn.primary} onClick={() => setTab("import")}>Importar planilha</button>}
                />
              ) : (
                <>
                  <section aria-label="Filtros" className="fsy-panel rounded-3xl bg-white p-4 dark:bg-slate-900">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className="text-sm font-semibold sm:col-span-2 lg:col-span-3">
                        <span className="flex items-center gap-1.5"><Search className="h-4 w-4" aria-hidden="true" /> Buscar</span>
                        <Input
                          type="search"
                          value={searchDraft}
                          onChange={(event) => setSearchDraft(event.target.value)}
                          placeholder="Nome, e-mail, CPF, RG, estaca ou responsável"
                          className="mt-1 min-h-11"
                          autoComplete="off"
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        Tipo
                        <NativeSelect value={filters.roleCategory} onChange={(event) => update({ roleCategory: event.target.value as Filters["roleCategory"] })} className="mt-1">
                          <option value="all">Todos</option>
                          <option value="Participante">Participantes</option>
                          <option value="Consultor">Consultores</option>
                        </NativeSelect>
                      </label>
                      <label className="text-sm font-semibold">
                        Estaca/distrito
                        <NativeSelect value={filters.stakeName} onChange={(event) => update({ stakeName: event.target.value, wardName: "" })} className="mt-1">
                          <option value="">Todas</option>
                          {metrics?.stakes.map((stake) => <option key={stake} value={stake}>{stake}</option>)}
                        </NativeSelect>
                      </label>
                      <label className="text-sm font-semibold">
                        Situação
                        <NativeSelect value={filters.status} onChange={(event) => update({ status: event.target.value })} className="mt-1">
                          <option value="">Todas</option>
                          {metrics?.statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </NativeSelect>
                      </label>
                    </div>
                    <details className="mt-4 border-t border-slate-200 pt-1 dark:border-slate-700"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Mais opções e exportação</summary><div className="flex flex-wrap items-center gap-3 pb-3">
                      <label className="text-sm font-semibold">Alertas<NativeSelect value={filters.alert} onChange={(event) => update({ alert: event.target.value as Filters["alert"] })} className="mt-1 min-h-11"><option value="all">Todos</option><option value="health">Com informação de saúde</option><option value="issues">Com avisos</option><option value="clean">Sem avisos</option></NativeSelect></label>
                      <label className="text-sm font-semibold">Ala ou ramo<NativeSelect value={filters.wardName} onChange={(event) => update({ wardName: event.target.value })} className="mt-1 min-h-11"><option value="">Todas</option>{metrics?.wards.map((ward) => <option key={ward} value={ward}>{ward}</option>)}</NativeSelect></label>
                      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-[#007DA5]" checked={normalizedNames} onChange={(event) => setNormalizedNames(event.target.checked)} /> Mostrar nomes revisados</label>
                      <button type="button" className={btn.secondary} onClick={() => void exportXlsx()} disabled={exporting}>
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
                        Exportar Excel
                      </button>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {filtersActive ? "A exportação usa os filtros aplicados." : "A exportação inclui todas as inscrições atuais."}
                      </p>
                    </div></details>
                    {filtersActive && <button type="button" className={btn.ghost} onClick={() => { setSearchDraft(""); setFilters(INITIAL); }}>Limpar filtros</button>}
                  </section>

                  <section aria-label="Lista de inscritos" aria-busy={loading} className="fsy-panel overflow-hidden rounded-3xl bg-white dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
                      <p aria-live="polite">
                        {loading && !data ? "Carregando…" : <><span className="fsy-figure font-semibold">{pagination?.totalFiltered ?? 0}</span> resultado(s){filtersActive ? " com os filtros" : ""}</>}
                      </p>
                      <button type="button" className={btn.ghost} disabled={loading || !items.some((item) => !isCancelledRegistration(item))} onClick={() => setSelected((current) => [...new Set([...current, ...items.filter((item) => !isCancelledRegistration(item)).map((item) => item.id)])])}>Selecionar página</button>
                      {selected.length > 0 && (
                        <p className="text-sm">
                          <span className="font-semibold">{selected.length}</span> selecionada(s) ·{" "}
                          <button type="button" className={btn.ghost} onClick={() => setTab("pdf")}>
                            Baixar autorizações
                          </button>
                        </p>
                      )}
                    </div>

                    {loading && !data ? (
                      <div className="space-y-2 p-4" aria-hidden="true">
                        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
                      </div>
                    ) : items.length === 0 ? (
                      <div className="p-6 text-center text-sm text-slate-700 dark:text-slate-300">
                        Nenhuma inscrição corresponde aos filtros.{" "}
                        <button type="button" className={btn.ghost} onClick={() => { setSearchDraft(""); setFilters(INITIAL); }}>Limpar filtros</button>
                      </div>
                    ) : (
                      <>
                        {/* Desktop: tabela */}
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full text-left text-sm">
                            <caption className="sr-only">Inscrições, página {pagination?.page} de {pagination?.totalPages}</caption>
                            <thead className="bg-slate-50 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <tr>
                                <th scope="col" className="w-12 px-1 py-1"><label className="flex h-11 w-11 cursor-pointer items-center justify-center"><input type="checkbox" className="h-5 w-5 accent-[#007DA5]" aria-label="Selecionar todos os inscritos desta página, exceto cancelados" checked={items.some((item) => !isCancelledRegistration(item)) && items.filter((item) => !isCancelledRegistration(item)).every((item) => selected.includes(item.id))} onChange={(event) => { const ids = items.filter((item) => !isCancelledRegistration(item)).map((item) => item.id); setSelected((current) => event.target.checked ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))); }} /></label></th>
                                <th scope="col" className="px-3 py-2 font-semibold">Nome</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Tipo</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Estaca · ala</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Situação</th>
                                <th scope="col" className="px-3 py-2 font-semibold">Alertas</th>
                                <th scope="col" className="px-3 py-2 text-right font-semibold">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                              {items.map((record) => {
                                const name = displayName(record, normalizedNames);
                                return (
                                  <tr key={record.id} className={cn(selected.includes(record.id) && "bg-[#F2F9FC] dark:bg-[#0C2733]")}>
                                    <td className="px-1 py-1">
                                      <label className="flex h-11 w-11 cursor-pointer items-center justify-center">
                                        <input type="checkbox" className="h-5 w-5 accent-[#007DA5]" checked={selected.includes(record.id)} disabled={isCancelledRegistration(record)} onChange={() => toggleSelected(record.id)} aria-label={`Selecionar ${name}`} />
                                      </label>
                                    </td>
                                    <td className="px-3 py-2">
                                      <span className="font-semibold text-slate-900 dark:text-white">{name}</span>
                                      {record.wasNameNormalized && (
                                        <span className="block text-xs text-slate-600 dark:text-slate-400">planilha: {normalizedNames ? record.fullNameRaw : record.fullNameNormalized}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2">{record.roleCategory}</td>
                                    <td className="px-3 py-2">{[record.stakeName, record.wardName].filter(Boolean).join(" · ") || "—"}</td>
                                    <td className="px-3 py-2"><StatusBadge status={record.status} /></td>
                                    <td className="px-3 py-2"><RecordFlags record={record} compact /></td>
                                    <td className="px-3 py-2">
                                      <div className="flex justify-end gap-1">
                                        <button type="button" className={btn.ghost} onClick={() => setDetail(record)} aria-label={`Ver detalhes de ${name}`}>Detalhes</button>
                                        <button type="button" className={btn.ghost} onClick={() => void rowPdf(record)} disabled={rowBusy === record.id || isCancelledRegistration(record)} aria-label={`Baixar ficha de autorização de ${name}`}>
                                          {rowBusy === record.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
                                          Ficha
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Celular: lista de cartões, sem dados sensíveis */}
                        <ul className="divide-y divide-slate-200 md:hidden dark:divide-slate-700">
                          {items.map((record) => {
                            const name = displayName(record, normalizedNames);
                            return (
                              <li key={record.id} className={cn("space-y-2 p-4", selected.includes(record.id) && "bg-[#F2F9FC] dark:bg-[#0C2733]")}>
                                <div className="flex items-start gap-3">
                                  <label className="-m-3 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                                    <input type="checkbox" className="h-5 w-5 accent-[#007DA5]" checked={selected.includes(record.id)} disabled={isCancelledRegistration(record)} onChange={() => toggleSelected(record.id)} aria-label={`Selecionar ${name}`} />
                                  </label>
                                  <div className="min-w-0">
                                    <p className="break-words font-semibold text-slate-900 dark:text-white">{name}</p>
                                    <p className="text-xs text-slate-700 dark:text-slate-300">
                                      {record.roleCategory} · <StatusBadge status={record.status} />
                                      {record.stakeName ? ` · ${record.stakeName}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <RecordFlags record={record} />
                                <div className="flex gap-2">
                                  <button type="button" className={cn(btn.secondary, "flex-1")} onClick={() => setDetail(record)}>Detalhes</button>
                                  <button type="button" className={cn(btn.secondary, "flex-1")} onClick={() => void rowPdf(record)} disabled={rowBusy === record.id || isCancelledRegistration(record)} aria-label={`Baixar ficha de autorização de ${name}`}>
                                    {rowBusy === record.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileDown className="h-4 w-4" aria-hidden="true" />}
                                    Ficha
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        {pagination && (
                          <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                            <label className="flex items-center gap-2 text-sm">
                              Por página
                              <NativeSelect value={String(filters.pageSize)} onChange={(event) => update({ pageSize: Number(event.target.value) })} className="w-24">
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                              </NativeSelect>
                            </label>
                            <div className="flex items-center gap-2">
                              <button type="button" className={btn.secondary} disabled={pagination.page <= 1 || loading} onClick={() => update({ page: pagination.page - 1 })} aria-label="Página anterior">
                                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <span className="fsy-figure text-sm">Página {pagination.page} de {pagination.totalPages}</span>
                              <button type="button" className={btn.secondary} disabled={pagination.page >= pagination.totalPages || loading} onClick={() => update({ page: pagination.page + 1 })} aria-label="Próxima página">
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </nav>
                        )}
                      </>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>

        <RegistrationsDetail record={detail} useNormalizedNames={normalizedNames} onClose={() => setDetail(null)} onChanged={() => void load(filters)} />
      </div>
    </PrivacyShield>
  );
}
