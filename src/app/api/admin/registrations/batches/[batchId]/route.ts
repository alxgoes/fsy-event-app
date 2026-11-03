import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  deleteRegistrationImportBatch,
  RegistrationDomainError,
} from "@/lib/registrations/repository";
import { isSameOriginRequest } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  try {
    const resolvedParams = await Promise.resolve(context.params);
    const batchId = resolvedParams?.batchId?.trim() ?? "";

    if (!z.string().uuid().safeParse(batchId).success) {
      return json(
        {
          error:
            "Informe o UUID exato do lote a excluir (exclusão irrestrita 'all' não é permitida).",
          code: "INVALID_BATCH_ID",
        },
        400
      );
    }

    const result = await deleteRegistrationImportBatch({
      batchId,
      actorId: auth.identity.user.id,
    });

    return json(result, 200);
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.batches.delete", error);
  }
}
