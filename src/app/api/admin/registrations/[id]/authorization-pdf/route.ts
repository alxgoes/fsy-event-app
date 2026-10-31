import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import { renderAuthorizationPdfBuffer } from "@/lib/pdf/authorization-pdf";
import {
  getRegistrationById,
  RegistrationDomainError,
} from "@/lib/registrations/repository";

export const dynamic = "force-dynamic";

const PRIVATE_PDF_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
};

function toAsciiHeaderValue(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

export async function GET(
  request: Request,
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

    const { searchParams } = new URL(request.url);
    const useNormalizedNames = searchParams.get("useNormalizedNames") !== "false";
    const dispositionMode = searchParams.get("download") === "0" ? "inline" : "attachment";

    const { pdfBuffer, payload } = renderAuthorizationPdfBuffer(record, {
      useNormalizedNames,
    });

    const asciiFilename = toAsciiHeaderValue(payload.suggestedFilename) || "ficha-autorizacao.pdf";
    const asciiOverflowFields = payload.overflowFields
      .map((field) => toAsciiHeaderValue(field))
      .join(", ");

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        ...PRIVATE_PDF_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionMode}; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(payload.suggestedFilename)}`,
        "Content-Length": String(pdfBuffer.length),
        "X-Authorization-Overflow-Warning": payload.hasOverflowWarning ? "1" : "0",
        "X-Authorization-Overflow-Fields": asciiOverflowFields,
      },
    });
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.authorizationPdf", error);
  }
}
