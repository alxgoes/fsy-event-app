/**
 * Contratos do subsistema de Notificações Push (FCM HTTP v1) e Preferências por Dispositivo.
 *
 * REGRAS DE SEGURANÇA:
 * 1. O cliente NUNCA escolhe destinatários nem envia notificações arbitrárias.
 *    O disparo ocorre exclusivamente no servidor (`POST /api/announcements`),
 *    filtrando destinatários pelo banco (`profiles.company_id`, `role`, `suspended_at IS NULL`).
 * 2. Nenhum título livre, conteúdo de comunicado, dado de saúde, documento, quarto ou nome
 *    pessoal entra no payload FCM. O push carrega apenas texto genérico estático, ID do aviso,
 *    destino allowlist (`fsyrp2://portal/announcements/<id>`) e vínculo de conta/geração;
 *    o cliente busca o detalhe em `GET /api/announcements` APÓS autenticar e validar a sessão.
 * 3. Escritas de dispositivo são sempre escopadas ao `userId` autenticado (nunca há deleção
 *    cross-account por `deviceId` livre). Colisão de `fcmToken` com outra conta retorna `409`
 *    (`TOKEN_BOUND_TO_OTHER_ACCOUNT`), exigindo rotação de token no SDK (`deleteToken` + `getToken`)
 *    ou logout autenticado prévio da conta anterior.
 * 4. O cliente valida `targetUserId`, `deviceId` e `bindingGeneration` antes de exibir qualquer
 *    notificação para descartar entregas atrasadas (late-arrival) após logout ou troca de conta.
 * 5. Credenciais de conta de serviço do Firebase (`FIREBASE_PRIVATE_KEY`, etc.)
 *    existem somente em variáveis de ambiente do servidor e NUNCA entram no APK ou no Git.
 */

export type PushPlatform = "android" | "ios" | "web";

export interface NotificationChannelPreferences {
  announcementsEnabled: boolean;
  urgentOnly: boolean;
  scheduleRemindersEnabled: boolean;
  personalRemindersEnabled: boolean;
  quietHoursStart: string | null; // Formato HH:MM (ex: "22:30") no fuso America/Sao_Paulo
  quietHoursEnd: string | null; // Formato HH:MM (ex: "06:30") no fuso America/Sao_Paulo
}

export interface RegisterPushTokenRequest {
  deviceId: string;
  platform: PushPlatform;
  fcmToken: string;
  appVersion?: string;
  preferences?: Partial<NotificationChannelPreferences>;
}

export interface UpdatePushPreferencesRequest {
  deviceId: string;
  preferences: Partial<NotificationChannelPreferences>;
}

export interface RegisteredPushDeviceSummary {
  id: string;
  userId: string;
  deviceId: string;
  platform: PushPlatform;
  appVersion: string | null;
  bindingGeneration: number;
  hasActiveToken: boolean;
  preferences: NotificationChannelPreferences;
  lastSeenAt: string;
  updatedAt: string;
}

/**
 * Payload redigido enviado no bloco `data` do FCM HTTP v1.
 * NUNCA inclui título nem conteúdo livre do comunicado (que poderiam conter PII/saúde).
 */
export interface FcmAnnouncementDataPayload {
  type: "fsy_announcement";
  announcementId: string;
  priority: "normal" | "important" | "urgent";
  category: string;
  scope: "global" | "company";
  channelId: "fsy_announcements" | "fsy_announcements_urgent";
  deepLink: string;
  lockscreenTitle: string;
  genericBody: string;
  requiresAuthFetch: "true";
  targetUserId: string;
  deviceId: string;
  bindingGeneration: string;
}

export type FcmV1ErrorCode =
  | "UNSPECIFIED_ERROR"
  | "INVALID_ARGUMENT"
  | "UNREGISTERED"
  | "SENDER_ID_MISMATCH"
  | "QUOTA_EXCEEDED"
  | "UNAVAILABLE"
  | "INTERNAL"
  | "THIRD_PARTY_AUTH_ERROR";

export interface FcmV1ErrorClassification {
  status: number;
  fcmErrorCode: FcmV1ErrorCode | "UNKNOWN";
  action: "revoke_token" | "retry_backoff" | "abort_no_retry";
  retryAfterMs: number | null;
}

export interface PushDispatchSummary {
  configured: boolean;
  eligibleDevices: number;
  sentCount: number;
  skippedQuietHoursOrPrefs: number;
  revokedStaleTokens: number;
  retriedCount: number;
  quotaExceededCount: number;
  transientFailureCount: number;
  timedOutCount: number;
}
