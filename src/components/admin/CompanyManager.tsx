"use client";
import { contrastText } from "@/lib/ui/contrast";
import { startTransition } from "react";


import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  Search,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Palette,
  UserCheck,
  MessageCircle,
  ExternalLink,
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
import { CompanyWhatsappDialog } from "@/components/counselor/CompanyWhatsappDialog";
import {
  normalizeWhatsappInvite,
  type CompanyWhatsappLink,
} from "@/types/company-whatsapp";

interface CounselorProfile {
  id: string;
  full_name: string;
  role: string;
  company_id: string | null;
  phone?: string | null;
  avatar_url?: string | null;
}

interface CompanyItem {
  id: string;
  name: string;
  motto: string | null;
  color: string;
  counselors: string[];
  youth_count: number;
  counselor_profiles?: CounselorProfile[];
  created_at?: string;
  updated_at?: string;
}

const PRESET_COLORS = [
  { name: "Azul Índigo Oceânico", value: "#007DA5" },
  { name: "Coral Vivo Festivo", value: "#FC4E6D" },
  { name: "Verde FSY", value: "#93C742" },
  { name: "Ouro Solar Radiante", value: "#FFE48A" },
  { name: "Azul Profundo FSY", value: "#005E7C" },
  { name: "Laranja Solar", value: "#F77F00" },
  { name: "Ciano Marinho", value: "#4CC9F0" },
  { name: "Rubi Intenso", value: "#E63946" },
];

export function CompanyManager() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [counselors, setCounselors] = useState<CounselorProfile[]>([]);
  const [whatsappByCompany, setWhatsappByCompany] = useState<Record<string, CompanyWhatsappLink>>({});
  const [whatsappEditingCompany, setWhatsappEditingCompany] = useState<CompanyItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null);
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formMotto, setFormMotto] = useState("");
  const [formColor, setFormColor] = useState("#007DA5");
  const [selectedCounselorIds, setSelectedCounselorIds] = useState<string[]>([]);
  const [counselorSearch, setCounselorSearch] = useState("");

  // Delete confirmation
  const [companyToDelete, setCompanyToDelete] = useState<CompanyItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [res, whatsappRes] = await Promise.all([
        fetch(`/api/companies?_t=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/companies/whatsapp?_t=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      ]);

      if (!res.ok) {
        throw new Error("Falha ao carregar companhias.");
      }

      const json = await res.json();
      setCompanies(json.companies ?? []);
      setCounselors(json.all_counselors ?? []);

      if (whatsappRes && whatsappRes.ok) {
        const waJson = (await whatsappRes.json().catch(() => ({}))) as {
          data?: CompanyWhatsappLink[];
        };
        const map: Record<string, CompanyWhatsappLink> = {};
        for (const item of waJson.data ?? []) {
          if (item && item.company_id) {
            map[item.company_id] = {
              ...item,
              invite_url: item.invite_url
                ? normalizeWhatsappInvite(item.invite_url)
                : null,
            };
          }
        }
        setWhatsappByCompany(map);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => { loadData(); });
  }, [loadData]);

  const openCreateModal = () => {
    setEditingCompany(null);
    const nextNum = companies.length + 1;
    setFormId(`cia-${nextNum}`);
    setFormName(`Companhia ${nextNum} - `);
    setFormMotto("");
    setFormColor(PRESET_COLORS[(nextNum - 1) % PRESET_COLORS.length].value);
    setSelectedCounselorIds([]);
    setCounselorSearch("");
    setIsDialogOpen(true);
  };

  const openEditModal = (comp: CompanyItem) => {
    setEditingCompany(comp);
    setFormId(comp.id);
    setFormName(comp.name);
    setFormMotto(comp.motto || "");
    setFormColor(comp.color || "#007DA5");

    // Pre-select counselors that belong to this company
    const assignedIds = counselors
      .filter((c) => c.company_id === comp.id)
      .map((c) => c.id);

    setSelectedCounselorIds(assignedIds);
    setCounselorSearch("");
    setIsDialogOpen(true);
  };

  const toggleCounselorSelection = (counselorId: string) => {
    setSelectedCounselorIds((prev) =>
      prev.includes(counselorId)
        ? prev.filter((id) => id !== counselorId)
        : [...prev, counselorId]
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError("O nome da companhia é obrigatório.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const isEdit = !!editingCompany;
      const endpoint = "/api/companies";
      const method = isEdit ? "PUT" : "POST";

      const payload = {
        id: formId.trim() || `cia-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        motto: formMotto.trim() || null,
        color: formColor,
        counselor_ids: selectedCounselorIds,
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Erro ao salvar companhia.");
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setIsDialogOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;
    setDeletingId(companyToDelete.id);
    setError(null);

    try {
      const res = await fetch(`/api/companies?id=${encodeURIComponent(companyToDelete.id)}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Erro ao excluir companhia.");
      }

      setCompanyToDelete(null);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchName = c.name.toLowerCase().includes(q);
    const matchMotto = (c.motto || "").toLowerCase().includes(q);
    const matchCounselor = (c.counselors || []).some((name) =>
      name.toLowerCase().includes(q)
    );
    return matchName || matchMotto || matchCounselor;
  });

  const totalYouth = companies.reduce((acc, c) => acc + (c.youth_count || 0), 0);
  const totalAssignedCounselors = counselors.filter((c) => c.company_id).length;
  const companiesWithoutCounselorCount = companies.filter((c) => {
    const waEntry = whatsappByCompany[c.id];
    const hasCounselorNames =
      Array.isArray(c.counselors) &&
      c.counselors.some((n) => typeof n === "string" && n.trim().length > 0);
    return !hasCounselorNames && !waEntry?.has_counselor;
  }).length;

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#007DA5] text-white shadow-sm dark:border-slate-700">
            <Building2 className="h-6 w-6 shrink-0" />
          </div>
          <div className="min-w-0">
            <h2 className="break-words font-heading text-2xl font-bold text-slate-900 [overflow-wrap:anywhere] dark:text-white">
              Gestão de Companhias do FSY
            </h2>
            <p className="break-words text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-300">
              Casal Diretor, Coordenação e Logística • Criação e designação de consultores
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold shadow-sm transition-colors hover:bg-slate-50 whitespace-normal break-words dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>Atualizar</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-[#93C742] px-4 py-2.5 text-xs font-bold text-emerald-950 shadow-sm transition-opacity hover:opacity-90 whitespace-normal break-words dark:border-slate-700"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>Nova Companhia</span>
          </button>
        </div>
      </div>

      {/* Resumo de companhias sem consultor */}
      {!loading && companiesWithoutCounselorCount > 0 && (
        <div
          role="status"
          className="flex min-w-0 flex-wrap items-center gap-2.5 rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-sm font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">
            {companiesWithoutCounselorCount === 1
              ? "1 companhia sem consultor"
              : `${companiesWithoutCounselorCount} companhias sem consultor`}
            {" · "}Você já pode configurar o grupo do WhatsApp de cada companhia antes da designação.
          </span>
        </div>
      )}

      {/* Success Notification */}
      <AnimatePresence>
        {savedMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fsy-panel flex min-w-0 items-center gap-2 rounded-2xl border-2 border-emerald-600 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-800 dark:text-emerald-300" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              Companhia e consultores salvos no banco de dados com sucesso!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      {error && (
        <div className="fsy-panel flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 shadow-sm dark:bg-red-950/30 dark:text-red-300">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-xs underline"
          >
            fechar
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="fsy-panel rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 dark:text-slate-400">
            Total de Companhias
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {companies.length}
            </span>
            <Building2 className="h-5 w-5 text-[#005E7C] dark:text-[#7DE3F4]" />
          </div>
        </div>

        <div className="fsy-panel rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 dark:text-slate-400">
            Consultores Designados
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {totalAssignedCounselors} / {counselors.length}
            </span>
            <UserCheck className="h-5 w-5 text-[#93C742]" />
          </div>
        </div>

        <div className="fsy-panel rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-300 dark:text-slate-400">
            Jovens Alocados
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-bold text-slate-900 dark:text-white">
              {totalYouth}
            </span>
            <Users className="h-5 w-5 text-[#FC4E6D]" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 dark:text-slate-300" />
        <Input
          type="text"
          aria-label="Buscar por companhia, lema ou consultor"
          placeholder="Buscar por companhia, lema ou consultor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-h-11 w-full pl-10"
        />
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 dark:text-slate-300">
          <Loader2 className="h-8 w-8 animate-spin text-[#005E7C] dark:text-[#7DE3F4]" />
          <p className="text-sm font-bold">Carregando companhias...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="fsy-panel rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-heading text-lg font-bold text-slate-700 dark:text-slate-300">
            Nenhuma companhia encontrada
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-300 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "Tente outro termo de busca."
              : "Clique em 'Nova Companhia' para cadastrar a primeira companhia do evento."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map((comp) => {
            const waItem = whatsappByCompany[comp.id];
            const waUrl = waItem?.invite_url ?? null;
            const hasCounselors =
              Array.isArray(comp.counselors) &&
              comp.counselors.some((cName) => typeof cName === "string" && cName.trim().length > 0);

            return (
              <motion.div
                key={comp.id}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="fsy-panel flex min-w-0 flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-brutal-md dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  {/* Color Pill & Actions */}
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div
                      className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-900/40 px-2.5 py-1 text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: comp.color || "#007DA5", color: contrastText(comp.color || "#007DA5") }}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-white/80" />
                      <span className="break-words [overflow-wrap:anywhere]">{comp.id.toUpperCase()}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(comp)}
                        aria-label={`Editar ${comp.name}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        title="Editar Companhia"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompanyToDelete(comp)}
                        aria-label={`Excluir ${comp.name}`}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                        title="Excluir Companhia"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Company Name */}
                  <h3 className="break-words font-heading text-xl font-bold leading-snug text-slate-900 [overflow-wrap:anywhere] dark:text-white">
                    {comp.name}
                  </h3>

                  {/* Motto */}
                  {comp.motto && (
                    <p className="mt-1 line-clamp-2 break-words text-xs font-semibold italic text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
                      &ldquo;{comp.motto}&rdquo;
                    </p>
                  )}

                  {/* Counselors Section */}
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Consultores Designados
                    </span>
                    {hasCounselors ? (
                      <div className="flex flex-wrap gap-1.5">
                        {comp.counselors.map((cName, idx) => (
                          <span
                            key={idx}
                            className="inline-flex min-w-0 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-[#005E7C] dark:border-sky-800 dark:bg-sky-950/60 dark:text-cyan-300"
                          >
                            <UserCheck className="h-3 w-3 shrink-0" />
                            <span className="break-words [overflow-wrap:anywhere]">{cName}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span>Sem consultor designado</span>
                      </span>
                    )}
                  </div>

                  {/* WhatsApp Group Link Section */}
                  <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#007DA5]" />
                        <span>Grupo do WhatsApp</span>
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          waUrl
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {waUrl ? "Link ativo" : "Sem link"}
                      </span>
                    </div>
                    {waItem?.updated_by_name && waUrl && (
                      <p className="mt-1 break-words text-xs text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">
                        Atualizado por {waItem.updated_by_name}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50 whitespace-normal break-words dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span>Abrir grupo</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setWhatsappEditingCompany(comp)}
                        aria-label={`${waUrl ? "Trocar link" : "Adicionar link"} do WhatsApp — ${comp.name}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#007DA5] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#005E7C] whitespace-normal break-words"
                      >
                        <span>{waUrl ? "Trocar link" : "Adicionar link"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Footer KPI */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
                  <span className="font-bold text-slate-500 dark:text-slate-300">
                    Jovens registrados:
                  </span>
                  <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    {comp.youth_count || 0} jovens
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="fsy-panel sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#005E7C] dark:text-[#7DE3F4]" />
              {editingCompany ? "Editar Companhia" : "Criar Nova Companhia"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-300 dark:text-slate-400">
              Preencha os dados da companhia e selecione os consultores que terão acesso exclusivo ao painel desta companhia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ID & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="field-companymanager-1" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Identificador (ID)
                </label>
                <Input id="field-companymanager-1"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="ex: cia-1"
                  className=""
                  disabled={!!editingCompany}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="field-companymanager-2" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Companhia *
                </label>
                <Input id="field-companymanager-2"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ex: Companhia 1 - Néfi"
                  className=""
                />
              </div>
            </div>

            {/* Motto */}
            <div>
              <label htmlFor="field-companymanager-3" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Lema / Escritura da Companhia (Opcional)
              </label>
              <Input id="field-companymanager-3"
                value={formMotto}
                onChange={(e) => setFormMotto(e.target.value)}
                placeholder="ex: 'Iremos e faremos!' - 1 Néfi 3:7"
                className=""
              />
            </div>

            {/* Color Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-[#005E7C] dark:text-[#7DE3F4]" />
                Cor da Companhia
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((col) => (
                  <button
                    key={col.name}
                    type="button"
                    onClick={() => setFormColor(col.value)}
                    className={`flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all whitespace-normal break-words ${
                      formColor === col.value
                        ? "border-slate-900 dark:border-white shadow-sm scale-105"
                        : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: col.value, color: contrastText(col.value) }}
                  >
                    <span>{col.name}</span>
                  </button>
                ))}
                {/* Roda de cores do próprio navegador: escolhe qualquer cor sem digitar código. */}
                <label
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all ${
                    PRESET_COLORS.some((col) => col.value.toLowerCase() === formColor.toLowerCase())
                      ? "border-slate-300 text-slate-800 dark:border-slate-700 dark:text-slate-100"
                      : "border-slate-900 dark:border-white shadow-sm"
                  }`}
                >
                  <input
                    type="color"
                    value={/^#[0-9a-f]{6}$/i.test(formColor) ? formColor : "#007DA5"}
                    onChange={(e) => setFormColor(e.target.value.toUpperCase())}
                    className="h-7 w-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    aria-label="Outra cor (roda de cores)"
                  />
                  <span>Outra cor</span>
                </label>
              </div>
            </div>

            {/* Counselor Assignment Multi-select */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-[#005E7C] dark:text-[#7DE3F4]" />
                  Designar Consultores ({selectedCounselorIds.length} selecionados)
                </label>
                <span className="text-xs text-slate-500 dark:text-slate-300 font-bold">
                  Apenas usuários com cargo &apos;Consultor&apos;
                </span>
              </div>

              {/* Counselor search */}
              <Input
                aria-label="Filtrar consultores por nome"
                value={counselorSearch}
                onChange={(e) => setCounselorSearch(e.target.value)}
                placeholder="Filtrar consultores por nome..."
                className="mb-2"
              />

              {/* Counselors Checklist */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2">
                {counselors.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-300 text-center py-3">
                    Nenhum usuário com cargo &apos;Consultor&apos; cadastrado no sistema.
                  </p>
                ) : (
                  counselors
                    .filter((c) =>
                      c.full_name
                        .toLowerCase()
                        .includes(counselorSearch.toLowerCase())
                    )
                    .map((c) => {
                      const isSelected = selectedCounselorIds.includes(c.id);
                      const isAssignedOther =
                        c.company_id &&
                        c.company_id !== (editingCompany ? editingCompany.id : null);

                      return (
                        <label
                          key={c.id}
                          className={`flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-sky-50 dark:bg-sky-950/60 border-[#007DA5] text-[#005E7C] dark:text-cyan-200"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCounselorSelection(c.id)}
                              className="h-4 w-4 shrink-0 rounded border-slate-400 text-[#005E7C] focus:ring-[#007DA5] dark:text-[#7DE3F4]"
                            />
                            <span className="break-words font-bold [overflow-wrap:anywhere]">{c.full_name}</span>
                          </div>

                          {isAssignedOther && !isSelected && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Na {companies.find((company) => company.id === c.company_id)?.name ?? "outra companhia"}
                            </span>
                          )}
                        </label>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="min-h-11 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold whitespace-normal break-words dark:border-slate-700"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="min-h-11 rounded-2xl bg-[#007DA5] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#005E7C] whitespace-normal break-words"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-4 w-4 shrink-0" />
                  <span>Salvar Companhia</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!companyToDelete}
        onOpenChange={(open) => !open && setCompanyToDelete(null)}
      >
        <DialogContent className="fsy-panel sm:max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Confirmar Exclusão de Companhia</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
              Tem certeza que deseja excluir a <strong>{companyToDelete?.name}</strong>?
              Os consultores e jovens vinculados a ela serão desvinculados no banco de dados.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompanyToDelete(null)}
              className="min-h-11 rounded-2xl px-4 py-2 text-xs font-bold whitespace-normal break-words"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={!!deletingId}
              className="min-h-11 rounded-2xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 whitespace-normal break-words"
            >
              {deletingId ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 shrink-0 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <span>Sim, Excluir Companhia</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {whatsappEditingCompany && (
        <CompanyWhatsappDialog
          key={`${whatsappEditingCompany.id}-${whatsappByCompany[whatsappEditingCompany.id]?.invite_url ?? "none"}`}
          open={Boolean(whatsappEditingCompany)}
          onOpenChange={(open) => !open && setWhatsappEditingCompany(null)}
          companyId={whatsappEditingCompany.id}
          companyName={whatsappEditingCompany.name}
          currentUrl={whatsappByCompany[whatsappEditingCompany.id]?.invite_url ?? null}
          onSaved={(updated) => {
            setWhatsappByCompany((prev) => ({
              ...prev,
              [updated.company_id]: updated,
            }));
          }}
        />
      )}
    </div>
  );
}
