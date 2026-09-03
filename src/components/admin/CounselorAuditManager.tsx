"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Clock,
  Building2,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  Database,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile, isMasterAdmin, ROLE_LABELS } from "@/lib/supabase/useProfile";
import { CounselorAuditLog } from "@/app/api/admin/counselor-audit/route";

interface CompanyOption {
  id: string;
  name: string;
  color: string;
}

const COUNSELOR_AUDIT_SQL = `-- 10. Counselor Audit Logs Table (Auditoria dos Consultores)
CREATE TABLE IF NOT EXISTS public.counselor_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT 'consultor',
    company_id TEXT,
    company_name TEXT,
    action_type TEXT NOT NULL,
    action_label TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_counselor_audit_created_at ON public.counselor_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_counselor_audit_author_name ON public.counselor_audit_logs(author_name);
CREATE INDEX IF NOT EXISTS idx_counselor_audit_company_id ON public.counselor_audit_logs(company_id);

ALTER TABLE public.counselor_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors, Coordinators and Logistics can view counselor audit logs" ON public.counselor_audit_logs;
CREATE POLICY "Directors, Coordinators and Logistics can view counselor audit logs"
    ON public.counselor_audit_logs FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('coordenador', 'casal_diretor', 'logistica'));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.counselor_audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
    ON public.counselor_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Directors, Coordinators and Logistics can delete counselor audit logs" ON public.counselor_audit_logs;
CREATE POLICY "Directors, Coordinators and Logistics can delete counselor audit logs"
    ON public.counselor_audit_logs FOR DELETE
    TO authenticated
    USING (public.get_auth_role() IN ('coordenador', 'casal_diretor', 'logistica'));`;

export function CounselorAuditManager() {
  const { profile, loading: profileLoading } = useProfile();
  const shouldReduceMotion = useReducedMotion();

  const [logs, setLogs] = useState<CounselorAuditLog[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Table pending setup in Supabase state
  const [tablePending, setTablePending] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedAction, setSelectedAction] = useState("all");

  // Deletion modals state
  const [logToDelete, setLogToDelete] = useState<CounselorAuditLog | null>(null);
  const [deletingSingleId, setDeletingSingleId] = useState<string | null>(null);
  const [isWipingAll, setIsWipingAll] = useState(false);
  const [wipingAllLoading, setWipingAllLoading] = useState(false);

  const isAuthorized = profile && isMasterAdmin(profile.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch companies for the filter
      const compRes = await fetch(`/api/companies?_t=${Date.now()}`);
      if (compRes.ok) {
        const compJson = await compRes.json();
        setCompanies(
          (compJson.data ?? []).map((c: { id: string; name: string; color: string }) => ({
            id: c.id,
            name: c.name,
            color: c.color || "#007DA5",
          }))
        );
      }

      // 2. Fetch audit logs
      const url = new URL("/api/admin/counselor-audit", window.location.origin);
      if (selectedCompany !== "all") url.searchParams.set("company_id", selectedCompany);
      if (selectedAction !== "all") url.searchParams.set("action_type", selectedAction);
      if (searchTerm.trim()) url.searchParams.set("search", searchTerm.trim());
      url.searchParams.set("_t", Date.now().toString());

      const res = await fetch(url.toString());
      const json = await res.json();

      if (json.tablePending) {
        setTablePending(true);
        setLogs([]);
        return;
      }

      setTablePending(false);
      setLogs(json.data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, selectedAction, searchTerm]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(COUNSELOR_AUDIT_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  useEffect(() => {
    if (!profileLoading && isAuthorized) {
      loadData();
    }
  }, [profileLoading, isAuthorized, loadData]);

  // Single Item Delete
  const handleDeleteSingle = async () => {
    if (!logToDelete || !profile) return;
    setDeletingSingleId(logToDelete.id);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/counselor-audit?id=${encodeURIComponent(logToDelete.id)}&role=${profile.role}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Erro ao excluir registro.");
      }

      setLogToDelete(null);
      setSuccessMessage("Registro removido com sucesso do histórico.");
      setTimeout(() => setSuccessMessage(null), 3500);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir registro.";
      setError(msg);
    } finally {
      setDeletingSingleId(null);
    }
  };

  // Bulk Wipe All Records
  const handleWipeAll = async () => {
    if (!profile) return;
    setWipingAllLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/counselor-audit?all=true&role=${profile.role}`,
        {
          method: "DELETE",
        }
      );

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Erro ao limpar histórico.");
      }

      setIsWipingAll(false);
      setSuccessMessage("Todo o histórico de consultores foi apagado com sucesso.");
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao limpar histórico.";
      setError(msg);
    } finally {
      setWipingAllLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="rounded-3xl border-2 border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-8 text-center max-w-xl mx-auto my-12">
        <ShieldAlert className="h-12 w-12 text-red-600 mx-auto mb-3" />
        <h2 className="font-serif text-2xl font-bold text-red-950 dark:text-red-200">
          Acesso Restrito à Liderança
        </h2>
        <p className="text-sm text-red-800 dark:text-red-300 mt-2">
          Esta funcionalidade de auditoria e exclusão de histórico é reservada exclusivamente para o{" "}
          <strong>Casal Diretor</strong>, <strong>Casal Logística</strong> e <strong>Coordenadores</strong>.
        </p>
      </div>
    );
  }

  // Calculate Metrics
  const totalLogs = logs.length;
  const publishedCount = logs.filter((l) => l.action_type === "publicou_comunicado").length;
  const deletedCount = logs.filter((l) => l.action_type === "excluiu_comunicado").length;
  const uniqueAuthors = new Set(logs.map((l) => l.author_name)).size;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FC4E6D] via-[#D45311] to-[#FFB81C] text-white border-2 border-slate-900 dark:border-slate-700 shadow-sm shrink-0">
              <ShieldAlert className="h-7 w-7" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-md bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-black text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-600" />
                  Auditoria & Transparência
                </span>
                <span className="rounded-md bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-xs font-black text-[#007DA5] dark:text-cyan-300 border border-sky-200 dark:border-sky-800">
                  Casal Diretor · Logística · Coordenadores
                </span>
              </div>

              <h1 className="font-heading text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                Histórico & Auditoria dos Consultores
              </h1>

              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
                Registro de todas as postagens, comunicados e alterações realizadas na área dos consultores.
                Permite acompanhar quem publicou, o que foi colocado, o dia e o horário exatos para manter
                a ordem e integridade da sessão.
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 px-3.5 py-2 text-xs font-black shadow-sm hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors min-h-[38px] cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#007DA5]" : ""}`} />
              <span>Atualizar</span>
            </button>

            {totalLogs > 0 && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsWipingAll(true)}
                className="rounded-2xl border-2 border-slate-900 font-black text-xs px-4 py-2 shadow-sm min-h-[38px] cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Limpar Todo o Histórico</span>
              </Button>
            )}
          </div>
        </div>

        {/* Setup Banner when table is pending in Supabase */}
        {tablePending && (
          <div className="mt-4 p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Database className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-heading text-sm sm:text-base font-black text-amber-950 dark:text-amber-200">
                    Ativação da Tabela no Supabase
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 max-w-xl leading-relaxed">
                    Para habilitar o salvamento automático e a persistência das alterações dos consultores,
                    basta executar o script SQL no <strong>SQL Editor</strong> do painel Supabase. Leva menos de 10 segundos!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm transition-colors cursor-pointer min-h-[38px]"
                >
                  {copiedSql ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span>{copiedSql ? "SQL Copiado!" : "Copiar Script SQL"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSql(!showSql)}
                  className="px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-bold text-xs hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer min-h-[38px]"
                >
                  {showSql ? "Ocultar" : "Ver Código"}
                </button>
              </div>
            </div>

            {showSql && (
              <div className="mt-4">
                <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto max-h-56 border border-slate-700 leading-relaxed shadow-inner">
                  {COUNSELOR_AUDIT_SQL}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Feedback Alerts */}
        {!tablePending && error && (
          <div className="mt-4 p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border-2 border-red-300 dark:border-red-900 text-xs font-bold text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-900 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Metrics Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 block">
            Total de Registros
          </span>
          <div className="font-heading text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {totalLogs}
          </div>
          <span className="text-[11px] font-bold text-slate-400 mt-1 block">
            Alterações rastreadas
          </span>
        </div>

        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <span className="text-[11px] font-black uppercase text-[#007DA5] dark:text-cyan-400 block">
            Comunicados Enviados
          </span>
          <div className="font-heading text-2xl sm:text-3xl font-black text-[#007DA5] dark:text-cyan-400 mt-1">
            {publishedCount}
          </div>
          <span className="text-[11px] font-bold text-slate-400 mt-1 block">
            Publicações no mural
          </span>
        </div>

        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <span className="text-[11px] font-black uppercase text-red-600 dark:text-red-400 block">
            Avisos Excluídos
          </span>
          <div className="font-heading text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400 mt-1">
            {deletedCount}
          </div>
          <span className="text-[11px] font-bold text-slate-400 mt-1 block">
            Preservados no histórico
          </span>
        </div>

        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm">
          <span className="text-[11px] font-black uppercase text-purple-600 dark:text-purple-400 block">
            Consultores Ativos
          </span>
          <div className="font-heading text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {uniqueAuthors}
          </div>
          <span className="text-[11px] font-bold text-slate-400 mt-1 block">
            Com ações registradas
          </span>
        </div>
      </div>

      {/* 3. Toolbar: Search and Filters */}
      <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por nome do consultor, título ou palavras do comunicado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-2xl border-2 border-slate-900/40 dark:border-slate-700 text-xs font-bold"
          />
        </div>

        {/* Company Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-3 py-2 rounded-2xl border-2 border-slate-900/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="all">Todas as Companhias</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Action Type Filter */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="px-3 py-2 rounded-2xl border-2 border-slate-900/40 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
          >
            <option value="all">Todas as Ações</option>
            <option value="publicou_comunicado">Publicações</option>
            <option value="excluiu_comunicado">Exclusões</option>
          </select>
        </div>
      </div>

      {/* 4. Log Entries Feed */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-[#007DA5]" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <ShieldAlert className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          <h3 className="font-heading text-lg font-black text-slate-800 dark:text-slate-200">
            Nenhum registro encontrado no histórico
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Assim que os consultores publicarem avisos ou fizerem alterações em suas companhias, todas as
            ações serão registradas automaticamente aqui com nome, conteúdo e carimbo de data/hora.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {logs.map((log) => {
            const isDelete = log.action_type === "excluiu_comunicado";
            const initial = log.author_name?.charAt(0)?.toUpperCase() ?? "C";
            const createdDate = new Date(log.created_at);

            const formattedDate = createdDate.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });

            const formattedTime = createdDate.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <motion.div
                key={log.id}
                whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                className={`rounded-3xl border-2 p-5 bg-white dark:bg-slate-900 shadow-sm transition-all ${
                  isDelete
                    ? "border-red-300 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20"
                    : "border-slate-900 dark:border-slate-700"
                }`}
              >
                {/* Header of Entry */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  {/* Author Information */}
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#007DA5] text-white font-black text-sm shadow-xs shrink-0">
                      {initial}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-heading text-sm font-black text-slate-900 dark:text-white">
                          {log.author_name}
                        </span>
                        <span className="rounded-md bg-sky-100 dark:bg-sky-950 px-2 py-0.5 text-[10px] font-black uppercase text-[#007DA5] dark:text-cyan-300 border border-sky-200 dark:border-sky-800">
                          {ROLE_LABELS[log.author_role as keyof typeof ROLE_LABELS] || log.author_role}
                        </span>
                        {log.company_name && (
                          <span className="rounded-md bg-purple-100 dark:bg-purple-950 px-2 py-0.5 text-[10px] font-black text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {log.company_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Badge & Timestamp */}
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap self-start sm:self-auto">
                    <span
                      className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-black uppercase border ${
                        isDelete
                          ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800"
                          : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                      }`}
                    >
                      {isDelete ? (
                        <Trash2 className="h-3.5 w-3.5" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      <span>{log.action_label || (isDelete ? "Removido" : "Publicado")}</span>
                    </span>

                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
                      <Clock className="h-3.5 w-3.5 text-[#007DA5]" />
                      <span>
                        {formattedDate} às {formattedTime}
                      </span>
                    </span>

                    {/* Delete single log button */}
                    <button
                      type="button"
                      onClick={() => setLogToDelete(log)}
                      title="Apagar este registro do histórico"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Content Box ("o que essa pessoa colocou") */}
                <div className="mt-3.5">
                  {log.title && (
                    <h4 className="font-heading text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
                      <span>{log.title}</span>
                    </h4>
                  )}

                  <div className="rounded-2xl bg-[#FAF8F5] dark:bg-slate-850 p-4 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 whitespace-pre-line leading-relaxed shadow-inner">
                    {log.content}
                  </div>
                </div>

                {/* Meta details footer */}
                {log.details && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      {Boolean(log.details.priority) && (
                        <span>
                          Prioridade:{" "}
                          <strong className="text-slate-900 dark:text-white uppercase">
                            {String(log.details.priority)}
                          </strong>
                        </span>
                      )}
                      {Boolean(log.details.category) && (
                        <span>
                          Categoria:{" "}
                          <strong className="text-slate-900 dark:text-white">
                            {String(log.details.category)}
                          </strong>
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-slate-400">
                      ID de Auditoria: <code className="text-[10px]">{log.id.slice(0, 8)}</code>
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Delete Single Log Confirmation */}
      <Dialog open={!!logToDelete} onOpenChange={(open) => !open && setLogToDelete(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-black text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Apagar Registro de Auditoria
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Tem certeza que deseja apagar o registro da alteração feita por{" "}
              <strong>{logToDelete?.author_name}</strong> em{" "}
              <strong>
                {logToDelete ? new Date(logToDelete.created_at).toLocaleString("pt-BR") : ""}
              </strong>
              ? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLogToDelete(null)}
              className="rounded-2xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDeleteSingle}
              disabled={!!deletingSingleId}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
            >
              {deletingSingleId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Apagando...
                </>
              ) : (
                "Sim, Apagar Registro"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Wipe All Logs Confirmation */}
      <Dialog open={isWipingAll} onOpenChange={(open) => !open && setIsWipingAll(false)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-2 border-red-600 bg-white dark:bg-slate-900 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-black text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Limpar TODO o Histórico de Auditoria?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              Esta ação apagará <strong>todos os {totalLogs} registros</strong> de histórico de alterações
              dos consultores de uma só vez.
              <br />
              <br />
              Esta operação é restrita ao Casal Diretor, Casal Logística e Coordenadores e é definitiva.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsWipingAll(false)}
              className="rounded-2xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleWipeAll}
              disabled={wipingAllLoading}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black"
            >
              {wipingAllLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Limpando Tudo...
                </>
              ) : (
                "Sim, Limpar Todo o Histórico"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
