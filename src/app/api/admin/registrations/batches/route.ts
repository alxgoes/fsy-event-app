import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  listRegistrationBatches,
  RegistrationDomainError,
} from "@/lib/registrations/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  try {
    const { currentRevision, activeBatchId, batches } = await listRegistrationBatches();
    return json({ currentRevision, activeBatchId, batches }, 200);
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.batches.list", error);
  }
}
