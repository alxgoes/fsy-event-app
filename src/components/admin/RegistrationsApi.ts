/**
 * Cliente do navegador para /api/admin/registrations/**. Tudo fica em memória:
 * nada de dados pessoais em localStorage, sessionStorage, cache ou analytics.
 * O servidor continua sendo a autoridade de permissão (userManagers).
 */
import type {
  CommitRegistrationImportRequest,
  CommitRegistrationImportResponse,
  DeleteRegistrationBatchResponse,
  RegistrationImportBatchSummary,
  RegistrationListFilterParams,
  RegistrationListResponse,
  RegistrationPreviewSummary,
  RegistrationRecord,
} from "@/types/registrations";
import type { AuthorizationPdfBatchRequest } from "@/types/authorizations";

const BASE = "/api/admin/registrations";

export type ApiFailureKind = "unauthenticated" | "forbidden" | "conflict" | "invalid" | "not_found" | "network" | "server";

export class RegistrationsApiError extends Error {
  readonly kind: ApiFailureKind;
  readonly status: number;
  readonly code?: string;

  constructor(kind: ApiFailureKind, status: number, message: string, code?: string) {
    super(message);
    this.name = "RegistrationsApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
  }
}

const FALLBACK: Record<ApiFailureKind, string> = {
  unauthenticated: "Sua sessão expirou. Entre novamente para continuar.",
  forbidden: "Seu cargo não permite acessar as inscrições.",
  conflict: "Os dados mudaram ou a pré-visualização expirou. Gere uma nova pré-visualização.",
  invalid: "A solicitação não pôde ser processada. Confira os dados e tente novamente.",
  not_found: "Item não encontrado. Ele pode ter sido excluído.",
  network: "Sem conexão com o servidor. Verifique a internet e tente novamente.",
  server: "O servidor não conseguiu concluir a operação. Tente novamente em instantes.",
};

function kindFor(status: number): ApiFailureKind {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status === 404) return "not_found";
  if (status >= 400 && status < 500) return "invalid";
  return "server";
}

async function failure(response: Response): Promise<RegistrationsApiError> {
  const kind = kindFor(response.status);
  let message = FALLBACK[kind];
  let code: string | undefined;
  try {
    const body = (await response.json()) as { error?: unknown; code?: unknown };
    if (typeof body.code === "string") code = body.code;
    // Mensagens de domínio vêm em pt-BR; 5xx só mostram texto próprio quando identificado (ex.: migração pendente).
    if (typeof body.error === "string" && body.error.trim() && (kind !== "server" || code === "REGISTRATIONS_NOT_MIGRATED")) message = body.error;
  } catch {
    /* corpo não-JSON: mantém a mensagem padrão */
  }
  return new RegistrationsApiError(kind, response.status, message, code);
}

async function send(input: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, signal, cache: "no-store", credentials: "same-origin" });
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") throw error;
    throw new RegistrationsApiError("network", 0, FALLBACK.network);
  }
  if (!response.ok) throw await failure(response);
  return response;
}

async function sendJson<T>(input: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await send(input, { ...init, headers: { Accept: "application/json", ...(init.headers ?? {}) } }, signal);
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || value === "all") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function listRegistrations(filters: RegistrationListFilterParams, signal?: AbortSignal) {
  return sendJson<RegistrationListResponse>(
    `${BASE}${query({
      batchId: filters.batchId,
      roleCategory: filters.roleCategory,
      status: filters.status,
      stakeName: filters.stakeName,
      wardName: filters.wardName,
      hasHealthAlert: filters.hasHealthAlert,
      hasIssues: filters.hasIssues,
      search: filters.search,
      page: filters.page,
      pageSize: filters.pageSize,
      // Lista sem documentos nem saúde; o detalhe privado vem de GET [id].
      projection: filters.projection ?? "minimal",
    })}`,
    {},
    signal
  );
}

export function getRegistration(id: string, signal?: AbortSignal) {
  return sendJson<RegistrationRecord>(`${BASE}/${encodeURIComponent(id)}`, {}, signal);
}

export function listBatches(signal?: AbortSignal) {
  return sendJson<{ currentRevision: number; activeBatchId: string | null; batches: RegistrationImportBatchSummary[] }>(
    `${BASE}/batches`,
    {},
    signal
  );
}

export function previewImport(file: File, signal?: AbortSignal) {
  const form = new FormData();
  form.append("file", file, file.name);
  return sendJson<RegistrationPreviewSummary>(`${BASE}/preview`, { method: "POST", body: form }, signal);
}

export function commitImport(request: CommitRegistrationImportRequest) {
  return sendJson<CommitRegistrationImportResponse>(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export function deleteBatch(batchId: string) {
  return sendJson<DeleteRegistrationBatchResponse>(`${BASE}/batches/${encodeURIComponent(batchId)}`, { method: "DELETE" });
}

/** Nome do arquivo do Content-Disposition, sanitizado para salvar localmente. */
function filenameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(header)?.[1];
  let name = fallback;
  try {
    name = star ? decodeURIComponent(star) : plain ?? fallback;
  } catch {
    name = plain ?? fallback;
  }
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").slice(0, 120) || fallback;
}

/** Salva um Blob sem passar por armazenamento persistente do navegador. */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export interface DownloadResult {
  filename: string;
  headers: Headers;
}

async function download(input: string, init: RequestInit, fallbackName: string, signal?: AbortSignal): Promise<DownloadResult> {
  const response = await send(input, init, signal);
  const blob = await response.blob();
  const filename = filenameFrom(response, fallbackName);
  saveBlob(blob, filename);
  return { filename, headers: response.headers };
}

export function downloadExportXlsx(params: {
  batchId?: string;
  roleCategory?: string;
  status?: string;
  stakeName?: string;
  wardName?: string;
  hasHealthAlert?: boolean;
  hasIssues?: boolean;
  search?: string;
  useNormalizedNames: boolean;
}) {
  return download(
    `${BASE}/export-xlsx${query({ ...params, useNormalizedNames: params.useNormalizedNames ? undefined : "false" })}`,
    {},
    "inscricoes-fsy-rp2-2027.xlsx"
  );
}

export function downloadAuthorizationPdf(id: string, useNormalizedNames: boolean) {
  return download(
    `${BASE}/${encodeURIComponent(id)}/authorization-pdf${query({ useNormalizedNames: useNormalizedNames ? undefined : "false" })}`,
    {},
    "ficha-autorizacao.pdf"
  );
}

export function downloadTemplatePdf() {
  return download(`${BASE}/template-pdf`, {}, "FICHA AUTORIZACAO.pdf");
}

export async function downloadAuthorizationZipPart(request: AuthorizationPdfBatchRequest, signal?: AbortSignal) {
  const result = await download(
    `${BASE}/authorization-pdf-batch`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) },
    "fichas-autorizacao-fsy-rp2-2027.zip",
    signal
  );
  const int = (name: string) => Number.parseInt(result.headers.get(name) ?? "", 10);
  return {
    filename: result.filename,
    partIndex: int("x-batch-part-index"),
    partCount: int("x-batch-part-count"),
    totalEligible: int("x-batch-total-eligible"),
    overflowWarnings: int("x-batch-overflow-warning-count"),
  };
}

/** Chave de idempotência nova para cada tentativa distinta (preview, modo, nomes). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export const USER_MANAGER_ROLES = ["coordenador", "casal_diretor", "logistica"] as const;
