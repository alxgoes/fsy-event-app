import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserAndRole } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = ["casal_diretor", "coordenador", "logistica"];

export interface CounselorAuditLog {
  id: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  company_id: string | null;
  company_name: string | null;
  action_type: string;
  action_label: string;
  title: string | null;
  content: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(request: Request) {
  try {
    const { user, role } = await getCurrentUserAndRole();
    if (!user) {
      return NextResponse.json(
        { error: "Acesso não autorizado. Sessão necessária." },
        { status: 401 }
      );
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Acesso negado aos registros de auditoria." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.toLowerCase().trim();
    const companyId = searchParams.get("company_id");
    const actionType = searchParams.get("action_type");

    const supabase = createAdminClient();

    let query = supabase
      .from("counselor_audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (companyId && companyId !== "all") {
      query = query.eq("company_id", companyId);
    }

    if (actionType && actionType !== "all") {
      query = query.eq("action_type", actionType);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist yet in Supabase, return empty array without crashing
      if (
        error.code === "42P01" ||
        error.code === "PGRST204" ||
        error.code === "PGRST205" ||
        error.message?.toLowerCase().includes("schema cache") ||
        error.message?.toLowerCase().includes("could not find the table") ||
        error.message?.includes("does not exist")
      ) {
        return NextResponse.json({
          data: [],
          tablePending: true,
          notice: "Tabela counselor_audit_logs pendente de criação no Supabase.",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let logs: CounselorAuditLog[] = data || [];

    if (search) {
      logs = logs.filter(
        (log) =>
          log.author_name?.toLowerCase().includes(search) ||
          log.title?.toLowerCase().includes(search) ||
          log.content?.toLowerCase().includes(search) ||
          log.company_name?.toLowerCase().includes(search)
      );
    }

    return NextResponse.json(
      { data: logs },
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
    const { user, role: callerRole } = await getCurrentUserAndRole();
    if (!user) {
      return NextResponse.json(
        { error: "Acesso não autorizado. Sessão necessária." },
        { status: 401 }
      );
    }

    const ALLOWED_POST_ROLES = [...ALLOWED_ROLES, "consultor"];
    if (!callerRole || !ALLOWED_POST_ROLES.includes(callerRole)) {
      return NextResponse.json(
        { error: "Acesso negado para registrar auditoria." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      company_id,
      company_name,
      action_type,
      action_label,
      title,
      content,
      details,
    } = body;

    const author_id = user.id;
    const author_role = callerRole;
    const author_name = body.author_name ? String(body.author_name).trim() : (user.email?.split("@")[0] || "Consultor");

    if (!author_name || !content) {
      return NextResponse.json(
        { error: "Nome do autor e conteúdo da alteração são obrigatórios." },
        { status: 400 }
      );
    }

    const payload = {
      author_id,
      author_name,
      author_role,
      company_id: company_id || null,
      company_name: company_name || null,
      action_type: action_type || "publicou_comunicado",
      action_label: action_label || "Novo Comunicado Publicado",
      title: title ? String(title).trim() : null,
      content: String(content).trim(),
      details: details || {},
      created_at: new Date().toISOString(),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("counselor_audit_logs")
      .insert(payload)
      .select()
      .single();

    if (error) {
      // If table doesn't exist yet, return soft success with error info
      if (
        error.code === "42P01" ||
        error.code === "PGRST204" ||
        error.code === "PGRST205" ||
        error.message?.toLowerCase().includes("schema cache") ||
        error.message?.toLowerCase().includes("could not find the table") ||
        error.message?.includes("does not exist")
      ) {
        return NextResponse.json({
          success: true,
          data: payload,
          warning: "Audit log table not yet migrated in Supabase.",
        });
      }
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
    const { user, role: callerRole } = await getCurrentUserAndRole();
    if (!user) {
      return NextResponse.json(
        { error: "Acesso não autorizado. Sessão necessária." },
        { status: 401 }
      );
    }

    // Strictly enforce server-side role check
    if (!callerRole || !ALLOWED_ROLES.includes(callerRole)) {
      return NextResponse.json(
        { error: "Apenas Casal Diretor, Casal Logística e Coordenadores podem excluir o histórico." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const isAll = searchParams.get("all") === "true";

    const supabase = createAdminClient();

    if (isAll) {
      // Wipe all counselor audit logs
      const { error } = await supabase
        .from("counselor_audit_logs")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Deletes all rows

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: "Todo o histórico de consultores foi apagado com sucesso.",
      });
    }

    if (!id) {
      return NextResponse.json(
        { error: "ID do registro ou parâmetro all=true é obrigatório." },
        { status: 400 }
      );
    }

    // Delete single entry
    const { error } = await supabase
      .from("counselor_audit_logs")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Registro de auditoria removido com sucesso.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
