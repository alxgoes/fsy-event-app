import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("company_id");

    const supabase = createAdminClient();
    let query = supabase
      .from("announcements")
      .select("id, title, content, priority, target_company_id, category, created_at, author_id, profiles(full_name, role)")
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.or(`target_company_id.eq.${companyId},target_company_id.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const parsed = (data ?? []).map((item) => {
      const rawCategory = item.category || "Geral";
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

      return {
        ...item,
        category: baseCategory,
        liked_by: likedBy,
        likes_count: likedBy.length,
      };
    });

    return NextResponse.json(
      { data: parsed },
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
    const { title, content, priority, target_company_id, category, author_id } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: "Título e conteúdo são obrigatórios." },
        { status: 400 }
      );
    }

    const payload = {
      title: String(title).trim(),
      content: String(content).trim(),
      priority: priority || "normal",
      target_company_id: target_company_id || null,
      category: category || "Geral",
      author_id: author_id || null,
      updated_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("announcements")
      .insert(payload)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "ID do comunicado é obrigatório." }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("announcements")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch {
        // query param is fine
      }
    }

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
