import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { likeAnnouncementSchema } from "@/lib/validations/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = likeAnnouncementSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "ID do comunicado inválido." },
        { status: 400 }
      );
    }
    const { announcement_id } = parseResult.data;
    const user_id = body.user_id || "anonymous-user";

    const supabase = createAdminClient();

    // 1. Fetch current announcement
    const { data: ann, error: fetchErr } = await supabase
      .from("announcements")
      .select("id, category")
      .eq("id", announcement_id)
      .single();

    if (fetchErr || !ann) {
      return NextResponse.json({ error: "Comunicado não encontrado." }, { status: 404 });
    }

    // 2. Parse category and liked_by
    const rawCategory = ann.category || "Geral";
    let baseCategory = rawCategory;
    let likedBy: string[] = [];

    if (rawCategory.includes("__LIKES__")) {
      const parts = rawCategory.split("__LIKES__");
      baseCategory = parts[0] || "Geral";
      try {
        likedBy = JSON.parse(parts[1]) || [];
        if (!Array.isArray(likedBy)) likedBy = [];
      } catch {
        likedBy = [];
      }
    }

    // 3. Toggle user_id
    const uid = String(user_id).trim();
    const existingIndex = likedBy.indexOf(uid);
    let isLiked = false;

    if (existingIndex >= 0) {
      likedBy.splice(existingIndex, 1);
      isLiked = false;
    } else {
      likedBy.push(uid);
      isLiked = true;
    }

    // 4. Update announcement with new category payload
    const updatedCategory = `${baseCategory}__LIKES__${JSON.stringify(likedBy)}`;

    const { error: updateErr } = await supabase
      .from("announcements")
      .update({
        category: updatedCategory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", announcement_id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_liked: isLiked,
      likes_count: likedBy.length,
      liked_by: likedBy,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
