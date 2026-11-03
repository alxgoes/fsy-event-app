import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  getRegistrationById,
  patchRegistrationAuthorization,
  RegistrationDomainError,
} from "@/lib/registrations/repository";
import { isSameOriginRequest } from "@/lib/security/origin";
import { PatchRegistrationRequestSchema } from "@/types/registrations";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return json({ error: "Origem não permitida." }, 403);
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return json({ error: "ID da inscrição inválido." }, 400);
    const body = await request.json().catch(() => null);
    const parsed = PatchRegistrationRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Ajustes inválidos.", issues: parsed.error.issues }, 400);
    return json(await patchRegistrationAuthorization(id, auth.identity.user.id, parsed.data));
  } catch (error) {
    if (error instanceof RegistrationDomainError) return json({ error: error.message, code: error.code }, error.statusCode);
    return serverError("registrations.patchAuthorization", error);
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const id = resolvedParams?.id?.trim() ?? "";
    if (!z.string().uuid().safeParse(id).success) {
      return json({ error: "ID da inscrição inválido." }, 400);
    }

    const record = await getRegistrationById(id);
    if (!record) {
      return json({ error: "Inscrição não encontrada." }, 404);
    }

    return json(record, 200);
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.getById", error);
  }
}
