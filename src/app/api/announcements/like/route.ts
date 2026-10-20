import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError } from "@/lib/auth/guard";
import { likeAnnouncementSchema } from "@/types/announcements";

export const dynamic = "force-dynamic";

/** Alterna a curtida da pessoa autenticada. Uma linha por pessoa e comunicado. */
export async function POST(request: Request) {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  const userId = auth.identity.user.id;
  try {
    const parsed = likeAnnouncementSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "ID do comunicado inválido." }, 400);
    const { announcement_id } = parsed.data;

    const supabase = createAdminClient();
    const { data: existing, error: readError } = await supabase
      .from("announcement_likes")
      .select("announcement_id")
      .eq("announcement_id", announcement_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) return serverError("likes.read", readError);

    const write = existing
      ? await supabase.from("announcement_likes").delete().eq("announcement_id", announcement_id).eq("user_id", userId)
      : await supabase.from("announcement_likes").upsert({ announcement_id, user_id: userId }, { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
    if (write.error) {
      if (write.error.code === "23503") return json({ error: "Comunicado não encontrado." }, 404);
      return serverError("likes.write", write.error);
    }

    const { count, error: countError } = await supabase
      .from("announcement_likes")
      .select("announcement_id", { count: "exact", head: true })
      .eq("announcement_id", announcement_id);
    if (countError) return serverError("likes.count", countError);

    return json({ success: true, is_liked: !existing, likes_count: count ?? 0 });
  } catch (err) {
    return serverError("likes", err);
  }
}
