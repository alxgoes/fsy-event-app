import { createAdminClient } from "@/lib/supabase/admin";
import { requireIdentity, json, serverError, pick } from "@/lib/auth/guard";
import { hasRole } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

function getDriveThumbnail(url: string): string | null {
  if (!url) return null;
  // Format: https://drive.google.com/file/d/FILE_ID/view
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w600`;
  }
  // Format: https://drive.google.com/open?id=FILE_ID or ?id=FILE_ID
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w600`;
  }
  // If it's already a direct image URL (jpg/png/webp)
  if (url.match(/\.(jpeg|jpg|png|webp|gif)($|\?)/i)) {
    return url;
  }
  return null;
}

const EDITABLE = ["title", "drive_url", "category", "visible"] as const;

export async function GET(request: Request) {
  const auth = await requireIdentity();
  if (auth.response) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get("all") === "true";
    if (all && !hasRole(auth.identity.role, "mediaManagers")) {
      return json({ error: "Somente a equipe de mídia vê fotos ocultas." }, 403);
    }

    const supabase = createAdminClient();
    let query = supabase.from("media_photos").select("*, profiles(full_name)");

    if (!all) {
      query = query.eq("visible", true);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return serverError("media.get", error);
    return json({ data: data ?? [] });
  } catch (err) {
    return serverError("media.get", err);
  }
}

export async function POST(request: Request) {
  const auth = await requireIdentity("mediaManagers");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const { title, drive_url, category, visible } = body;

    if (!title || !drive_url) {
      return json({ error: "Título e link do Google Drive são obrigatórios." }, 400);
    }

    const cleanUrl = String(drive_url).trim();
    const payload = {
      title: String(title).trim(),
      drive_url: cleanUrl,
      thumbnail_url: getDriveThumbnail(cleanUrl),
      category: category ? String(category).trim() : "Geral",
      visible: visible !== undefined ? Boolean(visible) : true,
      author_id: auth.identity.user.id,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await createAdminClient()
      .from("media_photos")
      .insert(payload)
      .select()
      .single();
    if (error) return serverError("media.post", error);
    return json({ success: true, data });
  } catch (err) {
    return serverError("media.post", err);
  }
}

export async function PUT(request: Request) {
  const auth = await requireIdentity("mediaManagers");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    if (!body?.id) return json({ error: "ID da foto é obrigatório." }, 400);

    const updates = pick(body, EDITABLE);
    if (typeof updates.drive_url === "string") {
      updates.drive_url = updates.drive_url.trim();
      updates.thumbnail_url = getDriveThumbnail(updates.drive_url as string);
    }
    if ("visible" in updates) updates.visible = Boolean(updates.visible);
    updates.updated_at = new Date().toISOString();

    const { data, error } = await createAdminClient()
      .from("media_photos")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();
    if (error) return serverError("media.put", error);
    return json({ success: true, data });
  } catch (err) {
    return serverError("media.put", err);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireIdentity("mediaManagers");
  if (auth.response) return auth.response;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return json({ error: "ID é obrigatório." }, 400);

    const { error } = await createAdminClient().from("media_photos").delete().eq("id", id);
    if (error) return serverError("media.delete", error);
    return json({ success: true });
  } catch (err) {
    return serverError("media.delete", err);
  }
}
