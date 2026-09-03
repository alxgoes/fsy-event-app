import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function matchesCompany(target: string | null | undefined, comp: { id: string; name: string }): boolean {
  if (!target) return false;
  const t = target.trim().toLowerCase().replace(/[\s\-_]/g, "");
  const idNorm = comp.id.trim().toLowerCase().replace(/[\s\-_]/g, "");
  const nameNorm = comp.name.trim().toLowerCase().replace(/[\s\-_]/g, "");

  if (t === idNorm || t === nameNorm) return true;
  if (nameNorm.includes(t) || t.includes(idNorm) || idNorm.includes(t)) return true;

  const targetNum = target.replace(/\D/g, "");
  const compNum = comp.id.replace(/\D/g, "");
  if (targetNum && compNum && targetNum === compNum) return true;

  return false;
}

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [companiesRes, profilesRes, medicalRes] = await Promise.all([
      supabase
        .from("companies")
        .select("*")
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name, role, company_id, phone, avatar_url")
        .order("full_name", { ascending: true }),
      supabase
        .from("medical_records")
        .select("id, full_name, company_id, emergency_contact_name"),
    ]);

    if (companiesRes.error) {
      return NextResponse.json(
        { error: companiesRes.error.message },
        { status: 500 }
      );
    }

    const companies = companiesRes.data ?? [];
    const profiles = profilesRes.data ?? [];
    const medicalRecords = medicalRes.data ?? [];

    const counselorsList = profiles.filter((p) => p.role === "consultor");

    // Enrich each company with counts and detailed counselor objects
    const enrichedCompanies = companies.map((comp) => {
      const matchedProfileYouth = profiles.filter(
        (p) => p.role === "jovem" && matchesCompany(p.company_id, comp)
      );

      const matchedMedicalYouth = medicalRecords.filter(
        (m) =>
          m.emergency_contact_name !== "A registrar" &&
          matchesCompany(m.company_id, comp)
      );

      const uniqueYouthSet = new Set<string>();
      matchedProfileYouth.forEach((p) =>
        uniqueYouthSet.add((p.full_name || p.id).trim().toLowerCase())
      );
      matchedMedicalYouth.forEach((m) => {
        if (m.full_name) {
          uniqueYouthSet.add(m.full_name.trim().toLowerCase());
        }
      });

      const counselorsInComp = profiles.filter(
        (p) => p.role === "consultor" && matchesCompany(p.company_id, comp)
      );

      return {
        ...comp,
        youth_count: uniqueYouthSet.size,
        counselor_profiles: counselorsInComp,
        counselors:
          counselorsInComp.length > 0
            ? counselorsInComp.map((c) => c.full_name)
            : comp.counselors ?? [],
      };
    });

    return NextResponse.json(
      {
        companies: enrichedCompanies,
        all_counselors: counselorsList,
        all_profiles: profiles,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, motto, color, counselor_ids } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Nome da companhia é obrigatório." },
        { status: 400 }
      );
    }

    const companyId = (id && id.trim())
      ? id.trim().toLowerCase().replace(/\s+/g, "-")
      : `cia-${Date.now().toString().slice(-4)}`;

    const supabase = createAdminClient();

    // 1. Get counselor names if counselor_ids provided
    let counselorNames: string[] = [];
    if (Array.isArray(counselor_ids) && counselor_ids.length > 0) {
      const { data: cProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", counselor_ids);

      counselorNames = (cProfiles ?? []).map((c) => c.full_name);
    }

    // 2. Insert company
    const { data: newCompany, error: insertError } = await supabase
      .from("companies")
      .insert({
        id: companyId,
        name: name.trim(),
        motto: motto ? motto.trim() : null,
        color: color || "#007DA5",
        counselors: counselorNames,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 3. Assign counselors in profiles
    if (Array.isArray(counselor_ids) && counselor_ids.length > 0) {
      await supabase
        .from("profiles")
        .update({ company_id: companyId, updated_at: new Date().toISOString() })
        .in("id", counselor_ids);
    }

    return NextResponse.json({ success: true, company: newCompany });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, motto, color, counselor_ids } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID da companhia é obrigatório." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch counselor names if counselor_ids provided
    let counselorNames: string[] = [];
    if (Array.isArray(counselor_ids)) {
      if (counselor_ids.length > 0) {
        const { data: cProfiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", counselor_ids);

        counselorNames = (cProfiles ?? []).map((c) => c.full_name);
      }

      // Unassign counselors that were previously in this company but not in counselor_ids
      const { data: prevCounselors } = await supabase
        .from("profiles")
        .select("id")
        .eq("company_id", id)
        .eq("role", "consultor");

      const prevIds = (prevCounselors ?? []).map((c) => c.id);
      const toRemove = prevIds.filter((pId) => !counselor_ids.includes(pId));

      if (toRemove.length > 0) {
        await supabase
          .from("profiles")
          .update({ company_id: null, updated_at: new Date().toISOString() })
          .in("id", toRemove);
      }

      // Assign new counselors
      if (counselor_ids.length > 0) {
        await supabase
          .from("profiles")
          .update({ company_id: id, updated_at: new Date().toISOString() })
          .in("id", counselor_ids);
      }
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (motto !== undefined) updates.motto = motto ? motto.trim() : null;
    if (color !== undefined) updates.color = color;
    if (Array.isArray(counselor_ids)) updates.counselors = counselorNames;

    const { data: updatedCompany, error: updateError } = await supabase
      .from("companies")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If motto was updated and author info provided, record in counselor audit logs
    if (motto !== undefined && body.author_name) {
      try {
        await supabase.from("counselor_audit_logs").insert({
          author_id: body.author_id || null,
          author_name: body.author_name,
          author_role: body.author_role || "consultor",
          company_id: id,
          company_name: updatedCompany?.name || id,
          action_type: "atualizou_grito_de_guerra",
          action_label: "Lema / Grito de Guerra Atualizado",
          title: "Novo Lema / Grito de Guerra da Companhia",
          content: motto ? String(motto).trim() : "(Lema removido)",
          details: {
            previous_motto: body.previous_motto || null,
          },
          created_at: new Date().toISOString(),
        });
      } catch (auditErr) {
        console.error("Non-fatal: Failed to write audit log on motto update:", auditErr);
      }
    }

    return NextResponse.json({ success: true, company: updatedCompany });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID da companhia é obrigatório." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Unassign all users from this company
    await supabase
      .from("profiles")
      .update({ company_id: null, updated_at: new Date().toISOString() })
      .eq("company_id", id);

    // 2. Delete company
    const { error: deleteError } = await supabase
      .from("companies")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
