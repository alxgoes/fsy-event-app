import { requireIdentity, serverError } from "@/lib/auth/guard";
import { getBlankAuthorizationTemplateBuffer } from "@/lib/pdf/authorization-pdf";

export const dynamic = "force-dynamic";

const PRIVATE_PDF_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
};

export async function GET() {
  const auth = await requireIdentity("userManagers");
  if (auth.response) return auth.response;

  try {
    const templateBuffer = getBlankAuthorizationTemplateBuffer();
    return new Response(new Uint8Array(templateBuffer), {
      status: 200,
      headers: {
        ...PRIVATE_PDF_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="FICHA AUTORIZACAO.pdf"',
        "Content-Length": String(templateBuffer.length),
      },
    });
  } catch (error) {
    return serverError("registrations.templatePdf", error);
  }
}
