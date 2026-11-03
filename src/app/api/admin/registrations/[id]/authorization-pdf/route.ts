import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import { renderAuthorizationPdfBuffer } from "@/lib/pdf/authorization-pdf";
import { isCancelledRegistration } from "@/lib/registrations/authorization-adjustments";
import { isSameOriginRequest } from "@/lib/security/origin";
import { PatchRegistrationRequestSchema } from "@/types/registrations";
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
  return servePdf(request, context, false);
}

/** Prévia privada do rascunho, sem persistir dados ou alterar o original. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return json({ error: "Origem não permitida." }, 403);
  return servePdf(request, context, true);
}

async function servePdf(request: Request, context: { params: Promise<{ id: string }> }, preview: boolean) {
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
    if (isCancelledRegistration(record)) return json({ error: "Inscrições canceladas não geram autorização." }, 409);
    if (preview) {
      const parsed = PatchRegistrationRequestSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success || !("adjustments" in parsed.data)) return json({ error: "Informe ajustes válidos para a pré-visualização." }, 400);
      record.authorizationAdjustments = {
        values: { ...record.authorizationAdjustments?.values, ...parsed.data.adjustments },
        editedByUserId: auth.identity.user.id, editedByName: auth.identity.profile.full_name,
        editedAt: new Date().toISOString(),
      };
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
