import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  PushRevokeMissingTargetError,
  PushTokenCollisionError,
  isValidQuietHourString,
  listUserPushDevices,
  registerUserPushDevice,
  revokeUserPushDevices,
  updateUserPushPreferences,
} from "@/lib/notifications/fcm-dispatcher";
import { isSameOriginRequest } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

const quietHourField = z
  .string()
  .trim()
  .nullable()
  .optional()
  .refine((val) => isValidQuietHourString(val), {
    message: "Horário silencioso inválido (use HH:MM, ex: 22:30).",
  });

const preferencesSchema = z
  .object({
    announcementsEnabled: z.boolean().optional(),
    urgentOnly: z.boolean().optional(),
    scheduleRemindersEnabled: z.boolean().optional(),
    personalRemindersEnabled: z.boolean().optional(),
    quietHoursStart: quietHourField,
    quietHoursEnd: quietHourField,
  })
  .strict();

const registerDeviceSchema = z
  .object({
    deviceId: z.string().trim().min(8, "ID do dispositivo inválido.").max(128),
    platform: z.enum(["android", "ios", "web"]).default("android"),
    fcmToken: z
      .string()
      .trim()
      .min(20, "Token de notificação inválido.")
      .max(4096)
      .regex(/^[A-Za-z0-9:_-]+$/, "Formato de token FCM inválido."),
    appVersion: z.string().trim().max(32).optional(),
    preferences: preferencesSchema.optional(),
  })
  .strict();

const updatePreferencesSchema = z
  .object({
    deviceId: z.string().trim().min(8, "ID do dispositivo inválido.").max(128),
    preferences: preferencesSchema,
  })
  .strict();

export async function GET() {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;

  try {
    const devices = await listUserPushDevices(auth.identity.user.id);
    return json({ devices }, 200);
  } catch (error) {
    return serverError("notifications.devices.get", error);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }
  const auth = await requireIdentity();
  if (auth.response) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }

  const parsed = registerDeviceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? "Dados do dispositivo inválidos." },
      400
    );
  }

  try {
    const device = await registerUserPushDevice({
      userId: auth.identity.user.id,
      deviceId: parsed.data.deviceId,
      platform: parsed.data.platform,
      fcmToken: parsed.data.fcmToken,
      appVersion: parsed.data.appVersion,
      preferences: parsed.data.preferences,
    });
    return json({ ok: true, device }, 200);
  } catch (error) {
    if (error instanceof PushTokenCollisionError) {
      return json(
        {
          error: error.message,
          code: error.code,
          requiresTokenRotation: error.requiresTokenRotation,
        },
        409
      );
    }
    return serverError("notifications.devices.post", error);
  }
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }
  const auth = await requireIdentity();
  if (auth.response) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }

  const parsed = updatePreferencesSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      { error: parsed.error.issues[0]?.message ?? "Preferências de notificação inválidas." },
      400
    );
  }

  try {
    const device = await updateUserPushPreferences({
      userId: auth.identity.user.id,
      deviceId: parsed.data.deviceId,
      preferences: parsed.data.preferences,
    });
    if (!device) {
      return json({ error: "Dispositivo não encontrado para esta conta." }, 404);
    }
    return json({ ok: true, device }, 200);
  } catch (error) {
    return serverError("notifications.devices.patch", error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }
  const auth = await requireIdentity();
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId")?.trim() || undefined;
    const revokeAll = searchParams.get("all") === "true";

    if (!deviceId && !revokeAll) {
      return json(
        {
          error: "Informe deviceId ou all=true explicitamente para revogar dispositivos.",
          code: "DEVICE_ID_OR_ALL_REQUIRED",
        },
        400
      );
    }

    const revokedCount = await revokeUserPushDevices({
      userId: auth.identity.user.id,
      deviceId,
      revokeAll,
    });
    return json({ ok: true, revokedCount }, 200);
  } catch (error) {
    if (error instanceof PushRevokeMissingTargetError) {
      return json({ error: error.message, code: error.code }, 400);
    }
    return serverError("notifications.devices.delete", error);
  }
}
