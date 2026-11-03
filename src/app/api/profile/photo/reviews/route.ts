import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/permissions";
import { isSameOriginRequest } from "@/lib/security/origin";
import type { Identity } from "@/lib/supabase/server";
import {
  PHOTO_COLUMNS,
  removePhotoPaths,
  resolveAvatarUrl,
  signPhotoPath,
  storedAvatarPath,
  type PhotoProfileRow,
} from "@/lib/profile-photo/server";
import {
  PROFILE_PHOTO_BUCKET,
  STORED_AVATAR_PREFIX,
  profilePhotoReviewSchema,
  type ProfilePhotoReview,
} from "@/types/profile-photo";

export const dynamic = "force-dynamic";

/**
 * Consultor modera somente a própria companhia; a gestão (MASTER) modera todas.
 * Quem não tem companhia definida (consultor sem designação) não vê nada.
 */
function reviewScope(identity: Identity) {
  if (hasRole(identity.role, "accountGuardians")) return { all: true as const };
  if (identity.role === "consultor" && identity.profile.company_id) return { all: false as const, companyId: identity.profile.company_id };
  return null;
}

export async function GET() {
  const auth = await requireIdentity("counselorPanel");
  if (auth.response) return auth.response;
  const scope = reviewScope(auth.identity);
  if (!scope) return json({ data: [] });

  try {
    const admin = createAdminClient();
    let query = admin
      .from("profiles")
      .select(PHOTO_COLUMNS)
      .eq("role", "jovem")
      .eq("avatar_status", "pending")
      .not("avatar_pending_path", "is", null)
      .order("avatar_submitted_at", { ascending: true })
      .limit(100);
    if (!scope.all) query = query.eq("company_id", scope.companyId);
    const { data, error } = await query;
    if (error) return serverError("profile-photo.reviews.list", error);

    const rows = ((data ?? []) as PhotoProfileRow[]).filter((row) => row.role === "jovem");
    const companyIds = Array.from(new Set(rows.map((r) => r.company_id).filter((id): id is string => Boolean(id))));
    const { data: companies } = companyIds.length
      ? await admin.from("companies").select("id, name").in("id", companyIds)
      : { data: [] as Array<{ id: string; name: string }> };
    const names = new Map((companies ?? []).map((c) => [c.id, c.name]));

    const reviews = await Promise.all(
      rows.map(async (row): Promise<ProfilePhotoReview | null> => {
        const pending_url = await signPhotoPath(admin, row.avatar_pending_path);
        if (!pending_url) return null;
        return {
          user_id: row.id,
          full_name: row.full_name,
          company_id: row.company_id,
          company_name: row.company_id ? names.get(row.company_id) ?? null : null,
          pending_url,
          current_url: await resolveAvatarUrl(admin, row.avatar_url),
          submitted_at: row.avatar_submitted_at ?? new Date(0).toISOString(),
        };
      })
    );
    return json({ data: reviews.filter(Boolean) });
  } catch (err) {
    return serverError("profile-photo.reviews.list", err);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ error: "Origem não permitida." }, 403);
  const auth = await requireIdentity("counselorPanel");
  if (auth.response) return auth.response;
  const scope = reviewScope(auth.identity);
  if (!scope) return json({ error: "Você ainda não tem uma companhia designada." }, 403);

  const parsed = profilePhotoReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, 400);
  const { user_id, decision, note } = parsed.data;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("profiles").select(PHOTO_COLUMNS).eq("id", user_id).maybeSingle();
    if (error) return serverError("profile-photo.review.read", error);
    const row = data as PhotoProfileRow | null;
    // Mesma resposta para "não existe" e "fora da sua companhia": não revela quem existe.
    if (!row || row.role !== "jovem" || (!scope.all && row.company_id !== scope.companyId)) {
      return json({ error: "Foto não encontrada ou já analisada." }, 404);
    }
    if (row.avatar_status !== "pending" || !row.avatar_pending_path) {
      return json({ error: "Foto não encontrada ou já analisada." }, 409);
    }

    const reviewedAt = new Date().toISOString();
    const pendingPath = row.avatar_pending_path;

    if (decision === "reject") {
      const { data: changed, error: updateError } = await updatePendingReview(admin, row, pendingPath, {
          avatar_status: "rejected",
          avatar_pending_path: null,
          avatar_reviewed_at: reviewedAt,
          avatar_reviewed_by: auth.identity.user.id,
          avatar_review_note: note ?? null,
        });
      if (updateError) return serverError("profile-photo.review.reject", updateError);
      if (!changed) return json({ error: "Foto não encontrada ou já analisada." }, 409);
      await removePhotoPaths(admin, [pendingPath]);
      return json({ success: true });
    }

    const extension = pendingPath.split(".").pop() ?? "jpg";
    const approvedPath = `approved/${row.id}/${randomUUID()}.${extension}`;
    const moved = await admin.storage.from(PROFILE_PHOTO_BUCKET).move(pendingPath, approvedPath);
    if (moved.error) return serverError("profile-photo.review.move", moved.error);

    const { data: changed, error: updateError } = await updatePendingReview(admin, row, pendingPath, {
        avatar_url: `${STORED_AVATAR_PREFIX}${approvedPath}`,
        avatar_status: "approved",
        avatar_pending_path: null,
        avatar_reviewed_at: reviewedAt,
        avatar_reviewed_by: auth.identity.user.id,
        avatar_review_note: null,
      });
    if (updateError || !changed) {
      await admin.storage.from(PROFILE_PHOTO_BUCKET).move(approvedPath, pendingPath);
      if (!updateError) return json({ error: "Foto não encontrada ou já analisada." }, 409);
      return serverError("profile-photo.review.approve", updateError);
    }

    await removePhotoPaths(admin, [storedAvatarPath(row.avatar_url)]);
    return json({ success: true });
  } catch (err) {
    return serverError("profile-photo.review", err);
  }
}

/** Não decide sobre envio novo, mudança de companhia ou promoção ocorrida depois da leitura. */
function updatePendingReview(
  admin: ReturnType<typeof createAdminClient>, row: PhotoProfileRow, pendingPath: string,
  patch: Record<string, string | null>
) {
  let query = admin.from("profiles").update(patch).eq("id", row.id).eq("role", "jovem")
    .eq("avatar_status", "pending").eq("avatar_pending_path", pendingPath);
  query = row.company_id ? query.eq("company_id", row.company_id) : query.is("company_id", null);
  return query.select("id").maybeSingle();
}
