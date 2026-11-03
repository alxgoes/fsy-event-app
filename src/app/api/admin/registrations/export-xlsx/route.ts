import { z } from "zod";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import {
  filterRegistrationRecords,
  listAllActiveRegistrations,
  RegistrationDomainError,
} from "@/lib/registrations/repository";
import { exportRegistrationsWorkbookBuffer } from "@/lib/registrations/xlsx-exporter";
import type { RegistrationRoleCategory } from "@/types/registrations";

export const dynamic = "force-dynamic";

const PRIVATE_BINARY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
};

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

    const useNormalizedNames = searchParams.get("useNormalizedNames") !== "false";
    const status = searchParams.get("status")?.trim() || undefined;
    const stakeName = searchParams.get("stakeName")?.trim() || undefined;
    const wardName = searchParams.get("wardName")?.trim() || undefined;
    const search = searchParams.get("search")?.trim() || undefined;

    const allRecords = await listAllActiveRegistrations(batchId);
    const filtered = filterRegistrationRecords(allRecords, {
      batchId,
      roleCategory,
      status,
      stakeName,
      wardName,
      hasHealthAlert,
      hasIssues,
      search,
    });

    const xlsxBuffer = exportRegistrationsWorkbookBuffer(filtered, {
      useNormalizedNames,
    });

    const filename = "inscricoes-fsy-rp2-2027.xlsx";

    return new Response(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        ...PRIVATE_BINARY_HEADERS,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(xlsxBuffer.length),
      },
    });
  } catch (error) {
    if (error instanceof RegistrationDomainError) {
      return json({ error: error.message, code: error.code }, error.statusCode);
    }
    return serverError("registrations.exportXlsx", error);
  }
}
