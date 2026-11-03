import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { isSameOriginRequest } from "@/lib/security/origin";
import { createRateLimiter } from "@/lib/security/rate-limit";
import {
  PHOTO_COLUMNS,
  photoStateOf,
  photoRequiresApproval,
  removePhotoPaths,
  storedAvatarPath,
  type PhotoProfileRow,
} from "@/lib/profile-photo/server";
import {
  PROFILE_PHOTO_BUCKET,
  PROFILE_PHOTO_EXTENSION,
  PROFILE_PHOTO_MAX_BYTES,
  sniffImageType,
  STORED_AVATAR_PREFIX,
} from "@/types/profile-photo";

export const dynamic = "force-dynamic";

const uploads = createRateLimiter({ limit: 6, windowMs: 60 * 60 * 1000 });

async function loadOwn(userId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select(PHOTO_COLUMNS).eq("id", userId).single();
  return { admin, row: data as PhotoProfileRow | null, error };
}

/** Situação da foto da própria pessoa. */
export async function GET() {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  try {
    const { admin, row, error } = await loadOwn(auth.identity.user.id);
    if (error || !row) return serverError("profile-photo.read", error);
    return json(await photoStateOf(admin, row));
  } catch (err) {
    return serverError("profile-photo.read", err);
  }
}

/** Só jovens aguardam análise; os demais cargos publicam a própria foto imediatamente. */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Origem não permitida." }, 403);
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  const userId = auth.identity.user.id;
  if (!uploads.hit(userId)) {
    return json({ error: "Muitos envios em pouco tempo. Tente de novo mais tarde." }, 429);
  }

  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof Blob) || file.size === 0) return json({ error: "Escolha uma foto para enviar." }, 400);
    if (file.size > PROFILE_PHOTO_MAX_BYTES) return json({ error: "A foto precisa ter até 5 MB." }, 413);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) return json({ error: "Use uma foto JPG, PNG ou WebP." }, 415);

    const { admin, row, error } = await loadOwn(userId);
    if (error || !row) return serverError("profile-photo.upload.read", error);

    const moderated = photoRequiresApproval(row.role);
    const path = `${moderated ? "pending" : "approved"}/${userId}/${randomUUID()}.${PROFILE_PHOTO_EXTENSION[type]}`;
    const upload = await admin.storage.from(PROFILE_PHOTO_BUCKET).upload(path, bytes, { contentType: type, upsert: false });
    if (upload.error) return serverError("profile-photo.upload.storage", upload.error);

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update({
        ...(moderated ? {} : { avatar_url: `${STORED_AVATAR_PREFIX}${path}` }),
        avatar_status: moderated ? "pending" : "approved",
        avatar_pending_path: moderated ? path : null,
        avatar_submitted_at: new Date().toISOString(),
        avatar_reviewed_at: moderated ? null : new Date().toISOString(),
        avatar_reviewed_by: null,
        avatar_review_note: null,
      })
      .eq("id", userId)
      // A condição é revalidada pelo Postgres após esperar qualquer alteração concorrente.
      // Uma demissão para jovem entre a leitura e a gravação não publica a foto direta.
      .eq("role", row.role)
      .select(PHOTO_COLUMNS)
      .single();
    if (updateError || !updated) {
      await removePhotoPaths(admin, [path]);
      if (!updateError || updateError.code === "PGRST116") {
        return json({ error: "Seu perfil mudou durante o envio. Atualize a página e tente novamente." }, 409);
      }
      return serverError("profile-photo.upload.update", updateError);
    }

    // A foto anterior que ainda aguardava análise deixa de existir.
    if (row.avatar_pending_path && row.avatar_pending_path !== path) await removePhotoPaths(admin, [row.avatar_pending_path]);
    if (!moderated) await removePhotoPaths(admin, [storedAvatarPath(row.avatar_url)]);

    return json(await photoStateOf(admin, updated as PhotoProfileRow), 201);
  } catch (err) {
    return serverError("profile-photo.upload", err);
  }
}

/** Cancela o envio em análise (scope=pending) ou remove a foto publicada (scope=approved). */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Origem não permitida." }, 403);
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  const scope = new URL(request.url).searchParams.get("scope");
  if (scope !== "pending" && scope !== "approved") return json({ error: "Escolha o que remover." }, 400);

  try {
    const { admin, row, error } = await loadOwn(auth.identity.user.id);
    if (error || !row) return serverError("profile-photo.delete.read", error);

    const moderated = photoRequiresApproval(row.role);
    const patch = !moderated && scope === "approved"
      ? { avatar_url: null, avatar_status: "none", avatar_pending_path: null, avatar_submitted_at: null,
          avatar_reviewed_at: null, avatar_reviewed_by: null, avatar_review_note: null }
      :
      scope === "pending"
        ? { avatar_status: row.avatar_url ? "approved" : "none", avatar_pending_path: null, avatar_submitted_at: null }
        : { avatar_url: null, avatar_status: row.avatar_status === "pending" ? "pending" : "none" };
    let deletion = admin
      .from("profiles")
      .update(patch)
      .eq("id", row.id)
      .eq("role", row.role);
    const column = scope === "pending" ? "avatar_pending_path" : "avatar_url";
    const expected = scope === "pending" ? row.avatar_pending_path : row.avatar_url;
    deletion = expected ? deletion.eq(column, expected) : deletion.is(column, null);
    const { data: updated, error: updateError } = await deletion.select(PHOTO_COLUMNS).single();
    if (updateError || !updated) {
      if (!updateError || updateError.code === "PGRST116") return json({ error: "A foto mudou durante a operação. Atualize a página e tente novamente." }, 409);
      return serverError("profile-photo.delete.update", updateError);
    }

    await removePhotoPaths(admin, scope === "pending" ? [row.avatar_pending_path]
      : [storedAvatarPath(row.avatar_url), ...(!moderated ? [row.avatar_pending_path] : [])]);
    return json(await photoStateOf(admin, updated as PhotoProfileRow));
  } catch (err) {
    return serverError("profile-photo.delete", err);
  }
}
