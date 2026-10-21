import { createAdminClient } from "@/lib/supabase/admin";
import { json, requireIdentity, serverError } from "@/lib/auth/guard";
import type { AdminOverview } from "@/types/native-auth";

export const dynamic = "force-dynamic";

/** Métricas da visão geral do painel (as mesmas do painel web), só contagens: nenhum dado de saúde. */
export async function GET() {
  const auth = await requireIdentity("auditReaders");
  if (auth.response) return auth.response;
  try {
    const db = createAdminClient();
    const [profiles, companies, medical, announcements, photos] = await Promise.all([
      db.from("profiles").select("role, company_id, room"),
      db.from("companies").select("id", { count: "exact", head: true }),
      db.from("medical_records").select("id", { count: "exact", head: true }),
      db.from("announcements")
        .select("id, title, priority, category, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(4),
      db.from("media_photos").select("id", { count: "exact", head: true }),
    ]);
    const error = profiles.error || companies.error || medical.error || announcements.error || photos.error;
    if (error) return serverError("admin.overview", error);

    const rows = (profiles.data ?? []) as { role: string | null; company_id: string | null; room: string | null }[];
    const youth = rows.filter((row) => !row.role || row.role === "jovem");
    const body: AdminOverview = {
      total_youth: youth.length,
      youth_with_company: youth.filter((row) => row.company_id).length,
      youth_with_room: youth.filter((row) => row.room).length,
      total_companies: companies.count ?? 0,
      total_counselors: rows.filter((row) => row.role === "consultor").length,
      medical_records: medical.count ?? 0,
      total_announcements: announcements.count ?? 0,
      total_photos: photos.count ?? 0,
      recent_announcements: (announcements.data ?? []) as AdminOverview["recent_announcements"],
      generated_at: new Date().toISOString(),
    };
    return json(body);
  } catch (error) {
    return serverError("admin.overview", error);
  }
}
