import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  commitRegistrationImportPreview,
  queryRegistrationsList,
  RegistrationDomainError,
} from "@/lib/registrations/repository";
import { isSameOriginRequest } from "@/lib/security/origin";
import type { RegistrationRoleCategory } from "@/types/registrations";

export const dynamic = "force-dynamic";

const commitRequestSchema = z.object({
  previewId: z.string().uuid("ID da pré-visualização inválido."),
  mode: z.enum(["upsert", "replace_all"]),
  expectedRevision: z.number().int().min(0, "Revisão esperada inválida."),
  idempotencyKey: z.string().trim().min(8, "Chave de idempotência obrigatória.").max(128),
  useNormalizedNames: z.boolean().optional().default(true),
});

export async function GET(request: Request) {
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId")?.trim() || undefined;
    if (batchId && !z.string().uuid().safeParse(batchId).success) {
      return json({ error: "ID do lote inválido." }, 400);
    }

    const rawRole = searchParams.get("roleCategory")?.trim();
    const roleCategory: RegistrationRoleCategory | "all" | undefined =
      rawRole === "Participante" || rawRole === "Consultor" || rawRole === "all"
        ? rawRole
        : undefined;

    const hasHealthAlertParam = searchParams.get("hasHealthAlert");
    const hasHealthAlert =
      hasHealthAlertParam === "true"
        ? true
        : hasHealthAlertParam === "false"
          ? false
          : undefined;

    const hasIssuesParam = searchParams.get("hasIssues");
    const hasIssues =
      hasIssuesParam === "true" ? true : hasIssuesParam === "false" ? false : undefined;

    const rawProjection = searchParams.get("projection")?.trim();
    const projection: "default" | "minimal" | "full" =
      rawProjection === "minimal" || rawProjection === "full" ? rawProjection : "default";

    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "50");

    const response = await queryRegistrationsList({
      batchId,
      roleCategory,
      status: searchParams.get("status")?.trim() || undefined,
      stakeName: searchParams.get("stakeName")?.trim() || undefined,
      wardName: searchParams.get("wardName")?.trim() || undefined,
      hasHealthAlert,
      hasIssues,
      search: searchParams.get("search")?.trim() || undefined,
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? pageSize : 50,
      projection,
    });

    return json(response, 200);
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.get", error);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }

  const parsed = commitRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Informe previewId, mode, expectedRevision e idempotencyKey válidos.",
      },
      400
    );
  }

  try {
    const result = await commitRegistrationImportPreview({
      previewId: parsed.data.previewId,
      actorId: auth.identity.user.id,
      actorName: auth.identity.profile.full_name,
      mode: parsed.data.mode,
      expectedRevision: parsed.data.expectedRevision,
      idempotencyKey: parsed.data.idempotencyKey,
      useNormalizedNames: parsed.data.useNormalizedNames,
    });

    return json(result, 200);
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.commit", error);
  }
}
