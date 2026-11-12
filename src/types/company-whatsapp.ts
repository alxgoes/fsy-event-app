import { z } from "zod";
import { companyIdSchema } from "./companies";

export const INVALID_WHATSAPP_INVITE_MESSAGE =
  "Cole o link de convite do grupo, no formato https://chat.whatsapp.com/…";

export interface CompanyWhatsappLink {
  company_id: string;
  company_name: string;
  invite_url: string | null;
  updated_at: string | null;
  updated_by_name: string | null;
  can_edit: boolean;
  has_counselor: boolean;
}

export const companyWhatsappUpdateSchema = z.object({
  company_id: companyIdSchema,
  invite_url: z
    .string()
    .trim()
    .max(200, INVALID_WHATSAPP_INVITE_MESSAGE)
    .nullable(),
});

export type CompanyWhatsappUpdateInput = z.infer<
  typeof companyWhatsappUpdateSchema
>;

const WHATSAPP_PATH_REGEX = /^\/(?:invite\/)?([A-Za-z0-9]{16,32})\/?$/;

export function normalizeWhatsappInvite(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 200) return null;
  if (/\s/.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || parsed.port) return null;
  if (parsed.hostname.toLowerCase() !== "chat.whatsapp.com") return null;

  const match = WHATSAPP_PATH_REGEX.exec(parsed.pathname);
  if (!match) return null;

  return `https://chat.whatsapp.com/${match[1]}`;
}
