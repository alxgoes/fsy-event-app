import { Buffer } from "node:buffer";
import { createSign, randomInt } from "node:crypto";
import { hasRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  FcmAnnouncementDataPayload,
  FcmV1ErrorClassification,
  FcmV1ErrorCode,
  NotificationChannelPreferences,
  PushDispatchSummary,
  PushPlatform,
  RegisteredPushDeviceSummary,
} from "@/types/push-notifications";

export const LOCKSCREEN_REDACTED_TITLE = "FSY RP2: novo aviso";
export const GENERIC_REDACTED_BODY =
  "Abra o aplicativo e autentique-se para visualizar o comunicado.";
const ALLOWED_DEEP_LINK_PREFIX = "fsyrp2://portal/";
const ALLOWED_CATEGORIES = new Set([
  "geral",
  "companhia",
  "logistica",
  "espiritual",
  "emergencia",
]);

const DEFAULT_FCM_TIMEOUT_MS = 2_500;
const MAX_SYNC_BACKOFF_BUDGET_MS = 1_500;
const FCM_SEND_CONCURRENCY = 8;

export class PushTokenCollisionError extends Error {
  readonly status = 409;
  readonly code = "TOKEN_BOUND_TO_OTHER_ACCOUNT";
  readonly requiresTokenRotation = true;

  constructor(
    message = "Este token de notificação está vinculado a outra sessão ativa. Rotacione o token no SDK (deleteToken + getToken) e tente novamente."
  ) {
    super(message);
    this.name = "PushTokenCollisionError";
  }
}

export class PushRevokeMissingTargetError extends Error {
  readonly status = 400;
  readonly code = "DEVICE_ID_OR_ALL_REQUIRED";

  constructor(
    message = "Informe deviceId ou all=true explicitamente para revogar dispositivos."
  ) {
    super(message);
    this.name = "PushRevokeMissingTargetError";
  }
}

let cachedAccessToken: { token: string; expiresAtMs: number } | null = null;

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function buildAllowedAnnouncementDeepLink(announcementId: string): string {
  const cleanId = announcementId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  if (!cleanId) {
    throw new Error("ID de comunicado inválido para deep link.");
  }
  const link = `fsyrp2://portal/announcements/${cleanId}`;
  if (!link.startsWith(ALLOWED_DEEP_LINK_PREFIX)) {
    throw new Error("Deep link fora da allowlist permitida.");
  }
  return link;
}

export function isValidQuietHourString(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === "") return true;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return Boolean(match);
}

export function isWithinQuietHoursSaoPaulo(
  startHHMM: string | null | undefined,
  endHHMM: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!startHHMM || !endHHMM) return false;
  if (!isValidQuietHourString(startHHMM) || !isValidQuietHourString(endHHMM)) return false;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const hhmm = formatter.format(now);
  const [curH, curM] = hhmm.split(":").map(Number);
  const [startH, startM] = startHHMM.split(":").map(Number);
  const [endH, endM] = endHHMM.split(":").map(Number);

  const curTotal = curH * 60 + curM;
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  if (startTotal === endTotal) return false;
  if (startTotal < endTotal) {
    return curTotal >= startTotal && curTotal < endTotal;
  }
  // Faixa que atravessa a meia-noite (ex: 22:30 até 06:30)
  return curTotal >= startTotal || curTotal < endTotal;
}

/**
 * Constrói o payload estritamente redigido (data-only) para o FCM HTTP v1.
 * NUNCA inclui título nem conteúdo arbitrário do comunicado (que podem conter PII/saúde).
 * Inclui apenas texto genérico estático, ID, canal, destino allowlist e vínculo de conta/geração.
 */
export function buildSafeAnnouncementPushPayload(params: {
  announcementId: string;
  priority: "normal" | "important" | "urgent";
  category: string;
  targetCompanyId: string | null;
  targetUserId: string;
  deviceId: string;
  bindingGeneration: number | string;
}): FcmAnnouncementDataPayload {
  const normalizedCategory = params.category.trim().toLowerCase();
  const safeCategory = ALLOWED_CATEGORIES.has(normalizedCategory)
    ? normalizedCategory
    : "geral";

  return {
    type: "fsy_announcement",
    announcementId: params.announcementId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64),
    priority: params.priority,
    category: safeCategory,
    scope: params.targetCompanyId ? "company" : "global",
    channelId:
      params.priority === "urgent" ? "fsy_announcements_urgent" : "fsy_announcements",
    deepLink: buildAllowedAnnouncementDeepLink(params.announcementId),
    lockscreenTitle: LOCKSCREEN_REDACTED_TITLE,
    genericBody: GENERIC_REDACTED_BODY,
    requiresAuthFetch: "true",
    targetUserId: params.targetUserId,
    deviceId: params.deviceId,
    bindingGeneration: String(params.bindingGeneration),
  };
}

/**
 * Regra de validação para o cliente Android/Web ao receber um data message FCM:
 * Descarta imediatamente notificações atrasadas (late-arrival) após logout,
 * troca de conta no aparelho ou rotação de geração de vínculo (`bindingGeneration`).
 */
export function shouldDisplayPushOnClient(params: {
  payload: Partial<FcmAnnouncementDataPayload> | null | undefined;
  currentUserId: string | null | undefined;
  currentDeviceId: string | null | undefined;
  currentBindingGeneration?: number | string | null;
  isDeviceRevoked?: boolean;
}): { display: boolean; reason?: string } {
  const {
    payload,
    currentUserId,
    currentDeviceId,
    currentBindingGeneration,
    isDeviceRevoked,
  } = params;

  if (!payload || payload.type !== "fsy_announcement") {
    return { display: false, reason: "INVALID_PAYLOAD_TYPE" };
  }
  if (isDeviceRevoked) {
    return { display: false, reason: "DEVICE_REVOKED_ON_LOGOUT" };
  }
  if (!currentUserId || !payload.targetUserId || currentUserId !== payload.targetUserId) {
    return { display: false, reason: "ACCOUNT_MISMATCH_OR_LOGGED_OUT" };
  }
  if (!currentDeviceId || !payload.deviceId || currentDeviceId !== payload.deviceId) {
    return { display: false, reason: "DEVICE_MISMATCH" };
  }
  if (
    currentBindingGeneration !== undefined &&
    currentBindingGeneration !== null &&
    String(currentBindingGeneration) !== String(payload.bindingGeneration)
  ) {
    return { display: false, reason: "STALE_BINDING_GENERATION" };
  }
  if (!payload.deepLink || !payload.deepLink.startsWith(ALLOWED_DEEP_LINK_PREFIX)) {
    return { display: false, reason: "DISALLOWED_DEEP_LINK" };
  }
  return { display: true };
}

/**
 * Classifica códigos de erro da API FCM HTTP v1 conforme documentação oficial
 * (`https://firebase.google.com/docs/cloud-messaging/send/v1-api`):
 * - `UNREGISTERED` (404) / `SENDER_ID_MISMATCH` (403) -> revogar token imediatamente, sem retry.
 * - `INVALID_ARGUMENT` (400) -> não fazer retry; se indicar token inválido, revogar token.
 * - `QUOTA_EXCEEDED` (429) / `UNAVAILABLE` (503) / `INTERNAL` (500) -> retry com exponential backoff + jitter, respeitando `Retry-After`.
 */
export function classifyFcmV1Error(
  status: number,
  errorBody: unknown,
  retryAfterHeader?: string | null
): FcmV1ErrorClassification {
  let fcmErrorCode: FcmV1ErrorCode | "UNKNOWN" = "UNKNOWN";
  let errorMessage = "";

  if (errorBody && typeof errorBody === "object") {
    const errObj = (errorBody as { error?: Record<string, unknown> }).error;
    if (errObj && typeof errObj === "object") {
      if (typeof errObj.message === "string") {
        errorMessage = errObj.message;
      }
      const details = Array.isArray(errObj.details) ? errObj.details : [];
      for (const detail of details) {
        if (detail && typeof detail === "object" && typeof (detail as { errorCode?: unknown }).errorCode === "string") {
          fcmErrorCode = (detail as { errorCode: FcmV1ErrorCode }).errorCode;
          break;
        }
      }
      if (fcmErrorCode === "UNKNOWN" && typeof errObj.status === "string") {
        const st = errObj.status as FcmV1ErrorCode;
        if (
          st === "UNREGISTERED" ||
          st === "INVALID_ARGUMENT" ||
          st === "QUOTA_EXCEEDED" ||
          st === "UNAVAILABLE" ||
          st === "INTERNAL" ||
          st === "SENDER_ID_MISMATCH" ||
          st === "THIRD_PARTY_AUTH_ERROR"
        ) {
          fcmErrorCode = st;
        }
      }
    }
  }

  let retryAfterMs: number | null = null;
  if (retryAfterHeader) {
    const trimmed = retryAfterHeader.trim();
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds) && seconds >= 0) {
      retryAfterMs = Math.round(seconds * 1000);
    } else {
      const parsedDate = Date.parse(trimmed);
      if (!Number.isNaN(parsedDate)) {
        retryAfterMs = Math.max(0, parsedDate - Date.now());
      }
    }
  }

  if (status === 404 || status === 410 || fcmErrorCode === "UNREGISTERED") {
    return {
      status,
      fcmErrorCode: fcmErrorCode === "UNKNOWN" ? "UNREGISTERED" : fcmErrorCode,
      action: "revoke_token",
      retryAfterMs: null,
    };
  }

  if (status === 403 && fcmErrorCode === "SENDER_ID_MISMATCH") {
    return {
      status,
      fcmErrorCode: "SENDER_ID_MISMATCH",
      action: "revoke_token",
      retryAfterMs: null,
    };
  }

  if (status === 400 || fcmErrorCode === "INVALID_ARGUMENT") {
    const isInvalidToken = /registration token|not a valid FCM registration token/i.test(
      errorMessage
    );
    return {
      status,
      fcmErrorCode: "INVALID_ARGUMENT",
      action: isInvalidToken ? "revoke_token" : "abort_no_retry",
      retryAfterMs: null,
    };
  }

  if (status === 429 || fcmErrorCode === "QUOTA_EXCEEDED") {
    return {
      status,
      fcmErrorCode: "QUOTA_EXCEEDED",
      action: "retry_backoff",
      retryAfterMs: retryAfterMs ?? 60_000,
    };
  }

  if (status === 503 || fcmErrorCode === "UNAVAILABLE") {
    return {
      status,
      fcmErrorCode: "UNAVAILABLE",
      action: "retry_backoff",
      retryAfterMs,
    };
  }

  if (status === 500 || fcmErrorCode === "INTERNAL") {
    return {
      status,
      fcmErrorCode: "INTERNAL",
      action: "retry_backoff",
      retryAfterMs,
    };
  }

  return {
    status,
    fcmErrorCode,
    action: "abort_no_retry",
    retryAfterMs: null,
  };
}

export function computeExponentialBackoffMs(
  attemptIndex: number,
  retryAfterMs?: number | null,
  baseDelayMs = 250
): number {
  const jitterMs = randomInt(25, 150);
  if (retryAfterMs !== undefined && retryAfterMs !== null && retryAfterMs > 0) {
    return retryAfterMs + jitterMs;
  }
  const exp = Math.min(attemptIndex, 5);
  return baseDelayMs * 2 ** exp + jitterMs;
}

function mapDeviceRow(row: Record<string, unknown>): RegisteredPushDeviceSummary {
  const prefs: NotificationChannelPreferences = {
    announcementsEnabled: Boolean(row.announcements_enabled ?? true),
    urgentOnly: Boolean(row.urgent_only ?? false),
    scheduleRemindersEnabled: Boolean(row.schedule_reminders_enabled ?? true),
    personalRemindersEnabled: Boolean(row.personal_reminders_enabled ?? true),
    quietHoursStart: row.quiet_hours_start ? String(row.quiet_hours_start) : null,
    quietHoursEnd: row.quiet_hours_end ? String(row.quiet_hours_end) : null,
  };
  return {
    id: String(row.id),
    userId: String(row.user_id),
    deviceId: String(row.device_id),
    platform: (row.platform === "ios" || row.platform === "web" ? row.platform : "android") as PushPlatform,
    appVersion: row.app_version ? String(row.app_version) : null,
    bindingGeneration: Number(row.binding_generation ?? 1),
    hasActiveToken: !row.revoked_at && Boolean(row.fcm_token),
    preferences: prefs,
    lastSeenAt: String(row.last_seen_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  };
}

export async function listUserPushDevices(userId: string): Promise<RegisteredPushDeviceSummary[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("push_device_tokens")
    .select(
      "id, user_id, device_id, platform, app_version, binding_generation, fcm_token, announcements_enabled, urgent_only, schedule_reminders_enabled, personal_reminders_enabled, quiet_hours_start, quiet_hours_end, revoked_at, last_seen_at, updated_at"
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return (data ?? []).map((r) => mapDeviceRow(r as Record<string, unknown>));
}

/**
 * Registra ou atualiza atomicamente o token FCM do dispositivo autenticado (`userId`)
 * via RPC `register_user_push_device`.
 *
 * SEGURANÇA:
 * - NUNCA faz DELETE cross-account por `deviceId` ou `fcmToken`.
 * - Todas as escritas são estritamente escopadas ao `userId` autenticado.
 * - Se `fcmToken` colidir com outra conta ativa (`23505` / `TOKEN_BOUND_TO_OTHER_ACCOUNT`),
 *   lança `PushTokenCollisionError` (HTTP 409) para que o cliente rotacione o token no SDK.
 */
export async function registerUserPushDevice(params: {
  userId: string;
  deviceId: string;
  platform: PushPlatform;
  fcmToken: string;
  appVersion?: string;
  preferences?: Partial<NotificationChannelPreferences>;
}): Promise<RegisteredPushDeviceSummary> {
  const supabase = createAdminClient();
  const prefs = params.preferences;
  const updateQuietHours =
    prefs !== undefined &&
    (prefs.quietHoursStart !== undefined || prefs.quietHoursEnd !== undefined);

  const { data, error } = await supabase.rpc("register_user_push_device", {
    p_user_id: params.userId,
    p_device_id: params.deviceId,
    p_platform: params.platform,
    p_fcm_token: params.fcmToken,
    p_app_version: params.appVersion ?? null,
    p_announcements_enabled: prefs?.announcementsEnabled ?? null,
    p_urgent_only: prefs?.urgentOnly ?? null,
    p_schedule_reminders_enabled: prefs?.scheduleRemindersEnabled ?? null,
    p_personal_reminders_enabled: prefs?.personalRemindersEnabled ?? null,
    p_quiet_hours_start: prefs?.quietHoursStart ?? null,
    p_quiet_hours_end: prefs?.quietHoursEnd ?? null,
    p_update_quiet_hours: updateQuietHours,
  });

  if (error) {
    if (
      error.code === "23505" ||
      String(error.message ?? "").includes("TOKEN_BOUND_TO_OTHER_ACCOUNT")
    ) {
      throw new PushTokenCollisionError();
    }
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row || !row.id) {
    throw new Error("Falha ao registrar dispositivo de notificação.");
  }

  return mapDeviceRow(row);
}

export async function updateUserPushPreferences(params: {
  userId: string;
  deviceId: string;
  preferences: Partial<NotificationChannelPreferences>;
}): Promise<RegisteredPushDeviceSummary | null> {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.preferences.announcementsEnabled !== undefined) {
    updates.announcements_enabled = params.preferences.announcementsEnabled;
  }
  if (params.preferences.urgentOnly !== undefined) {
    updates.urgent_only = params.preferences.urgentOnly;
  }
  if (params.preferences.scheduleRemindersEnabled !== undefined) {
    updates.schedule_reminders_enabled = params.preferences.scheduleRemindersEnabled;
  }
  if (params.preferences.personalRemindersEnabled !== undefined) {
    updates.personal_reminders_enabled = params.preferences.personalRemindersEnabled;
  }
  if (params.preferences.quietHoursStart !== undefined) {
    updates.quiet_hours_start = params.preferences.quietHoursStart;
  }
  if (params.preferences.quietHoursEnd !== undefined) {
    updates.quiet_hours_end = params.preferences.quietHoursEnd;
  }

  const { data, error } = await supabase
    .from("push_device_tokens")
    .update(updates)
    .eq("user_id", params.userId)
    .eq("device_id", params.deviceId)
    .is("revoked_at", null)
    .select(
      "id, user_id, device_id, platform, app_version, binding_generation, fcm_token, announcements_enabled, urgent_only, schedule_reminders_enabled, personal_reminders_enabled, quiet_hours_start, quiet_hours_end, revoked_at, last_seen_at, updated_at"
    )
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapDeviceRow(data as Record<string, unknown>);
}

/**
 * Revoga atomicamente os dispositivos da conta autenticada (`userId`) via RPC
 * `revoke_user_push_devices`.
 * P4: Exige `deviceId` preenchido OU `revokeAll === true` explícito.
 */
export async function revokeUserPushDevices(params: {
  userId: string;
  deviceId?: string;
  revokeAll?: boolean;
}): Promise<number> {
  const cleanDeviceId = params.deviceId?.trim() || undefined;
  const revokeAll = params.revokeAll === true;

  if (!cleanDeviceId && !revokeAll) {
    throw new PushRevokeMissingTargetError();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("revoke_user_push_devices", {
    p_user_id: params.userId,
    p_device_id: cleanDeviceId ?? null,
    p_revoke_all: revokeAll,
  });

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return 0;
    if (String(error.message ?? "").includes("DEVICE_ID_OR_ALL_REQUIRED")) {
      throw new PushRevokeMissingTargetError();
    }
    throw error;
  }
  return typeof data === "number" ? data : Number(data ?? 0);
}

export function resolveFirebaseServiceAccountFromEnv(): {
  projectId: string;
  clientEmail: string;
  privateKey: string;
} | null {
  const jsonEnv =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();

  if (jsonEnv) {
    try {
      const rawJson = jsonEnv.startsWith("{")
        ? jsonEnv
        : Buffer.from(jsonEnv, "base64").toString("utf8");
      const parsed = JSON.parse(rawJson) as {
        project_id?: string;
        projectId?: string;
        client_email?: string;
        clientEmail?: string;
        private_key?: string;
        privateKey?: string;
      };
      const projectId = (parsed.project_id ?? parsed.projectId ?? "").trim();
      const clientEmail = (parsed.client_email ?? parsed.clientEmail ?? "").trim();
      const privateKey = (parsed.private_key ?? parsed.privateKey ?? "")
        .trim()
        .replace(/\\n/g, "\n");
      if (projectId && clientEmail && privateKey) {
        return { projectId, clientEmail, privateKey };
      }
    } catch {
      console.error("[push] config.json_parse_error");
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !rawPrivateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
  };
}

async function getFirebaseAccessToken(
  timeoutMs = DEFAULT_FCM_TIMEOUT_MS
): Promise<{ projectId: string; accessToken: string } | null> {
  const creds = resolveFirebaseServiceAccountFromEnv();
  if (!creds) {
    return null;
  }
  const { projectId, clientEmail, privateKey } = creds;

  const nowMs = Date.now();
  if (cachedAccessToken && cachedAccessToken.expiresAtMs - 60_000 > nowMs) {
    return { projectId, accessToken: cachedAccessToken.token };
  }

  const iat = Math.floor(nowMs / 1000);
  const exp = iat + 3600;

  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp,
    })
  );

  const unsignedJwt = `${header}.${claimSet}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = base64UrlEncode(signer.sign(privateKey));
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    signal: globalThis.AbortSignal?.timeout ? globalThis.AbortSignal.timeout(timeoutMs) : undefined,
  });

  if (!response.ok) {
    console.error("[push] oauth.token status=", response.status);
    return null;
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;

  cachedAccessToken = {
    token: body.access_token,
    expiresAtMs: nowMs + (body.expires_in ?? 3600) * 1000,
  };
  return { projectId, accessToken: body.access_token };
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Seleciona os dispositivos elegíveis para um comunicado recém-publicado e envia
 * notificações push via FCM HTTP v1 (`https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`).
 *
 * GARANTIAS:
 * - P1: Mensagens estritamente DATA-ONLY (sem `android.notification`), obrigando o app
 *   receptor a validar `targetUserId`, `deviceId` e `bindingGeneration` antes de exibir.
 * - P2: Envio com concorrência limitada (`FCM_SEND_CONCURRENCY = 8`) e registro idempotente
 *   por `(announcementId, deviceId)` em `push_announcement_deliveries`.
 * - Nunca inclui título nem conteúdo livre do comunicado no payload FCM.
 */
export async function dispatchAnnouncementPush(params: {
  announcementId: string;
  priority: "normal" | "important" | "urgent";
  category: string;
  targetCompanyId: string | null;
  now?: Date;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<PushDispatchSummary> {
  const summary: PushDispatchSummary = {
    configured: Boolean(resolveFirebaseServiceAccountFromEnv()),
    eligibleDevices: 0,
    sentCount: 0,
    skippedQuietHoursOrPrefs: 0,
    revokedStaleTokens: 0,
    retriedCount: 0,
    quotaExceededCount: 0,
    transientFailureCount: 0,
    timedOutCount: 0,
  };

  const perRequestTimeoutMs = params.timeoutMs ?? DEFAULT_FCM_TIMEOUT_MS;
  const fetchFn = params.fetchImpl ?? fetch;

  try {
    const supabase = createAdminClient();
    const { data: tokenRows, error: tokenErr } = await supabase
      .from("push_device_tokens")
      .select(
        "id, user_id, device_id, binding_generation, fcm_token, announcements_enabled, urgent_only, quiet_hours_start, quiet_hours_end, profiles!user_id(role, company_id, suspended_at)"
      )
      .is("revoked_at", null);

    if (tokenErr || !tokenRows || tokenRows.length === 0) {
      return summary;
    }

    // Consulta entregas já concluídas para este announcementId (idempotência P2/N2/N4)
    const alreadySentBindings = new Set<string>();
    const { data: existingDeliveries, error: existingDeliveriesErr } = await supabase
      .from("push_announcement_deliveries")
      .select("user_id, device_id, status")
      .eq("announcement_id", params.announcementId);

    if (
      existingDeliveriesErr &&
      existingDeliveriesErr.code !== "42P01" &&
      existingDeliveriesErr.code !== "PGRST205"
    ) {
      console.error("[push] deliveries.select.error", existingDeliveriesErr.code ?? "");
    } else if (Array.isArray(existingDeliveries)) {
      for (const row of existingDeliveries as Record<string, unknown>[]) {
        if (row.status === "sent" && row.user_id && row.device_id) {
          alreadySentBindings.add(`${String(row.user_id)}:${String(row.device_id)}`);
        }
      }
    }

    const now = params.now ?? new Date();
    const eligibleTokens: {
      id: string;
      userId: string;
      deviceId: string;
      bindingGeneration: number;
      fcmToken: string;
    }[] = [];

    for (const rawRow of tokenRows as Record<string, unknown>[]) {
      const profileRaw = Array.isArray(rawRow.profiles) ? rawRow.profiles[0] : rawRow.profiles;
      const profile = (profileRaw ?? null) as {
        role?: Parameters<typeof hasRole>[0];
        company_id?: string | null;
        suspended_at?: string | null;
      } | null;

      // Bloqueia contas sem perfil ou suspensas
      if (!profile || !profile.role || profile.suspended_at) {
        continue;
      }

      // Escopo de companhia: comunicados de uma companhia específica só vão para membros daquela companhia ou gestores globais
      if (params.targetCompanyId) {
        const isGlobalManager = hasRole(profile.role, "announcementManagers");
        if (!isGlobalManager && profile.company_id !== params.targetCompanyId) {
          continue;
        }
      }

      if (!rawRow.announcements_enabled) {
        summary.skippedQuietHoursOrPrefs += 1;
        continue;
      }

      if (rawRow.urgent_only && params.priority !== "urgent") {
        summary.skippedQuietHoursOrPrefs += 1;
        continue;
      }

      if (
        params.priority !== "urgent" &&
        isWithinQuietHoursSaoPaulo(
          rawRow.quiet_hours_start as string | null,
          rawRow.quiet_hours_end as string | null,
          now
        )
      ) {
        summary.skippedQuietHoursOrPrefs += 1;
        continue;
      }

      const userIdStr = String(rawRow.user_id);
      const deviceIdStr = String(rawRow.device_id);
      const bindingKey = `${userIdStr}:${deviceIdStr}`;
      if (alreadySentBindings.has(bindingKey)) {
        continue;
      }
      alreadySentBindings.add(bindingKey);

      eligibleTokens.push({
        id: String(rawRow.id),
        userId: userIdStr,
        deviceId: deviceIdStr,
        bindingGeneration: Number(rawRow.binding_generation ?? 1),
        fcmToken: String(rawRow.fcm_token),
      });
    }

    summary.eligibleDevices = eligibleTokens.length;
    if (eligibleTokens.length === 0 || !summary.configured) {
      return summary;
    }

    const auth = await getFirebaseAccessToken(perRequestTimeoutMs);
    if (!auth) {
      return summary;
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
      auth.projectId
    )}/messages:send`;

    const sendSingleDevice = async (item: (typeof eligibleTokens)[number]) => {
      const dataPayload = buildSafeAnnouncementPushPayload({
        announcementId: params.announcementId,
        priority: params.priority,
        category: params.category,
        targetCompanyId: params.targetCompanyId,
        targetUserId: item.userId,
        deviceId: item.deviceId,
        bindingGeneration: item.bindingGeneration,
      });

      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        attempt += 1;
        try {
          // P1: Mensagem estritamente DATA-ONLY (sem android.notification!)
          // O cliente Android (FsyFirebaseMessagingService) valida conta/device/geração
          // via shouldDisplayPushOnClient antes de construir a notificação local.
          const res = await fetchFn(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token: item.fcmToken,
                data: { ...dataPayload },
                android: {
                  priority: params.priority === "urgent" ? "HIGH" : "NORMAL",
                  collapse_key: `ann_${dataPayload.announcementId}`,
                },
              },
            }),
            signal: globalThis.AbortSignal?.timeout
              ? globalThis.AbortSignal.timeout(perRequestTimeoutMs)
              : undefined,
          });

          if (res.ok) {
            summary.sentCount += 1;
            const { error: deliveryUpsertErr } = await supabase
              .from("push_announcement_deliveries")
              .upsert(
                {
                  announcement_id: params.announcementId,
                  user_id: item.userId,
                  device_id: item.deviceId,
                  status: "sent",
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "announcement_id,user_id,device_id" }
              );
            if (
              deliveryUpsertErr &&
              deliveryUpsertErr.code !== "42P01" &&
              deliveryUpsertErr.code !== "PGRST205"
            ) {
              console.error("[push] deliveries.upsert.error", deliveryUpsertErr.code ?? "");
            }
            break;
          }

          let errorBody: unknown = null;
          try {
            errorBody = await res.json();
          } catch {
            errorBody = null;
          }

          const classification = classifyFcmV1Error(
            res.status,
            errorBody,
            res.headers?.get?.("retry-after") ?? null
          );

          if (classification.action === "revoke_token") {
            const { error: delErr } = await supabase
              .from("push_device_tokens")
              .delete()
              .eq("id", item.id)
              .eq("user_id", item.userId);
            if (delErr) {
              console.error("[push] revoke.stale.error", delErr.code ?? "");
            } else {
              summary.revokedStaleTokens += 1;
            }
            break;
          }

          if (classification.action === "retry_backoff") {
            if (classification.fcmErrorCode === "QUOTA_EXCEEDED") {
              summary.quotaExceededCount += 1;
            }
            const backoffMs = computeExponentialBackoffMs(
              attempt - 1,
              classification.retryAfterMs
            );
            if (attempt < maxAttempts && backoffMs <= MAX_SYNC_BACKOFF_BUDGET_MS) {
              summary.retriedCount += 1;
              await sleepMs(backoffMs);
              continue;
            }
            summary.transientFailureCount += 1;
            break;
          }

          break;
        } catch (sendErr) {
          const errName = (sendErr as { name?: string })?.name ?? "";
          if (errName === "TimeoutError" || errName === "AbortError") {
            summary.timedOutCount += 1;
          } else {
            summary.transientFailureCount += 1;
          }
          break;
        }
      }
    };

    // P2: Concorrência limitada a FCM_SEND_CONCURRENCY (8 envios simultâneos por janela)
    for (let i = 0; i < eligibleTokens.length; i += FCM_SEND_CONCURRENCY) {
      const batch = eligibleTokens.slice(i, i + FCM_SEND_CONCURRENCY);
      await Promise.all(batch.map((item) => sendSingleDevice(item)));
    }

    return summary;
  } catch (err) {
    console.error("[push] dispatch.error", (err as { code?: string })?.code ?? "");
    return summary;
  }
}
