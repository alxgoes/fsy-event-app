import { z } from "zod";

/**
 * Foto de perfil com moderação. O jovem envia; a foto fica "em análise" até o
 * consultor da companhia dele (ou a coordenação) aprovar. Nada é publicado antes disso.
 *
 * Contrato HTTP (site e app nativo, cookie ou Bearer):
 *   GET    /api/profile/photo                 → ProfilePhotoState (da própria pessoa)
 *   POST   /api/profile/photo  (multipart, campo "file") → ProfilePhotoState
 *   DELETE /api/profile/photo?scope=pending|approved → ProfilePhotoState
 *   GET    /api/profile/photo/reviews         → { data: ProfilePhotoReview[] }   (consultor e gestão)
 *   POST   /api/profile/photo/reviews  { user_id, decision, note? } → { success: true }
 */

export const PROFILE_PHOTO_BUCKET = "profile-photos";
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ProfilePhotoType = (typeof PROFILE_PHOTO_TYPES)[number];

export const PROFILE_PHOTO_STATUSES = ["none", "pending", "approved", "rejected"] as const;
export type ProfilePhotoStatus = (typeof PROFILE_PHOTO_STATUSES)[number];

/** Prefixo gravado em profiles.avatar_url quando a foto aprovada está no armazenamento privado. */
export const STORED_AVATAR_PREFIX = `${PROFILE_PHOTO_BUCKET}/`;

export interface ProfilePhotoState {
  status: ProfilePhotoStatus;
  /** Foto visível para os outros (assinada, expira em ~1 h). */
  approved_url: string | null;
  /** Foto aguardando análise; só a própria pessoa e quem modera enxergam. */
  pending_url: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  /** Motivo informado quando a foto não foi aprovada. */
  review_note: string | null;
}

export interface ProfilePhotoReview {
  user_id: string;
  full_name: string;
  company_id: string | null;
  company_name: string | null;
  pending_url: string;
  current_url: string | null;
  submitted_at: string;
}

export const profilePhotoReviewSchema = z
  .object({
    user_id: z.string().uuid("Pessoa inválida."),
    decision: z.enum(["approve", "reject"], { message: "Decisão inválida." }),
    note: z.string().trim().max(280, "Use até 280 caracteres.").optional(),
  })
  .refine((v) => v.decision === "approve" || (v.note?.length ?? 0) >= 3, {
    message: "Explique em poucas palavras por que a foto não foi aprovada.",
    path: ["note"],
  });

export type ProfilePhotoReviewInput = z.infer<typeof profilePhotoReviewSchema>;

/** Identifica o formato pelos primeiros bytes; o tipo enviado pelo navegador não é confiável. */
export function sniffImageType(bytes: Uint8Array): ProfilePhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export const PROFILE_PHOTO_EXTENSION: Record<ProfilePhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
