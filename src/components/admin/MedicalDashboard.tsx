"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  PhoneCall,
  AlertTriangle,
  Pill,
  ShieldAlert,
  PlusCircle,
  Loader2,
  RefreshCw,
  Save,
  CheckCircle2,
  User,
  X,
  Trash2,
  Eye,
  Edit2,
  FileText,
  HeartPulse,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

export interface YouthMedicalProfile {
  id: string;
  user_id?: string | null;
  full_name: string;
  company_id: string | null;
  room: string | null;
  allergies: string[];
  is_severe_allergy: boolean;
  dietary_restrictions: string | null;
  medications: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  blood_type: string | null;
  doctor_notes: string | null;
  created_at: string;
  updated_at?: string;
}

export function MedicalDashboard() {
  const [records, setRecords] = useState<YouthMedicalProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAllergy, setFilterAllergy] = useState(false);

  // Selected record for View Modal and Edit Sheet
  const [viewingRecord, setViewingRecord] = useState<YouthMedicalProfile | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<YouthMedicalProfile | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isNewSheet, setIsNewSheet] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<YouthMedicalProfile>>({});

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First try API route
      const res = await fetch("/api/medical");
      let data: Record<string, unknown>[] = [];

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          data = json.data;
        }
      }

      if (data.length === 0) {
        const supabase = createClient();
        const { data: dbData, error: fetchError } = await supabase
          .from("medical_records")
          .select("*")
          .order("created_at", { ascending: false });

        if (fetchError) {
          setError("Erro ao carregar fichas médicas: " + fetchError.message);
        } else {
          data = (dbData as unknown as Record<string, unknown>[]) || [];
        }
      }

      // Normalize fields from DB
      const normalized: YouthMedicalProfile[] = (data || []).map((item: Record<string, unknown>) => {
        let parsedAllergies: string[] = [];
        if (Array.isArray(item.allergies)) {
          parsedAllergies = item.allergies;
        } else if (typeof item.allergies === "string" && item.allergies.trim()) {
          parsedAllergies = item.allergies.split(",").map((s: string) => s.trim()).filter(Boolean);
        }

        let parsedMeds: string[] = [];
        if (Array.isArray(item.medications)) {
          parsedMeds = item.medications;
        } else if (typeof item.medications === "string" && item.medications.trim()) {
          parsedMeds = item.medications.split(",").map((s: string) => s.trim()).filter(Boolean);
        }

        return {
          id: String(item.id),
          user_id: item.user_id ? String(item.user_id) : null,
          full_name: String(item.full_name || item.emergency_contact_name || "Participante"),
          company_id: item.company_id ? String(item.company_id) : null,
          room: item.room ? String(item.room) : null,
          allergies: parsedAllergies,
          is_severe_allergy: Boolean(item.is_severe_allergy),
          dietary_restrictions: item.dietary_restrictions ? String(item.dietary_restrictions) : null,
          medications: parsedMeds,
          emergency_contact_name: item.emergency_contact_name ? String(item.emergency_contact_name) : null,
          emergency_contact_phone: item.emergency_contact_phone ? String(item.emergency_contact_phone) : null,
          emergency_contact_relationship: item.emergency_contact_rel
            ? String(item.emergency_contact_rel)
            : item.emergency_contact_relationship
            ? String(item.emergency_contact_relationship)
            : null,
          blood_type: item.blood_type ? String(item.blood_type) : null,
          doctor_notes: item.doctor_notes ? String(item.doctor_notes) : null,
          created_at: String(item.created_at || new Date().toISOString()),
        };
      });

      setRecords(normalized);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro de conexão ao carregar fichas: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const openView = (record: YouthMedicalProfile) => {
    setViewingRecord(record);
    setIsViewModalOpen(true);
  };

  const openEdit = (record: YouthMedicalProfile) => {
    setIsViewModalOpen(false);
    setSelectedRecord(record);
    setEditForm({ ...record });
    setIsNewSheet(false);
    setIsSheetOpen(true);
  };

  const openNew = () => {
    setSelectedRecord(null);
    setEditForm({
      full_name: "",
      company_id: "",
      room: "",
      allergies: [],
      is_severe_allergy: false,
      dietary_restrictions: "",
      medications: [],
      emergency_contact_name: "",
      emergency_contact_phone: "",
      emergency_contact_relationship: "",
      blood_type: "",
      doctor_notes: "",
    });
    setIsNewSheet(true);
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!editForm.full_name?.trim()) {
      setError("Nome do participante é obrigatório.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const allergiesStr = (editForm.allergies || []).join(", ");
    const medsStr = (editForm.medications || []).join(", ");

    const payload: Record<string, unknown> = {
      full_name: editForm.full_name.trim(),
      user_id: user?.id || null,
      company_id: editForm.company_id?.trim() || null,
      room: editForm.room?.trim() || null,
      allergies: allergiesStr,
      is_severe_allergy: Boolean(editForm.is_severe_allergy),
      dietary_restrictions: editForm.dietary_restrictions?.trim() || null,
      medications: medsStr,
      emergency_contact_name: editForm.emergency_contact_name?.trim() || "Não informado",
      emergency_contact_phone: editForm.emergency_contact_phone?.trim() || "Não informado",
      emergency_contact_rel: editForm.emergency_contact_relationship?.trim() || "Responsável",
      blood_type: editForm.blood_type?.trim() || null,
      doctor_notes: editForm.doctor_notes?.trim() || null,
    };

    try {
      let res;
      if (isNewSheet) {
        res = await fetch("/api/medical", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (selectedRecord) {
        res = await fetch("/api/medical", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedRecord.id, ...payload }),
        });
      }

      if (res) {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || "Erro ao salvar ficha médica");
        }
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setIsSheetOpen(false);
      await loadRecords();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // In-app Delete Confirmation state
  const [recordToDelete, setRecordToDelete] = useState<YouthMedicalProfile | null>(null);

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const id = recordToDelete.id;
    setDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/medical?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao remover ficha médica");
      }

      setIsViewModalOpen(false);
      setIsSheetOpen(false);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setRecordToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = records.filter((r) => {
    const matchSearch =
      r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.company_id ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.room ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.allergies ?? []).some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.medications ?? []).some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchAllergy = !filterAllergy || r.is_severe_allergy;
    return matchSearch && matchAllergy;
  });

  const severeCount = records.filter((r) => r.is_severe_allergy).length;
  const allergiesCount = records.filter((r) => r.allergies.length > 0).length;
  const medsCount = records.filter((r) => r.medications.length > 0).length;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Fichas Médicas — Participantes
            </h1>
            <Badge className="bg-[#4361EE] text-white text-[10px] font-black uppercase">
              Confidencial
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Registros médicos confidenciais com visualização, edição e exclusão no banco de dados.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && (
            <span className="flex items-center gap-1 text-sm font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-1.5 rounded-xl border border-green-200 dark:border-green-800 animate-bounce">
              <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso!
            </span>
          )}
          <Button onClick={loadRecords} variant="outline" size="sm" className="text-xs font-bold rounded-xl border-2">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button
            onClick={openNew}
            className="text-xs bg-[#4361EE] hover:bg-blue-600 text-white font-black rounded-xl border-2 border-slate-900 shadow-brutal-sm"
          >
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Nova Ficha Médica
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/40 p-4 text-sm font-bold text-red-700 dark:text-red-300 flex items-start justify-between gap-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total de Fichas
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950 text-[#4361EE]">
              <User className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{records.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Participantes cadastrados</p>
          </div>
        </Card>

        <Card className="border-2 border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/30 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Alergias Graves
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-black text-rose-700 dark:text-rose-300 leading-none">{severeCount}</p>
            <p className="text-xs text-rose-600/80 dark:text-rose-400 mt-1 font-semibold">Atenção especial da equipe</p>
          </div>
        </Card>

        <Card className="border-2 border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Com Alergias
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-black text-amber-700 dark:text-amber-300 leading-none">{allergiesCount}</p>
            <p className="text-xs text-amber-600/80 dark:text-amber-400 mt-1 font-semibold">Restrições cadastradas</p>
          </div>
        </Card>

        <Card className="border-2 border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/30 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Com Medicações
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600">
              <Pill className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-3xl font-black text-blue-700 dark:text-blue-300 leading-none">{medsCount}</p>
            <p className="text-xs text-blue-600/80 dark:text-blue-400 mt-1 font-semibold">Uso contínuo</p>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, companhia, alergia ou medicamento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-sm bg-white dark:bg-slate-900"
          />
        </div>
        <button
          onClick={() => setFilterAllergy(!filterAllergy)}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black border-2 transition-all flex items-center justify-center gap-1.5 ${
            filterAllergy
              ? "bg-rose-500 text-white border-rose-600 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-400"
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" />
          {filterAllergy ? "Mostrando: Alergias Graves" : "Filtrar: Alergias Graves"}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#4361EE]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <User className="h-12 w-12 mx-auto mb-2 opacity-30 text-[#4361EE]" />
          <p className="font-black text-base text-slate-700 dark:text-slate-300">Nenhuma ficha médica cadastrada</p>
          <p className="text-xs max-w-sm mx-auto">
            Clique no botão &ldquo;Nova Ficha Médica&rdquo; para cadastrar o primeiro participante.
          </p>
          <Button
            onClick={openNew}
            className="mt-3 text-xs bg-[#4361EE] hover:bg-blue-600 text-white font-bold"
          >
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Nova Ficha
          </Button>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-700">
                <TableHead className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 pl-6 py-3.5">Participante</TableHead>
                <TableHead className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Companhia</TableHead>
                <TableHead className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Alergias</TableHead>
                <TableHead className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">Contato Emergência</TableHead>
                <TableHead className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 pr-6 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((record) => (
                <TableRow
                  key={record.id}
                  className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    record.is_severe_allergy ? "border-l-4 border-l-rose-500" : ""
                  }`}
                >
                  <TableCell className="pl-6 py-4 cursor-pointer" onClick={() => openView(record)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700">
                        <AvatarFallback className="text-xs font-black bg-[#4361EE] text-white">
                          {record.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white">{record.full_name}</p>
                        {record.room && (
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{record.room}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer" onClick={() => openView(record)}>
                    {record.company_id ? (
                      <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200">
                        {record.company_id}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => openView(record)}>
                    {record.allergies.length === 0 ? (
                      <span className="text-xs font-bold text-slate-400">Nenhuma</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {record.is_severe_allergy && (
                          <Badge className="text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            ⚠️ Grave
                          </Badge>
                        )}
                        {record.allergies.slice(0, 2).map((a) => (
                          <Badge key={a} variant="outline" className="text-[10px] font-bold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50">
                            {a}
                          </Badge>
                        ))}
                        {record.allergies.length > 2 && (
                          <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                            +{record.allergies.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="cursor-pointer" onClick={() => openView(record)}>
                    {record.emergency_contact_name && record.emergency_contact_name !== "Não informado" ? (
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{record.emergency_contact_name}</p>
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <PhoneCall className="h-3 w-3 text-[#4361EE]" /> {record.emergency_contact_phone}
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openView(record)}
                        title="Visualizar Detalhes"
                        className="h-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#4361EE]"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(record)}
                        title="Editar Ficha"
                        className="h-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#4361EE]"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRecordToDelete(record)}
                        disabled={deleting === record.id}
                        title="Excluir Ficha Médica"
                        className="h-8 px-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* VIEW MODAL (Visualização Completa da Ficha) */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          {viewingRecord && (
            <div className="space-y-5">
              <DialogHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-[#4361EE]">
                      <AvatarFallback className="text-base font-black bg-[#4361EE] text-white">
                        {viewingRecord.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                        {viewingRecord.full_name}
                      </DialogTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {viewingRecord.company_id && (
                          <Badge variant="outline" className="text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {viewingRecord.company_id}
                          </Badge>
                        )}
                        {viewingRecord.room && (
                          <Badge variant="outline" className="text-xs font-bold">
                            Quarto: {viewingRecord.room}
                          </Badge>
                        )}
                        {viewingRecord.blood_type && (
                          <Badge className="text-xs font-black bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300">
                            Sangue: {viewingRecord.blood_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              {/* Severe Allergy Alert Banner */}
              {viewingRecord.is_severe_allergy && (
                <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/50 p-4 flex items-center gap-3">
                  <ShieldAlert className="h-6 w-6 text-rose-600 flex-shrink-0 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-black text-rose-800 dark:text-rose-200 uppercase tracking-wider">
                      ⚠️ Atenção Médica: Alergia Severa com Risco
                    </h4>
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                      Participante possui histórico de reações graves / risco de anafilaxia.
                    </p>
                  </div>
                </div>
              )}

              {/* Detail Blocks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Allergies Block */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Alergias</span>
                  </div>
                  {viewingRecord.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {viewingRecord.allergies.map((a) => (
                        <span key={a} className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-500">Nenhuma alergia relatada</p>
                  )}
                </div>

                {/* Dietary Block */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">
                    <HeartPulse className="h-4 w-4" />
                    <span>Restrição Alimentar</span>
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {viewingRecord.dietary_restrictions || "Padrão (Sem restrições)"}
                  </p>
                </div>
              </div>

              {/* Continuous Medications */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                  <Pill className="h-4 w-4" />
                  <span>Medicações de Uso Contínuo</span>
                </div>
                {viewingRecord.medications.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {viewingRecord.medications.map((m) => (
                      <span key={m} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                        {m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-500">Nenhuma medicação contínua cadastrada</p>
                )}
              </div>

              {/* Emergency Contact */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-600 dark:text-purple-400">
                  <PhoneCall className="h-4 w-4" />
                  <span>Contato de Emergência</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {viewingRecord.emergency_contact_name || "Não informado"}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold">
                      Parentesco: {viewingRecord.emergency_contact_relationship || "Responsável"}
                    </p>
                  </div>
                  {viewingRecord.emergency_contact_phone && (
                    <a
                      href={`tel:${viewingRecord.emergency_contact_phone.replace(/\D/g, "")}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      Ligar: {viewingRecord.emergency_contact_phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Doctor Notes */}
              {viewingRecord.doctor_notes && (
                <div className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-700 dark:text-amber-300">
                    <FileText className="h-4 w-4" />
                    <span>Observações da Equipe Médica</span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {viewingRecord.doctor_notes}
                  </p>
                </div>
              )}

              {/* Footer Actions */}
              <DialogFooter className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setRecordToDelete(viewingRecord)}
                  disabled={deleting === viewingRecord.id}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Excluir Ficha
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsViewModalOpen(false)}
                    className="rounded-xl font-bold text-xs"
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={() => openEdit(viewingRecord)}
                    className="bg-[#4361EE] hover:bg-blue-600 text-white font-black rounded-xl text-xs"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    Editar Ficha
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DETAIL / EDIT SHEET */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-slate-900 p-0">
          <SheetHeader className="p-6 pb-4 border-b-2 border-slate-100 dark:border-slate-800">
            <SheetTitle className="text-xl font-black text-slate-900 dark:text-white">
              {isNewSheet ? "Nova Ficha Médica" : "Editar Ficha Médica"}
            </SheetTitle>
            <SheetDescription className="text-slate-500 dark:text-slate-400 text-xs">
              {isNewSheet
                ? "Cadastre os dados de saúde e contatos de emergência do participante."
                : "Atualize os registros e observações da equipe médica."}
            </SheetDescription>
          </SheetHeader>

          <div className="p-6 space-y-6">
            {/* Basic Info */}
            <section className="space-y-3.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Identificação do Participante
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Nome Completo *
                  </label>
                  <Input
                    value={editForm.full_name ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Nome completo do jovem"
                    className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Companhia
                    </label>
                    <Input
                      value={editForm.company_id ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, company_id: e.target.value }))}
                      placeholder="ex: cia-1, Cia 2"
                      className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Alojamento / Quarto
                    </label>
                    <Input
                      value={editForm.room ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, room: e.target.value }))}
                      placeholder="ex: Bloco A - 204"
                      className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Tipo Sanguíneo
                  </label>
                  <Input
                    value={editForm.blood_type ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, blood_type: e.target.value }))}
                    placeholder="ex: O+, A-, B+"
                    className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                  />
                </div>
              </div>
            </section>

            {/* Allergies */}
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Alergias & Restrições
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Alergias (Medicamentos ou Alimentos)
                  </label>
                  <Input
                    value={editForm.allergies?.join(", ") ?? ""}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        allergies: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      }))
                    }
                    placeholder="Separe por vírgulas: Amendoim, Dipirona, Penicilina"
                    className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                  />
                </div>

                <div className="rounded-xl border-2 border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 p-3">
                  <label className="flex items-center gap-2 text-xs font-black text-rose-700 dark:text-rose-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.is_severe_allergy ?? false}
                      onChange={(e) => setEditForm((f) => ({ ...f, is_severe_allergy: e.target.checked }))}
                      className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>⚠️ Alergia com risco de anafilaxia / necessidade de epinefrina</span>
                  </label>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Restrição Alimentar
                  </label>
                  <Input
                    value={editForm.dietary_restrictions ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, dietary_restrictions: e.target.value }))}
                    placeholder="ex: Sem Glúten, Sem Lactose, Vegetariano"
                    className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                  />
                </div>
              </div>
            </section>

            {/* Medications */}
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. Medicações de Uso Contínuo
              </h3>
              <Input
                value={editForm.medications?.join(", ") ?? ""}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    medications: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  }))
                }
                placeholder="Separe por vírgulas: Ritalina 10mg, Losartana 50mg"
                className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
              />
            </section>

            {/* Emergency Contact */}
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                4. Contato de Emergência
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Nome do Responsável
                  </label>
                  <Input
                    value={editForm.emergency_contact_name ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
                    placeholder="Nome completo do responsável"
                    className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Telefone / WhatsApp
                    </label>
                    <Input
                      value={editForm.emergency_contact_phone ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
                      placeholder="+55 (16) 99999-9999"
                      className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Parentesco
                    </label>
                    <Input
                      value={editForm.emergency_contact_relationship ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_relationship: e.target.value }))}
                      placeholder="ex: Mãe, Pai, Avó"
                      className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Doctor Notes */}
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                5. Observações Médicas
              </h3>
              <textarea
                value={editForm.doctor_notes ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, doctor_notes: e.target.value }))}
                placeholder="Observações clínicas, horários de medicação ou cuidados especiais..."
                rows={3}
                className="w-full p-3.5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4361EE] resize-none"
              />
            </section>
          </div>

          {/* Sticky Actions Footer */}
          <div className="sticky bottom-0 border-t-2 border-slate-200 dark:border-slate-800 p-6 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-lg">
            {!isNewSheet && selectedRecord && (
              <Button
                variant="ghost"
                onClick={() => setRecordToDelete(selectedRecord)}
                disabled={deleting === selectedRecord.id}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 font-bold text-xs"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            )}
            <div className="flex items-center gap-2 flex-1 justify-end">
              <Button
                variant="outline"
                onClick={() => setIsSheetOpen(false)}
                className="h-11 px-5 border-2 border-slate-300 dark:border-slate-600 rounded-2xl font-bold text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#4361EE] hover:bg-blue-600 text-white font-black h-11 px-6 rounded-2xl border-2 border-slate-900 shadow-brutal-sm text-xs"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : isNewSheet ? "Cadastrar Ficha" : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* CONFIRM DELETE MODAL */}
      <Dialog open={!!recordToDelete} onOpenChange={(open) => !open && setRecordToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Excluir Ficha Médica?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Tem certeza que deseja remover a ficha médica de <strong className="text-slate-900 dark:text-white">&ldquo;{recordToDelete?.full_name}&rdquo;</strong> do sistema?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setRecordToDelete(null)}
              className="flex-1 rounded-xl text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={!!deleting}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              {deleting ? "Excluindo..." : "Sim, Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
