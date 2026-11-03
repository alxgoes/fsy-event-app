import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  getRegistrationStateMeta,
  listAllActiveRegistrations,
  RegistrationDomainError,
  saveRegistrationImportPreview,
} from "@/lib/registrations/repository";
import { parseRegistrationsWorkbook } from "@/lib/registrations/xlsx-parser";
import { isSameOriginRequest } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

async function extractUploadedWorkbook(
  request: Request
): Promise<{ filename: string; buffer: Buffer }> {
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("multipart/form-data") && typeof request.formData === "function") {
    const form = await request.formData();
    const fileEntry = form.get("file");
    if (!fileEntry || typeof (fileEntry as Blob).arrayBuffer !== "function") {
      throw new RegistrationDomainError(
        "Selecione um arquivo .xlsx válido no campo 'file'.",
        400,
        "MISSING_FILE"
      );
    }
    const fileObj = fileEntry as File;
    const filename = (fileObj.name || "inscricoes.xlsx").trim();
    if (!filename.toLowerCase().endsWith(".xlsx")) {
      throw new RegistrationDomainError(
        "Apenas planilhas no formato .xlsx são aceitas.",
        400,
        "INVALID_EXTENSION"
      );
    }
    if (fileObj.size > MAX_UPLOAD_BYTES) {
      throw new RegistrationDomainError(
        "A planilha excede o tamanho máximo de 10 MB.",
        400,
        "FILE_TOO_LARGE"
      );
    }
    const ab = await fileObj.arrayBuffer();
    return { filename, buffer: Buffer.from(ab) };
  }

  if (typeof request.arrayBuffer === "function") {
    const filenameHeader =
      request.headers.get("x-filename")?.trim() || "inscricoes-fsy-rp2-2027.xlsx";
    if (!filenameHeader.toLowerCase().endsWith(".xlsx")) {
      throw new RegistrationDomainError(
        "Apenas planilhas no formato .xlsx são aceitas.",
        400,
        "INVALID_EXTENSION"
      );
    }
    const ab = await request.arrayBuffer();
    if (ab.byteLength === 0) {
      throw new RegistrationDomainError(
        "O arquivo enviado está vazio.",
        400,
        "EMPTY_FILE"
      );
    }
    if (ab.byteLength > MAX_UPLOAD_BYTES) {
      throw new RegistrationDomainError(
        "A planilha excede o tamanho máximo de 10 MB.",
        400,
        "FILE_TOO_LARGE"
      );
    }
    return { filename: filenameHeader, buffer: Buffer.from(ab) };
  }

  throw new RegistrationDomainError(
    "Formato de envio não suportado. Use multipart/form-data com o campo 'file'.",
    400,
    "UNSUPPORTED_UPLOAD"
  );
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Origem não permitida." }, 403);
  }
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  try {
    const { filename, buffer } = await extractUploadedWorkbook(request);
    const [meta, existingRecords] = await Promise.all([
      getRegistrationStateMeta(),
      listAllActiveRegistrations(),
    ]);

    let parsed;
    try {
      parsed = parseRegistrationsWorkbook({
        fileBuffer: buffer,
        filename,
        createdByUserId: auth.identity.user.id,
        baseRevision: meta.currentRevision,
        existingRecords,
      });
    } catch (parseErr) {
      const msg =
        parseErr instanceof Error
          ? parseErr.message
          : "Não foi possível ler o arquivo .xlsx enviado.";
      return json({ error: msg, code: "INVALID_XLSX" }, 400);
    }

    const importedKeys = new Set(parsed.canonicalRows.map((record) => record.dedupKey));
    const adjustedRecords = existingRecords.filter((record) => record.hasAuthorizationAdjustments);
    parsed.summary.authorizationAdjustmentImpact = {
      retainedCount: adjustedRecords.filter((record) => importedKeys.has(record.dedupKey)).length,
      removedCountOnReplaceAll: adjustedRecords.filter((record) => !importedKeys.has(record.dedupKey)).length,
    };
    await saveRegistrationImportPreview({
      summary: parsed.summary,
      canonicalRows: parsed.canonicalRows,
    });

    return json(parsed.summary, 200);
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.preview", error);
  }
}
