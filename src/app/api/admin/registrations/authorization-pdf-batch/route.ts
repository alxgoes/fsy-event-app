import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import { generateAuthorizationPdfBatchZip } from "@/lib/pdf/authorization-pdf";
import {
  filterRegistrationRecords,
  getRegistrationsByIds,
  listAllActiveRegistrations,
  RegistrationDomainError,
} from "@/lib/registrations/repository";
import { isSameOriginRequest } from "@/lib/security/origin";
import { MAX_AUTHORIZATION_PDF_BATCH_SIZE } from "@/types/authorizations";

export const dynamic = "force-dynamic";

const PRIVATE_ZIP_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
};

const batchRequestSchema = z.object({
  registrationIds: z
    .array(z.string().uuid("ID de inscrição inválido."))
    .max(
      MAX_AUTHORIZATION_PDF_BATCH_SIZE,
      `Cada pacote ZIP suporta no máximo ${MAX_AUTHORIZATION_PDF_BATCH_SIZE} fichas por vez.`
    )
    .optional(),
  batchId: z.string().uuid("ID do lote inválido.").optional(),
  roleCategory: z.enum(["Participante", "Consultor", "all"]).optional().default("Participante"),
  partIndex: z.number().int().min(1).optional().default(1),
  partSize: z
    .number()
    .int()
    .min(1)
    .max(
      MAX_AUTHORIZATION_PDF_BATCH_SIZE,
      `O tamanho máximo por parte é de ${MAX_AUTHORIZATION_PDF_BATCH_SIZE} PDFs.`
    )
    .optional()
    .default(MAX_AUTHORIZATION_PDF_BATCH_SIZE),
  useNormalizedNames: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  const parsed = batchRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      {
        error:
          parsed.error.issues[0]?.message ??
          `Parâmetros inválidos para geração em lote (máximo ${MAX_AUTHORIZATION_PDF_BATCH_SIZE} PDFs por pacote).`,
      },
      400
    );
  }

  try {
    const {
      registrationIds,
      batchId,
      roleCategory,
      partIndex,
      partSize,
      useNormalizedNames,
    } = parsed.data;

    let selectedRecords;
    let totalEligibleCount = 0;

    if (registrationIds && registrationIds.length > 0) {
      selectedRecords = await getRegistrationsByIds(registrationIds);
      totalEligibleCount = selectedRecords.length;
    } else {
      const allRecords = await listAllActiveRegistrations(batchId);
      const eligible = filterRegistrationRecords(allRecords, {
        batchId,
        roleCategory,
      });
      totalEligibleCount = eligible.length;
      const start = (partIndex - 1) * partSize;
      selectedRecords = eligible.slice(start, start + partSize);
    }

    if (selectedRecords.length === 0) {
      return json(
        { error: "Nenhuma inscrição encontrada para gerar o lote de autorizações." },
        404
      );
    }

    const { zipBuffer, progress } = generateAuthorizationPdfBatchZip({
      records: selectedRecords,
      useNormalizedNames,
      partIndex,
      partSize,
      totalEligibleCount,
    });

    const filename =
      progress.totalParts > 1
        ? `fichas-autorizacao-fsy-rp2-2027-parte-${progress.partIndex}-de-${progress.totalParts}.zip`
        : "fichas-autorizacao-fsy-rp2-2027.zip";

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        ...PRIVATE_ZIP_HEADERS,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(zipBuffer.length),
        "X-Batch-Part-Index": String(progress.partIndex),
        "X-Batch-Part-Count": String(progress.totalParts),
        "X-Batch-Total-Eligible": String(progress.totalEligibleCount),
        "X-Batch-Part-Size": String(progress.partSize),
        "X-Batch-Overflow-Warning-Count": String(progress.overflowWarningCount),
      },
    });
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.authorizationPdfBatch", error);
  }
}
