import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PROFILE_PHOTO_BUCKET,
  STORED_AVATAR_PREFIX,
  type ProfilePhotoState,
  type ProfilePhotoStatus,
} from "@/types/profile-photo";

const SIGNED_URL_SECONDS = 60 * 60;

export const PHOTO_COLUMNS =
  "id, full_name, role, company_id, avatar_url, avatar_status, avatar_pending_path, avatar_submitted_at, avatar_reviewed_at, avatar_review_note";

export interface PhotoProfileRow {
  id: string;
  full_name: string;
  role: string;
  company_id: string | null;
  avatar_url: string | null;
  avatar_status: ProfilePhotoStatus | null;
  avatar_pending_path: string | null;
  avatar_submitted_at: string | null;
  avatar_reviewed_at: string | null;
  avatar_review_note: string | null;
}

/** Caminho dentro do bucket quando avatar_url aponta para o armazenamento privado. */
export function storedAvatarPath(avatarUrl: string | null | undefined): string | null {
  return avatarUrl?.startsWith(STORED_AVATAR_PREFIX) ? avatarUrl.slice(STORED_AVATAR_PREFIX.length) : null;
}

export async function signPhotoPath(admin: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await admin.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return error ? null : data.signedUrl;
}

/** URL exibível da foto publicada: assinada se estiver no bucket, original se vier do Google. */
export async function resolveAvatarUrl(admin: SupabaseClient, avatarUrl: string | null | undefined) {
  if (!avatarUrl) return null;
  const path = storedAvatarPath(avatarUrl);
  if (path) return signPhotoPath(admin, path);
  return /^https:\/\//.test(avatarUrl) ? avatarUrl : null;
}

export async function photoStateOf(admin: SupabaseClient, row: PhotoProfileRow): Promise<ProfilePhotoState> {
  const [approved_url, pending_url] = await Promise.all([
    resolveAvatarUrl(admin, row.avatar_url),
    signPhotoPath(admin, row.avatar_status === "pending" ? row.avatar_pending_path : null),
  ]);
  return {
    status: row.avatar_status ?? (row.avatar_url ? "approved" : "none"),
    approved_url,
    pending_url,
    submitted_at: row.avatar_submitted_at,
    reviewed_at: row.avatar_reviewed_at,
    review_note: row.avatar_status === "rejected" ? row.avatar_review_note : null,
  };
}

export async function removePhotoPaths(admin: SupabaseClient, paths: Array<string | null | undefined>) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await admin.storage.from(PROFILE_PHOTO_BUCKET).remove(list);
}
