import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  getRegistrationById,
  RegistrationDomainError,
} from "@/lib/registrations/repository";

export const dynamic = "force-dynamic";

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
