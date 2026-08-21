"use client";

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
  { name: "Azul FSY", value: "#4361EE" },
  { name: "Rosa Vibrante", value: "#FF6B8B" },
  { name: "Verde Esmeralda", value: "#06D6A0" },
  { name: "Amarelo Dourado", value: "#FFD166" },
  { name: "Roxo Real", value: "#7209B7" },
  { name: "Laranja Solar", value: "#F77F00" },
  { name: "Ciano Marinho", value: "#4CC9F0" },
  { name: "Rubi Intenso", value: "#E63946" },
];

export function CompanyManager() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [counselors, setCounselors] = useState<CounselorProfile[]>([]);
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
  const [formColor, setFormColor] = useState("#4361EE");
  const [selectedCounselorIds, setSelectedCounselorIds] = useState<string[]>([]);
  const [counselorSearch, setCounselorSearch] = useState("");

  // Delete confirmation
  const [companyToDelete, setCompanyToDelete] = useState<CompanyItem | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/companies?_t=${Date.now()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Falha ao carregar companhias.");
      }

      const json = await res.json();
      setCompanies(json.companies ?? []);
      setCounselors(json.all_counselors ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
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
    setFormColor(comp.color || "#4361EE");

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#4361EE] text-white border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-black text-slate-900 dark:text-white">
              Gestão de Companhias do FSY
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Casal Diretor, Coordenação e Logística • Criação e designação de consultores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 px-3.5 py-2.5 text-xs font-black shadow-brutal-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-2xl bg-[#06D6A0] text-slate-950 border-2 border-slate-900 dark:border-slate-700 px-4 py-2.5 text-xs font-black shadow-brutal-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Nova Companhia
          </button>
        </div>
      </div>

      {/* Success Notification */}
      <AnimatePresence>
        {savedMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border-2 border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 shadow-brutal-sm"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>Companhia e consultores salvos no banco de dados com sucesso!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300 flex items-center justify-between shadow-brutal-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="underline text-xs">
            fechar
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-brutal-sm">
          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
            Total de Companhias
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {companies.length}
            </span>
            <Building2 className="h-5 w-5 text-[#4361EE]" />
          </div>
        </div>

        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-brutal-sm">
          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
            Consultores Designados
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {totalAssignedCounselors} / {counselors.length}
            </span>
            <UserCheck className="h-5 w-5 text-[#06D6A0]" />
          </div>
        </div>

        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-brutal-sm">
          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
            Jovens Alocados
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {totalYouth}
            </span>
            <Users className="h-5 w-5 text-[#FF6B8B]" />
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por companhia, lema ou consultor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4361EE] transition-all"
        />
      </div>

      {/* Companies Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-[#4361EE]" />
          <p className="text-sm font-bold">Carregando companhias...</p>
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
          <Building2 className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-heading text-lg font-black text-slate-700 dark:text-slate-300">
            Nenhuma companhia encontrada
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? "Tente outro termo de busca."
              : "Clique em 'Nova Companhia' para cadastrar a primeira companhia do evento."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCompanies.map((comp) => (
            <motion.div
              key={comp.id}
              whileHover={{ y: -3 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-brutal-md flex flex-col justify-between"
            >
              <div>
                {/* Color Pill & Actions */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-white font-black text-xs border border-slate-900/40 shadow-sm"
                    style={{ backgroundColor: comp.color || "#4361EE" }}
                  >
                    <span className="h-2 w-2 rounded-full bg-white/80" />
                    <span>{comp.id.toUpperCase()}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(comp)}
                      className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                      title="Editar Companhia"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCompanyToDelete(comp)}
                      className="p-1.5 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Excluir Companhia"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Company Name */}
                <h3 className="font-heading text-xl font-black text-slate-900 dark:text-white leading-snug">
                  {comp.name}
                </h3>

                {/* Motto */}
                {comp.motto && (
                  <p className="mt-1 text-xs italic font-semibold text-slate-600 dark:text-slate-400 line-clamp-2">
                    &ldquo;{comp.motto}&rdquo;
                  </p>
                )}

                {/* Counselors Section */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1.5">
                    Consultores Designados
                  </span>
                  {comp.counselors && comp.counselors.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {comp.counselors.map((cName, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#4361EE] dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs font-bold"
                        >
                          <UserCheck className="h-3 w-3" />
                          {cName}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Nenhum consultor designado
                    </span>
                  )}
                </div>
              </div>

              {/* Footer KPI */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold">
                  Jovens registrados:
                </span>
                <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 font-black text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                  {comp.youth_count || 0} jovens
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#4361EE]" />
              {editingCompany ? "Editar Companhia" : "Criar Nova Companhia"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Preencha os dados da companhia e selecione os consultores que terão acesso exclusivo ao painel desta companhia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ID & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  Identificador (ID)
                </label>
                <Input
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="ex: cia-1"
                  className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-bold"
                  disabled={!!editingCompany}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Companhia *
                </label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ex: Companhia 1 - Néfi"
                  className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-bold"
                />
              </div>
            </div>

            {/* Motto */}
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1">
                Lema / Escritura da Companhia (Opcional)
              </label>
              <Input
                value={formMotto}
                onChange={(e) => setFormMotto(e.target.value)}
                placeholder="ex: 'Iremos e faremos!' - 1 Néfi 3:7"
                className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-semibold"
              />
            </div>

            {/* Color Selector */}
            <div>
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-[#4361EE]" />
                Cor da Companhia
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((col) => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => setFormColor(col.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border-2 transition-all ${
                      formColor === col.value
                        ? "border-slate-900 dark:border-white shadow-brutal-sm scale-105"
                        : "border-transparent opacity-80 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: col.value, color: "#fff" }}
                  >
                    <span>{col.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Counselor Assignment Multi-select */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-[#4361EE]" />
                  Designar Consultores ({selectedCounselorIds.length} selecionados)
                </label>
                <span className="text-[10px] text-slate-500 font-bold">
                  Apenas usuários com cargo &apos;Consultor&apos;
                </span>
              </div>

              {/* Counselor search */}
              <Input
                value={counselorSearch}
                onChange={(e) => setCounselorSearch(e.target.value)}
                placeholder="Filtrar consultores por nome..."
                className="rounded-xl border border-slate-300 dark:border-slate-700 text-xs mb-2"
              />

              {/* Counselors Checklist */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2">
                {counselors.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-3">
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
                          className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-colors text-xs font-semibold ${
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-950/60 border-[#4361EE] text-[#4361EE] dark:text-blue-200"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCounselorSelection(c.id)}
                              className="rounded border-slate-400 text-[#4361EE] focus:ring-[#4361EE]"
                            />
                            <span className="font-bold">{c.full_name}</span>
                          </div>

                          {isAssignedOther && !isSelected && (
                            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                              Na {c.company_id}
                            </span>
                          )}
                        </label>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 text-xs font-black"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-[#4361EE] hover:bg-blue-600 text-white font-black text-xs shadow-brutal-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  Salvar Companhia
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
        <DialogContent className="sm:max-w-md rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-black text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão de Companhia
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
              Tem certeza que deseja excluir a <strong>{companyToDelete?.name}</strong>?
              Os consultores e jovens vinculados a ela serão desvinculados no banco de dados.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCompanyToDelete(null)}
              className="rounded-2xl text-xs font-black"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={!!deletingId}
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black"
            >
              {deletingId ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir Companhia"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
