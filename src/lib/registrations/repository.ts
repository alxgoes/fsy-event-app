import { createAdminClient } from "@/lib/supabase/admin";
import { isApprovedRegistration, isCancelledRegistration } from "./authorization-adjustments";
import type {
  CommitRegistrationImportResponse,
  DeleteRegistrationBatchResponse,
  RegistrationImportBatchSummary,
  RegistrationImportMode,
  RegistrationListFilterParams,
  RegistrationListItem,
  RegistrationListMetrics,
  RegistrationListResponse,
  RegistrationPreviewSummary,
  RegistrationRawColumns,
  RegistrationRecord,
  PatchRegistrationRequest,
  RegistrationAuthorizationAdjustments,
} from "@/types/registrations";

const MAX_ACTIVE_PREVIEWS_PER_ACTOR = 3;

export class RegistrationDomainError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code = "REGISTRATION_ERROR") {
    super(message);
    this.name = "RegistrationDomainError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * M2: Identifica exclusivamente ausência de tabela ainda não migrada (`42P01` / `PGRST205`),
 * respondendo 503 `REGISTRATIONS_NOT_MIGRATED`. Erros de coluna (`42703`) ou falhas de banco
 * NUNCA são mascarados como lista vazia.
 */
function throwIfRegistrationsNotMigrated(
  error: { code?: string; message?: string } | null | undefined
): never {
  if (!error) {
    throw new Error("Erro desconhecido no repositório de inscrições.");
  }
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  const isMissingRegistrationTable =
    code === "42P01" ||
    code === "PGRST205" ||
    /could not find the table 'public\.(registration_|event_registrations)/.test(msg) ||
    /relation "public\.(registration_|event_registrations)[^"]*" does not exist/.test(msg);

  if (isMissingRegistrationTable) {
    throw new RegistrationDomainError(
      "O módulo de inscrições ainda não foi migrado no banco de dados.",
      503,
      "REGISTRATIONS_NOT_MIGRATED"
    );
  }
  throw error;
}

function mapBatchRow(
  row: Record<string, unknown>,
  activeBatchId: string | null
): RegistrationImportBatchSummary {
  const id = String(row.id);
  return {
    id,
    revision: Number(row.revision ?? 0),
    filename: String(row.filename ?? ""),
    fileSha256: String(row.file_sha256 ?? ""),
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    importMode: (row.import_mode === "replace_all" ? "replace_all" : "upsert") as RegistrationImportMode,
    useNormalizedNames: Boolean(row.use_normalized_names ?? true),
    totalCount: Number(row.total_count ?? 0),
    participantCount: Number(row.participant_count ?? 0),
    counselorCount: Number(row.counselor_count ?? 0),
    warningCount: Number(row.warning_count ?? 0),
    importedByUserId: row.imported_by_user_id ? String(row.imported_by_user_id) : null,
    importedByName: row.imported_by_name ? String(row.imported_by_name) : null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    isActiveBatch: activeBatchId === id,
  };
}

function mapRegistrationRow(row: Record<string, unknown>): RegistrationRecord {
  const payload = (row.record_payload ?? {}) as Partial<RegistrationRecord>;
  const relation = row.authorization_adjustments as Record<string, unknown> | null | undefined;
  const values = (relation?.values_json ?? {}) as RegistrationAuthorizationAdjustments["values"];
  const hasAuthorizationAdjustments = Object.keys(values).length > 0;
  return {
    ...(payload as RegistrationRecord),
    hasAuthorizationAdjustments,
    authorizationAdjustments: hasAuthorizationAdjustments ? {
      values,
      editedByUserId: String(relation?.edited_by_user_id ?? ""),
      editedByName: String(relation?.edited_by_name ?? ""),
      editedAt: String(relation?.edited_at ?? ""),
    } : null,
    id: String(row.id ?? payload.id ?? ""),
    batchId: row.batch_id ? String(row.batch_id) : payload.batchId ?? null,
    dedupKey: String(row.dedup_key ?? payload.dedupKey ?? ""),
    roleCategory:
      row.role_category === "Consultor" || payload.roleCategory === "Consultor"
        ? "Consultor"
        : "Participante",
    status: String(row.status ?? payload.status ?? "Confirmado"),
    firstNameRaw: String(row.first_name_raw ?? payload.firstNameRaw ?? ""),
    lastNameRaw: String(row.last_name_raw ?? payload.lastNameRaw ?? ""),
    preferredNameRaw:
      row.preferred_name_raw !== undefined
        ? (row.preferred_name_raw as string | null)
        : payload.preferredNameRaw ?? null,
    fullNameRaw: String(row.full_name_raw ?? payload.fullNameRaw ?? ""),
    firstNameNormalized: String(
      row.first_name_normalized ?? payload.firstNameNormalized ?? ""
    ),
    lastNameNormalized: String(row.last_name_normalized ?? payload.lastNameNormalized ?? ""),
    preferredNameNormalized:
      row.preferred_name_normalized !== undefined
        ? (row.preferred_name_normalized as string | null)
        : payload.preferredNameNormalized ?? null,
    fullNameNormalized: String(row.full_name_normalized ?? payload.fullNameNormalized ?? ""),
    guardianNameRaw:
      row.guardian_name_raw !== undefined
        ? (row.guardian_name_raw as string | null)
        : payload.guardianNameRaw ?? null,
    guardianNameNormalized:
      row.guardian_name_normalized !== undefined
        ? (row.guardian_name_normalized as string | null)
        : payload.guardianNameNormalized ?? null,
    guardianPhoneRaw:
      row.guardian_phone_raw !== undefined
        ? (row.guardian_phone_raw as string | null)
        : payload.guardianPhoneRaw ?? null,
    birthDateRaw:
      row.birth_date_raw !== undefined
        ? (row.birth_date_raw as string | null)
        : payload.birthDateRaw ?? null,
    birthDateIso:
      row.birth_date_iso !== undefined
        ? (row.birth_date_iso as string | null)
        : payload.birthDateIso ?? null,
    ageAtRegistration:
      typeof row.age_at_registration === "number"
        ? row.age_at_registration
        : payload.ageAtRegistration ?? null,
    sex: row.sex !== undefined ? (row.sex as string | null) : payload.sex ?? null,
    phoneRaw:
      row.phone_raw !== undefined ? (row.phone_raw as string | null) : payload.phoneRaw ?? null,
    email: row.email !== undefined ? (row.email as string | null) : payload.email ?? null,
    tshirtSize:
      row.tshirt_size !== undefined
        ? (row.tshirt_size as string | null)
        : payload.tshirtSize ?? null,
    stakeName:
      row.stake_name !== undefined
        ? (row.stake_name as string | null)
        : payload.stakeName ?? null,
    wardName:
      row.ward_name !== undefined ? (row.ward_name as string | null) : payload.wardName ?? null,
    bishopNameRaw:
      row.bishop_name_raw !== undefined
        ? (row.bishop_name_raw as string | null)
        : payload.bishopNameRaw ?? null,
    bishopNameNormalized:
      row.bishop_name_normalized !== undefined
        ? (row.bishop_name_normalized as string | null)
        : payload.bishopNameNormalized ?? null,
    bishopEmail:
      row.bishop_email !== undefined
        ? (row.bishop_email as string | null)
        : payload.bishopEmail ?? null,
    documentRgOrPassportRaw:
      row.document_rg_or_passport_raw !== undefined
        ? (row.document_rg_or_passport_raw as string | null)
        : payload.documentRgOrPassportRaw ?? null,
    issuingAgencyRaw:
      row.issuing_agency_raw !== undefined
        ? (row.issuing_agency_raw as string | null)
        : payload.issuingAgencyRaw ?? null,
    cpfRaw: row.cpf_raw !== undefined ? (row.cpf_raw as string | null) : payload.cpfRaw ?? null,
    cpfDigitsOnly:
      row.cpf_digits_only !== undefined
        ? (row.cpf_digits_only as string | null)
        : payload.cpfDigitsOnly ?? null,
    parentAuthorizationAckRaw:
      row.parent_authorization_ack_raw !== undefined
        ? (row.parent_authorization_ack_raw as string | null)
        : payload.parentAuthorizationAckRaw ?? null,
    contact1NameRaw:
      row.contact1_name_raw !== undefined
        ? (row.contact1_name_raw as string | null)
        : payload.contact1NameRaw ?? null,
    contact1NameNormalized:
      row.contact1_name_normalized !== undefined
        ? (row.contact1_name_normalized as string | null)
        : payload.contact1NameNormalized ?? null,
    contact1Email:
      row.contact1_email !== undefined
        ? (row.contact1_email as string | null)
        : payload.contact1Email ?? null,
    contact1PhoneRaw:
      row.contact1_phone_raw !== undefined
        ? (row.contact1_phone_raw as string | null)
        : payload.contact1PhoneRaw ?? null,
    contact2NameRaw:
      row.contact2_name_raw !== undefined
        ? (row.contact2_name_raw as string | null)
        : payload.contact2NameRaw ?? null,
    contact2NameNormalized:
      row.contact2_name_normalized !== undefined
        ? (row.contact2_name_normalized as string | null)
        : payload.contact2NameNormalized ?? null,
    contact2Email:
      row.contact2_email !== undefined
        ? (row.contact2_email as string | null)
        : payload.contact2Email ?? null,
    contact2PhoneRaw:
      row.contact2_phone_raw !== undefined
        ? (row.contact2_phone_raw as string | null)
        : payload.contact2PhoneRaw ?? null,
    isChurchMemberRaw:
      row.is_church_member_raw !== undefined
        ? (row.is_church_member_raw as string | null)
        : payload.isChurchMemberRaw ?? null,
    talentShowPresentationRaw:
      row.talent_show_presentation_raw !== undefined
        ? (row.talent_show_presentation_raw as string | null)
        : payload.talentShowPresentationRaw ?? null,
    medicalInfoRaw:
      row.medical_info_raw !== undefined
        ? (row.medical_info_raw as string | null)
        : payload.medicalInfoRaw ?? null,
    dietaryInfoRaw:
      row.dietary_info_raw !== undefined
        ? (row.dietary_info_raw as string | null)
        : payload.dietaryInfoRaw ?? null,
    healthConditionsSummaryRaw:
      row.health_conditions_summary_raw !== undefined
        ? (row.health_conditions_summary_raw as string | null)
        : payload.healthConditionsSummaryRaw ?? null,
    healthConditionsDetailsRaw:
      row.health_conditions_details_raw !== undefined
        ? (row.health_conditions_details_raw as string | null)
        : payload.healthConditionsDetailsRaw ?? null,
    registrationDateRaw:
      row.registration_date_raw !== undefined
        ? (row.registration_date_raw as string | null)
        : payload.registrationDateRaw ?? null,
    wasNameNormalized: Boolean(row.was_name_normalized ?? payload.wasNameNormalized ?? false),
    hasHealthAlert: Boolean(row.has_health_alert ?? payload.hasHealthAlert ?? false),
    hasMissingGuardianForMinor: Boolean(
      row.has_missing_guardian_for_minor ?? payload.hasMissingGuardianForMinor ?? false
    ),
    hasDocumentWarning: Boolean(
      row.has_document_warning ?? payload.hasDocumentWarning ?? false
    ),
    sourceSheets: Array.isArray(row.source_sheets)
      ? (row.source_sheets as RegistrationRecord["sourceSheets"])
      : payload.sourceSheets ?? [],
    sourceRowNumbers:
      row.source_row_numbers && typeof row.source_row_numbers === "object"
        ? (row.source_row_numbers as RegistrationRecord["sourceRowNumbers"])
        : payload.sourceRowNumbers ?? {},
    issues: Array.isArray(row.issues)
      ? (row.issues as RegistrationRecord["issues"])
      : payload.issues ?? [],
    rawColumns:
      row.raw_columns && typeof row.raw_columns === "object"
        ? (row.raw_columns as RegistrationRecord["rawColumns"])
        : (payload.rawColumns as RegistrationRecord["rawColumns"]),
    createdAt: String(row.created_at ?? payload.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? payload.updatedAt ?? new Date().toISOString()),
  };
}

/**
 * B1: Projeta um registro para a listagem conforme o nível solicitado:
 * - `minimal`: omite todos os campos de documentos, contatos secundários e saúde (`GET [id]` entrega o detalhe privado).
 * - `default`: remove o mapa duplicado `rawColumns` de 34 chaves na listagem paginada.
 * - `full`: mantém o registro completo.
 */
export function projectRegistrationListItem(
  record: RegistrationRecord,
  projection: "default" | "minimal" | "full" = "default"
): RegistrationListItem {
  if (projection === "full") {
    return record;
  }
  if (projection === "minimal") {
    return {
      ...record,
      authorizationAdjustments: null,
      phoneRaw: null,
      email: null,
      guardianNameRaw: null,
      guardianNameNormalized: null,
      guardianPhoneRaw: null,
      bishopNameRaw: null,
      bishopNameNormalized: null,
      bishopEmail: null,
      documentRgOrPassportRaw: null,
      issuingAgencyRaw: null,
      cpfRaw: null,
      cpfDigitsOnly: null,
      contact1NameRaw: null,
      contact1NameNormalized: null,
      contact1Email: null,
      contact1PhoneRaw: null,
      contact2NameRaw: null,
      contact2NameNormalized: null,
      contact2Email: null,
      contact2PhoneRaw: null,
      medicalInfoRaw: null,
      dietaryInfoRaw: null,
      healthConditionsSummaryRaw: null,
      healthConditionsDetailsRaw: null,
      rawColumns: {} as RegistrationRawColumns,
    };
  }
  return {
    ...record,
    rawColumns: {} as RegistrationRawColumns,
  };
}

export async function getRegistrationStateMeta(): Promise<{
  currentRevision: number;
  activeBatchId: string | null;
}> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("registration_state_meta")
    .select("current_revision, active_batch_id")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throwIfRegistrationsNotMigrated(error);
  }

  return {
    currentRevision: Number(data?.current_revision ?? 0),
    activeBatchId: data?.active_batch_id ? String(data.active_batch_id) : null,
  };
}

export async function listRegistrationBatches(): Promise<{
  currentRevision: number;
  activeBatchId: string | null;
  batches: RegistrationImportBatchSummary[];
}> {
  const meta = await getRegistrationStateMeta();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("registration_import_batches")
    .select("*")
    .order("revision", { ascending: false });

  if (error) {
    throwIfRegistrationsNotMigrated(error);
  }

  const batches = (data ?? []).map((row) =>
    mapBatchRow(row as Record<string, unknown>, meta.activeBatchId)
  );
  return { ...meta, batches };
}

export async function listAllActiveRegistrations(
  batchId?: string
): Promise<RegistrationRecord[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("event_registrations")
    .select("*, authorization_adjustments:registration_authorization_adjustments(*)")
    .order("full_name_normalized", { ascending: true });

  if (batchId) {
    query = query.eq("batch_id", batchId);
  }

  const { data, error } = await query;
  if (error) {
    throwIfRegistrationsNotMigrated(error);
  }
  return (data ?? []).map((r) => mapRegistrationRow(r as Record<string, unknown>));
}

export function filterRegistrationRecords(
  records: readonly RegistrationRecord[],
  filters: RegistrationListFilterParams
): RegistrationRecord[] {
  const search = (filters.search ?? "").trim().toLocaleLowerCase("pt-BR");
  return records.filter((rec) => {
    if (
      filters.roleCategory &&
      filters.roleCategory !== "all" &&
      rec.roleCategory !== filters.roleCategory
    ) {
      return false;
    }
    if (
      filters.status &&
      filters.status !== "all" &&
      rec.status.toLocaleLowerCase("pt-BR") !== filters.status.toLocaleLowerCase("pt-BR")
    ) {
      return false;
    }
    if (
      filters.stakeName &&
      filters.stakeName !== "all" &&
      (rec.stakeName ?? "") !== filters.stakeName
    ) {
      return false;
    }
    if (
      filters.wardName &&
      filters.wardName !== "all" &&
      (rec.wardName ?? "") !== filters.wardName
    ) {
      return false;
    }
    if (filters.hasHealthAlert !== undefined && rec.hasHealthAlert !== filters.hasHealthAlert) {
      return false;
    }
    if (filters.hasIssues !== undefined) {
      const recHasIssues = rec.issues.length > 0;
      if (recHasIssues !== filters.hasIssues) {
        return false;
      }
    }
    if (search) {
      const haystack = [
        rec.fullNameNormalized,
        rec.fullNameRaw,
        rec.preferredNameNormalized ?? "",
        rec.email ?? "",
        rec.cpfRaw ?? "",
        rec.cpfDigitsOnly ?? "",
        rec.documentRgOrPassportRaw ?? "",
        rec.stakeName ?? "",
        rec.wardName ?? "",
        rec.guardianNameNormalized ?? "",
        rec.guardianPhoneRaw ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      if (!haystack.includes(search)) {
        return false;
      }
    }
    return true;
  });
}

export function computeRegistrationMetrics(
  records: readonly RegistrationRecord[]
): RegistrationListMetrics {
  const stakesSet = new Set<string>();
  const wardsSet = new Set<string>();
  const statusesSet = new Set<string>();

  let participantCount = 0;
  let counselorCount = 0;
  let confirmedCount = 0;
  let healthAlertCount = 0;
  let missingGuardianMinorCount = 0;
  let documentWarningCount = 0;

  for (const r of records) {
    if (!isCancelledRegistration(r)) {
      if (r.roleCategory === "Participante") participantCount++;
      else counselorCount++;
    }

    if (isApprovedRegistration(r)) {
      confirmedCount++;
    }
    if (r.hasHealthAlert) healthAlertCount++;
    if (r.hasMissingGuardianForMinor) missingGuardianMinorCount++;
    if (r.hasDocumentWarning) documentWarningCount++;
    if (r.stakeName) stakesSet.add(r.stakeName);
    if (r.wardName) wardsSet.add(r.wardName);
    if (r.status) statusesSet.add(r.status);
  }

  return {
    totalCount: records.length,
    participantCount,
    counselorCount,
    confirmedCount,
    healthAlertCount,
    missingGuardianMinorCount,
    documentWarningCount,
    stakes: Array.from(stakesSet).sort((a, b) => a.localeCompare(b, "pt-BR")),
    wards: Array.from(wardsSet).sort((a, b) => a.localeCompare(b, "pt-BR")),
    statuses: Array.from(statusesSet).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}

export async function queryRegistrationsList(
  filters: RegistrationListFilterParams
): Promise<RegistrationListResponse> {
  const { currentRevision, activeBatchId, batches } = await listRegistrationBatches();
  const activeBatch = batches.find((b) => b.id === activeBatchId) ?? null;
  const allRecords = await listAllActiveRegistrations(filters.batchId);
  const metrics = computeRegistrationMetrics(allRecords);
  const filtered = filterRegistrationRecords(allRecords, filters);

  const pageSize = Math.min(250, Math.max(1, filters.pageSize ?? 50));
  const totalFiltered = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const page = Math.min(totalPages, Math.max(1, filters.page ?? 1));
  const start = (page - 1) * pageSize;
  const projectionMode = filters.projection ?? "default";
  const items = filtered
    .slice(start, start + pageSize)
    .map((r) => projectRegistrationListItem(r, projectionMode));

  return {
    currentRevision,
    activeBatch,
    batches,
    metrics,
    items,
    pagination: {
      page,
      pageSize,
      totalFiltered,
      totalPages,
    },
  };
}

export async function getRegistrationById(id: string): Promise<RegistrationRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_registrations")
    .select("*, authorization_adjustments:registration_authorization_adjustments(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throwIfRegistrationsNotMigrated(error);
  }
  if (!data) return null;
  return mapRegistrationRow(data as Record<string, unknown>);
}

export async function getRegistrationsByIds(
  ids: readonly string[]
): Promise<RegistrationRecord[]> {
  if (ids.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_registrations")
    .select("*, authorization_adjustments:registration_authorization_adjustments(*)")
    .in("id", [...ids]);

  if (error) {
    throwIfRegistrationsNotMigrated(error);
  }
  return (data ?? []).map((r) => mapRegistrationRow(r as Record<string, unknown>));
}

export async function patchRegistrationAuthorization(
  id: string, actorId: string, request: PatchRegistrationRequest
): Promise<RegistrationRecord> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("admin_patch_registration_authorization", {
    p_registration_id: id,
    p_actor_id: actorId,
    p_adjustments: "adjustments" in request ? request.adjustments : {},
    p_reset: "resetAdjustments" in request,
  });
  if (error) mapRpcError(error);
  const record = await getRegistrationById(id);
  if (!record) throw new RegistrationDomainError("Inscrição não encontrada.", 404, "NOT_FOUND");
  return record;
}

export async function saveRegistrationImportPreview(params: {
  summary: RegistrationPreviewSummary;
  canonicalRows: readonly RegistrationRecord[];
}): Promise<void> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // M1: Remove previews expirados não confirmados antes de gravar um novo
  await supabase
    .from("registration_import_previews")
    .delete()
    .is("committed_batch_id", null)
    .lt("expires_at", nowIso);

  // M1: Limita previews ativos não confirmados por administrador (mantém os mais recentes)
  const { data: activeActorPreviews } = await supabase
    .from("registration_import_previews")
    .select("id, created_at")
    .eq("created_by_user_id", params.summary.createdByUserId)
    .is("committed_batch_id", null)
    .order("created_at", { ascending: false });

  if (
    Array.isArray(activeActorPreviews) &&
    activeActorPreviews.length >= MAX_ACTIVE_PREVIEWS_PER_ACTOR
  ) {
    const staleIds = activeActorPreviews
      .slice(MAX_ACTIVE_PREVIEWS_PER_ACTOR - 1)
      .map((p) => String((p as { id: unknown }).id));
    if (staleIds.length > 0) {
      await supabase
        .from("registration_import_previews")
        .delete()
        .in("id", staleIds);
    }
  }

  const { error } = await supabase.from("registration_import_previews").insert({
    id: params.summary.previewId,
    created_by_user_id: params.summary.createdByUserId,
    base_revision: params.summary.baseRevision,
    filename: params.summary.filename,
    file_sha256: params.summary.fileSha256,
    file_size_bytes: params.summary.fileSizeBytes,
    can_commit: params.summary.canCommit,
    summary_json: params.summary,
    rows_json: params.canonicalRows,
    expires_at: params.summary.expiresAt,
  });

  if (error) {
    throwIfRegistrationsNotMigrated(error);
  }
}

function mapRpcError(error: { code?: string; message?: string }): never {
  const code = error.code ?? "";
  const msg = error.message ?? "Não foi possível concluir a operação nas inscrições.";
  if (code === "40001") {
    if (msg.toLowerCase().includes("idempotência")) {
      throw new RegistrationDomainError(msg, 409, "IDEMPOTENCY_KEY_REUSED");
    }
    throw new RegistrationDomainError(msg, 409, "STALE_PREVIEW_OR_REVISION");
  }
  if (code === "P0002") {
    throw new RegistrationDomainError(msg, 404, "NOT_FOUND");
  }
  if (code === "42501") {
    throw new RegistrationDomainError(msg, 403, "FORBIDDEN_PREVIEW_OWNER");
  }
  if (code === "22023") {
    throw new RegistrationDomainError(msg, 400, "INVALID_IMPORT_REQUEST");
  }
  throwIfRegistrationsNotMigrated(error);
}

export async function commitRegistrationImportPreview(params: {
  acknowledgeAdjustmentRemoval?: boolean;
  previewId: string;
  actorId: string;
  actorName: string;
  mode: RegistrationImportMode;
  expectedRevision: number;
  idempotencyKey: string;
  useNormalizedNames?: boolean;
}): Promise<CommitRegistrationImportResponse> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_commit_registration_preview_with_adjustments", {
    p_acknowledge_adjustment_removal: params.acknowledgeAdjustmentRemoval ?? false,
    p_preview_id: params.previewId,
    p_actor_id: params.actorId,
    p_actor_name: params.actorName,
    p_mode: params.mode,
    p_expected_revision: params.expectedRevision,
    p_idempotency_key: params.idempotencyKey,
    p_use_normalized_names: params.useNormalizedNames ?? true,
  });

  if (error) {
    mapRpcError(error);
  }

  const rpcPayload = (data ?? {}) as Record<string, unknown>;
  const batchId = String(rpcPayload.batchId ?? "");
  const { batches, currentRevision } = await listRegistrationBatches();
  const batch =
    batches.find((b) => b.id === batchId) ??
    ({
      id: batchId,
      revision: Number(rpcPayload.currentRevision ?? currentRevision),
      filename: "",
      fileSha256: "",
      fileSizeBytes: 0,
      importMode: params.mode,
      useNormalizedNames: params.useNormalizedNames ?? true,
      totalCount: 0,
      participantCount: 0,
      counselorCount: 0,
      warningCount: 0,
      importedByUserId: params.actorId,
      importedByName: params.actorName,
      createdAt: new Date().toISOString(),
      isActiveBatch: true,
    } satisfies RegistrationImportBatchSummary);

  return {
    ok: true,
    idempotentReplay: Boolean(rpcPayload.idempotentReplay ?? false),
    currentRevision: Number(rpcPayload.currentRevision ?? currentRevision),
    batch,
    insertedCount: Number(rpcPayload.insertedCount ?? 0),
    updatedCount: Number(rpcPayload.updatedCount ?? 0),
    deletedCount: Number(rpcPayload.deletedCount ?? 0),
  };
}

export async function deleteRegistrationImportBatch(params: {
  batchId: string;
  actorId: string;
}): Promise<DeleteRegistrationBatchResponse> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_delete_registration_batch", {
    p_batch_id: params.batchId,
    p_actor_id: params.actorId,
  });

  if (error) {
    mapRpcError(error);
  }

  const rpcPayload = (data ?? {}) as Record<string, unknown>;
  const { batches, currentRevision, activeBatchId } = await listRegistrationBatches();
  const activeBatch = batches.find((b) => b.id === activeBatchId) ?? null;

  return {
    ok: true,
    deletedBatchId: String(rpcPayload.deletedBatchId ?? params.batchId),
    deletedRecordsCount: Number(rpcPayload.deletedRecordsCount ?? 0),
    currentRevision: Number(rpcPayload.currentRevision ?? currentRevision),
    activeBatch,
  };
}
