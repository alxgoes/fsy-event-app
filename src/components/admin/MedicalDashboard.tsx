"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  HeartPulse,
  Pill,
  AlertTriangle,
  FileText,
  PhoneCall,
  Save,
  Loader2,
  RefreshCw,
  Eye,
  CheckCircle2,
  Church,
  Calendar,
  Clock,
  UserCheck,
  Stethoscope,
  Check,
  X,
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
  contact_2_name?: string | null;
  contact_2_phone?: string | null;
  contact_2_relationship?: string | null;
  contact_3_name?: string | null;
  contact_3_phone?: string | null;
  contact_3_relationship?: string | null;
  bishop_name?: string | null;
  bishop_phone?: string | null;
  bishop_ward?: string | null;
  blood_type: string | null;
  doctor_notes: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MedicalAppointment {
  id: string;
  user_id?: string | null;
  medical_record_id?: string | null;
  youth_name: string;
  professional_name: string;
  reason: string;
  scheduled_at: string;
  status: "agendado" | "realizado" | "cancelado";
  is_seen: boolean;
  seen_at?: string | null;
  notes?: string | null;
  created_at: string;
}

interface RegisteredProfile {
  id: string;
  full_name: string;
  role: string;
  company_id: string | null;
  room: string | null;
  stake?: string | null;
  phone?: string | null;
}

const COMMON_ALLERGIES = [
  "Dipirona",
  "Penicilina",
  "Anti-inflamatórios",
  "Frutos do Mar",
  "Amendoim / Nozes",
  "Lactose",
  "Glúten",
  "Picada de Abelha",
  "Ovo",
  "Soja",
  "Corantes",
];

const COMMON_REASONS = [
  "Acompanhamento de Alergia",
  "Avaliação de Medicação Contínua",
  "Apoio Emocional / Psicológico",
  "Restrição Alimentar",
  "Avaliação de Febre / Sintomas",
  "Acompanhamento Geral",
];

export function MedicalDashboard() {
  // Active Tab: Records vs Appointments
  const [activeTab, setActiveTab] = useState<"records" | "appointments">("records");

  const [records, setRecords] = useState<YouthMedicalProfile[]>([]);
  const [appointments, setAppointments] = useState<MedicalAppointment[]>([]);
  const [registeredProfiles, setRegisteredProfiles] = useState<RegisteredProfile[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAllergy, setFilterAllergy] = useState(false);

  // Appointment filter & search
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<string>("all");

  // Selected record for View Modal and Edit Sheet
  const [viewingRecord, setViewingRecord] = useState<YouthMedicalProfile | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<YouthMedicalProfile | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isNewSheet, setIsNewSheet] = useState(false);

  // In-app Delete Confirmation state
  const [recordToDelete, setRecordToDelete] = useState<YouthMedicalProfile | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<Partial<YouthMedicalProfile>>({});
  const [profileSearchInForm, setProfileSearchInForm] = useState("");

  // Appointment Modal state
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [apptUserId, setApptUserId] = useState<string>("");
  const [apptYouthName, setApptYouthName] = useState<string>("");
  const [apptProfessional, setApptProfessional] = useState<string>("Dra. Camila (Médica)");
  const [apptReason, setApptReason] = useState<string>("Acompanhamento de Alergia");
  const [apptDate, setApptDate] = useState<string>("");
  const [apptNotes, setApptNotes] = useState<string>("");
  const [savingAppt, setSavingAppt] = useState(false);
  const [youthSelectSearch, setYouthSelectSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Medical Records
      const resMed = await fetch(`/api/medical?_t=${Date.now()}`);
      let data: Record<string, unknown>[] = [];
      if (resMed.ok) {
        const json = await resMed.json();
        if (json.data) data = json.data;
      }

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
          contact_2_name: item.contact_2_name ? String(item.contact_2_name) : null,
          contact_2_phone: item.contact_2_phone ? String(item.contact_2_phone) : null,
          contact_2_relationship: item.contact_2_relationship ? String(item.contact_2_relationship) : null,
          contact_3_name: item.contact_3_name ? String(item.contact_3_name) : null,
          contact_3_phone: item.contact_3_phone ? String(item.contact_3_phone) : null,
          contact_3_relationship: item.contact_3_relationship ? String(item.contact_3_relationship) : null,
          bishop_name: item.bishop_name ? String(item.bishop_name) : null,
          bishop_phone: item.bishop_phone ? String(item.bishop_phone) : null,
          bishop_ward: item.bishop_ward ? String(item.bishop_ward) : null,
          blood_type: item.blood_type ? String(item.blood_type) : null,
          doctor_notes: item.doctor_notes ? String(item.doctor_notes) : null,
          created_at: String(item.created_at || new Date().toISOString()),
        };
      });
      setRecords(normalized);

      // 2. Fetch Appointments
      const resAppts = await fetch(`/api/medical/appointments?_t=${Date.now()}`);
      if (resAppts.ok) {
        const json = await resAppts.json();
        setAppointments(json.data ?? []);
      }

      // 3. Fetch Registered Profiles for linking and appointment scheduling
      const resUsers = await fetch(`/api/users?_t=${Date.now()}`);
      if (resUsers.ok) {
        const json = await resUsers.json();
        setRegisteredProfiles(json.users ?? []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao carregar dados médicos: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openView = (record: YouthMedicalProfile) => {
    setViewingRecord(record);
    setIsViewModalOpen(true);
  };

  const openEdit = (record: YouthMedicalProfile) => {
    setViewingRecord(null);
    setSelectedRecord(record);
    setEditForm({ ...record });
    setProfileSearchInForm("");
    setIsNewSheet(false);
    setIsSheetOpen(true);
  };

  const openNew = () => {
    setSelectedRecord(null);
    setEditForm({
      user_id: null,
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
      contact_2_name: "",
      contact_2_phone: "",
      contact_2_relationship: "",
      contact_3_name: "",
      contact_3_phone: "",
      contact_3_relationship: "",
      bishop_name: "",
      bishop_phone: "",
      bishop_ward: "",
      blood_type: "",
      doctor_notes: "",
    });
    setProfileSearchInForm("");
    setIsNewSheet(true);
    setIsSheetOpen(true);
  };

  // Helper to link a registered user profile to the medical record being edited
  const handleLinkProfile = (p: RegisteredProfile) => {
    setEditForm((f) => ({
      ...f,
      user_id: p.id,
      full_name: p.full_name,
      company_id: p.company_id || f.company_id || "",
      room: p.room || f.room || "",
    }));
  };

  const handleUnlinkProfile = () => {
    setEditForm((f) => ({
      ...f,
      user_id: null,
    }));
  };

  const handleSave = async () => {
    if (!editForm.full_name?.trim()) {
      setError("Nome do participante é obrigatório.");
      return;
    }
    setSaving(true);
    setError(null);

    const allergiesStr = (editForm.allergies || []).join(", ");
    const medsStr = (editForm.medications || []).join(", ");

    const payload: Record<string, unknown> = {
      full_name: editForm.full_name.trim(),
      user_id: editForm.user_id || null,
      company_id: editForm.company_id?.trim() || null,
      room: editForm.room?.trim() || null,
      allergies: allergiesStr,
      is_severe_allergy: Boolean(editForm.is_severe_allergy),
      dietary_restrictions: editForm.dietary_restrictions?.trim() || null,
      medications: medsStr,
      emergency_contact_name: editForm.emergency_contact_name?.trim() || "Não informado",
      emergency_contact_phone: editForm.emergency_contact_phone?.trim() || "Não informado",
      emergency_contact_rel: editForm.emergency_contact_relationship?.trim() || "Responsável",
      contact_2_name: editForm.contact_2_name?.trim() || null,
      contact_2_phone: editForm.contact_2_phone?.trim() || null,
      contact_2_rel: editForm.contact_2_relationship?.trim() || null,
      contact_3_name: editForm.contact_3_name?.trim() || null,
      contact_3_phone: editForm.contact_3_phone?.trim() || null,
      contact_3_rel: editForm.contact_3_relationship?.trim() || null,
      bishop_name: editForm.bishop_name?.trim() || null,
      bishop_phone: editForm.bishop_phone?.trim() || null,
      bishop_ward: editForm.bishop_ward?.trim() || null,
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
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

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

  // Appointment scheduling handler
  const openNewAppointmentModal = (preselectedYouth?: { id?: string; name: string }) => {
    if (preselectedYouth) {
      setApptUserId(preselectedYouth.id || "");
      setApptYouthName(preselectedYouth.name);
    } else {
      setApptUserId("");
      setApptYouthName("");
    }
    setApptProfessional("Dra. Camila (Médica)");
    setApptReason("Acompanhamento de Alergia");
    setApptDate("2027-02-06T14:30");
    setApptNotes("");
    setYouthSelectSearch("");
    setIsAppointmentModalOpen(true);
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apptYouthName.trim()) {
      setError("Selecione ou digite o nome do jovem para o atendimento.");
      return;
    }
    if (!apptDate) {
      setError("Defina a data e o horário do atendimento.");
      return;
    }
    if (!apptProfessional.trim()) {
      setError("Informe o nome do profissional da equipe multidisciplinar.");
      return;
    }

    setSavingAppt(true);
    setError(null);

    try {
      const payload = {
        user_id: apptUserId || null,
        youth_name: apptYouthName.trim(),
        professional_name: apptProfessional.trim(),
        reason: apptReason.trim() || "Atendimento geral",
        scheduled_at: apptDate,
        notes: apptNotes.trim() || null,
      };

      const res = await fetch("/api/medical/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "Erro ao agendar consulta.");
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setIsAppointmentModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao agendar";
      setError(msg);
    } finally {
      setSavingAppt(false);
    }
  };

  const handleUpdateAppointmentStatus = async (apptId: string, newStatus: "agendado" | "realizado" | "cancelado") => {
    try {
      const res = await fetch("/api/medical/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: apptId, status: newStatus }),
      });

      if (res.ok) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === apptId ? { ...a, status: newStatus } : a))
        );
      }
    } catch (err) {
      console.error("Error updating appointment status:", err);
    }
  };

  const handleDeleteAppointment = async (apptId: string) => {
    try {
      const res = await fetch(`/api/medical/appointments?id=${apptId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== apptId));
      }
    } catch (err) {
      console.error("Error deleting appointment:", err);
    }
  };

  // Filtered records
  const filtered = records.filter((r) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      r.full_name.toLowerCase().includes(q) ||
      (r.company_id && r.company_id.toLowerCase().includes(q)) ||
      (r.room && r.room.toLowerCase().includes(q)) ||
      (r.bishop_name && r.bishop_name.toLowerCase().includes(q)) ||
      (r.bishop_ward && r.bishop_ward.toLowerCase().includes(q)) ||
      r.allergies.some((a) => a.toLowerCase().includes(q));

    const matchAllergy = filterAllergy ? r.is_severe_allergy : true;
    return matchSearch && matchAllergy;
  });

  // Filtered appointments
  const filteredAppointments = appointments.filter((a) => {
    const q = appointmentSearch.toLowerCase();
    const matchSearch =
      a.youth_name.toLowerCase().includes(q) ||
      a.professional_name.toLowerCase().includes(q) ||
      a.reason.toLowerCase().includes(q);

    const matchStatus =
      appointmentStatusFilter === "all" || a.status === appointmentStatusFilter;

    return matchSearch && matchStatus;
  });

  const severeCount = records.filter((r) => r.is_severe_allergy).length;
  const pendingAppointmentsCount = appointments.filter((a) => a.status === "agendado").length;

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-white font-black border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm">
              <Stethoscope className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  Equipe Multidisciplinar
                </h1>
                <Badge className="bg-emerald-600 text-white text-[10px] font-black uppercase">
                  Saúde & Inclusão
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                Registros médicos, vínculos de perfil e agendamentos de consultas com os participantes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && (
            <span className="flex items-center gap-1 text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 motion-safe:animate-pulse motion-reduce:animate-none">
              <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso!
            </span>
          )}

          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="rounded-xl border-2 border-slate-300 dark:border-slate-700 font-bold text-xs min-h-[36px]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Atualizar
          </Button>

          <Button
            onClick={() => openNewAppointmentModal()}
            className="bg-[#06D6A0] hover:bg-emerald-400 text-emerald-950 font-black rounded-xl border-2 border-slate-900 shadow-sm text-xs min-h-[36px]"
          >
            <Calendar className="h-4 w-4 mr-1" />
            Marcar Atendimento
          </Button>

          <Button
            onClick={openNew}
            className="bg-[#007DA5] hover:bg-[#005E7C] text-white font-black rounded-xl border-2 border-slate-900 shadow-sm text-xs min-h-[36px]"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Ficha Médica
          </Button>
        </div>
      </div>

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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b-2 border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("records")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-black border-2 transition-all min-h-[40px] ${
            activeTab === "records"
              ? "bg-slate-900 text-white dark:bg-[#007DA5] border-slate-900 dark:border-sky-400 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-900 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <FileText className="h-4 w-4" />
          Fichas Médicas ({records.length})
        </button>

        <button
          onClick={() => setActiveTab("appointments")}
          className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-black border-2 transition-all min-h-[40px] ${
            activeTab === "appointments"
              ? "bg-slate-900 text-white dark:bg-[#007DA5] border-slate-900 dark:border-sky-400 shadow-sm"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-900 dark:border-slate-700 hover:bg-slate-50"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Agendamentos & Consultas ({appointments.length})
          {pendingAppointmentsCount > 0 && (
            <span className="rounded-full bg-[#FC4E6D] text-white text-xs font-black px-1.5 py-0.2">
              {pendingAppointmentsCount}
            </span>
          )}
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: FICHAS MÉDICAS                                    */}
      {/* ======================================================== */}
      {activeTab === "records" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-4 rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-500">Total de Fichas</span>
                <FileText className="h-5 w-5 text-[#007DA5]" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{records.length}</p>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">Participantes cadastrados</p>
            </Card>

            <Card className="p-4 rounded-3xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/40 shadow-brutal-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-rose-700 dark:text-rose-300">Alergias Graves</span>
                <ShieldAlert className="h-5 w-5 text-rose-600 animate-pulse" />
              </div>
              <p className="text-3xl font-black text-rose-700 dark:text-rose-300 mt-2">{severeCount}</p>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">Atenção especial da equipe</p>
            </Card>

            <Card className="p-4 rounded-3xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/40 shadow-brutal-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300">Dietas / Restrições</span>
                <HeartPulse className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-3xl font-black text-amber-700 dark:text-amber-300 mt-2">
                {records.filter((r) => r.dietary_restrictions && r.dietary_restrictions !== "Nenhuma").length}
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">Alimentação diferenciada</p>
            </Card>
          </div>

          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, companhia, quarto, bispo ou alergia..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-sm bg-white dark:bg-slate-900"
              />
            </div>

            <Button
              variant={filterAllergy ? "default" : "outline"}
              onClick={() => setFilterAllergy(!filterAllergy)}
              className={`rounded-2xl border-2 h-11 text-xs font-black ${
                filterAllergy
                  ? "bg-rose-600 text-white border-slate-900"
                  : "border-slate-300 dark:border-slate-700"
              }`}
            >
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              {filterAllergy ? "Mostrando Apenas Graves" : "Filtrar Alergias Graves"}
            </Button>
          </div>

          {/* Medical Records Table */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-30 text-[#007DA5]" />
              <p className="font-black text-base text-slate-700 dark:text-slate-300">Nenhuma ficha médica encontrada</p>
              <p className="text-xs max-w-sm mx-auto">
                Clique em &ldquo;Nova Ficha Médica&rdquo; para cadastrar os registros da sua equipe.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white pl-6">Participante</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">Cia / Quarto</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">Gravidade / Alergias</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">Contato Principal</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">Bispo da Ala</TableHead>
                    <TableHead className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white pr-6 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((record) => (
                    <TableRow
                      key={record.id}
                      className={`border-b border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                        record.is_severe_allergy ? "bg-rose-50/40 dark:bg-rose-950/20" : ""
                      }`}
                    >
                      <TableCell className="pl-6 font-bold text-sm cursor-pointer" onClick={() => openView(record)}>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 border border-slate-300 dark:border-slate-600">
                            <AvatarFallback className="bg-slate-900 text-white text-xs font-black">
                              {record.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-slate-900 dark:text-white font-black leading-tight flex items-center gap-1.5">
                              {record.full_name}
                              {record.user_id && (
                                <span className="text-[10px] bg-sky-100 text-[#007DA5] dark:bg-sky-950 dark:text-cyan-300 px-1.5 py-0.2 rounded font-black">
                                   Conta Vinculada
                                </span>
                              )}
                              {record.blood_type && (
                                <span className="text-xs bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 px-1.5 py-0.2 rounded font-black border border-red-300">
                                  {record.blood_type}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="cursor-pointer" onClick={() => openView(record)}>
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-xs font-bold text-[#007DA5]">
                            {record.company_id || "Sem Cia"}
                          </span>
                          {record.room && (
                            <p className="text-xs font-bold text-slate-500">Qto: {record.room}</p>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="cursor-pointer" onClick={() => openView(record)}>
                        {record.is_severe_allergy ? (
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" />
                              Grave / Anafilaxia
                            </Badge>
                          </div>
                        ) : record.allergies.length === 0 ? (
                          <span className="text-xs font-bold text-slate-400">Nenhuma alergia</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {record.allergies.slice(0, 2).map((a) => (
                              <Badge key={a} variant="outline" className="text-xs font-bold text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50">
                                {a}
                              </Badge>
                            ))}
                            {record.allergies.length > 2 && (
                              <Badge variant="outline" className="text-xs font-bold text-slate-500">
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
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <PhoneCall className="h-3 w-3 text-[#007DA5]" /> {record.emergency_contact_phone}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">—</span>
                        )}
                      </TableCell>

                      <TableCell className="cursor-pointer" onClick={() => openView(record)}>
                        {record.bishop_name ? (
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <Church className="h-3 w-3 text-purple-600" />
                              {record.bishop_name}
                            </p>
                            <p className="text-xs font-bold text-purple-600 dark:text-purple-400">
                              {record.bishop_phone || record.bishop_ward || "Bispo da Ala"}
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
                            onClick={() => openNewAppointmentModal({ id: record.user_id || undefined, name: record.full_name })}
                            title="Marcar Horário / Consulta"
                            className="h-8 px-2 text-xs font-bold text-[#06D6A0] hover:text-emerald-600 min-h-[36px]"
                          >
                            <Calendar className="h-3.5 w-3.5 mr-1" /> Consulta
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openView(record)}
                            title="Visualizar Detalhes"
                            className="h-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#007DA5] min-h-[36px]"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(record)}
                            title="Editar Ficha"
                            className="h-8 px-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-[#007DA5] min-h-[36px]"
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
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: AGENDAMENTOS & CONSULTAS                          */}
      {/* ======================================================== */}
      {activeTab === "appointments" && (
        <div className="space-y-6">
          {/* Appointment Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar consulta por nome do jovem, profissional ou motivo..."
                value={appointmentSearch}
                onChange={(e) => setAppointmentSearch(e.target.value)}
                className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-sm bg-white dark:bg-slate-900"
              />
            </div>

            <select
              value={appointmentStatusFilter}
              onChange={(e) => setAppointmentStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white"
            >
              <option value="all">Todos os Status</option>
              <option value="agendado">Apenas Agendados</option>
              <option value="realizado">Apenas Realizados</option>
              <option value="cancelado">Cancelados</option>
            </select>

            <Button
              onClick={() => openNewAppointmentModal()}
              className="bg-[#06D6A0] hover:bg-emerald-400 text-emerald-950 font-black rounded-2xl border-2 border-slate-900 shadow-sm text-xs h-11 shrink-0 min-h-[36px]"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Marcar Novo Horário
            </Button>
          </div>

          {/* Appointments Grid */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center text-slate-400 space-y-2">
              <Calendar className="h-10 w-10 mx-auto opacity-30 text-emerald-500" />
              <p className="font-heading text-base font-black text-slate-700 dark:text-slate-300">
                Nenhum atendimento agendado
              </p>
              <p className="text-xs max-w-sm mx-auto">
                Clique no botão &ldquo;Marcar Novo Horário&rdquo; para selecionar um jovem registrado e marcar uma conversa com a Equipe Multidisciplinar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAppointments.map((appt) => {
                const isRealizado = appt.status === "realizado";
                const isCancelado = appt.status === "cancelado";

                return (
                  <div
                    key={appt.id}
                    className={`rounded-3xl border-2 p-5 shadow-sm flex flex-col justify-between transition-all ${
                      isRealizado
                        ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                        : isCancelado
                        ? "border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 opacity-60"
                        : "border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div>
                      {/* Status and Time Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`text-xs font-black uppercase px-2 py-0.5 rounded-lg border ${
                            isRealizado
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                              : isCancelado
                              ? "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400"
                              : "bg-[#FFE48A] text-amber-950 border-amber-500/40 font-black"
                          }`}
                        >
                          {appt.status.toUpperCase()}
                        </span>

                        <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                          <Clock className="h-3.5 w-3.5 text-[#007DA5]" />
                          <span>
                            {new Date(appt.scheduled_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Youth Name */}
                      <h3 className="font-heading text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                        {appt.youth_name}
                      </h3>

                      {/* Professional */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
                        <Stethoscope className="h-3.5 w-3.5 text-[#06D6A0]" />
                        <span>Profissional: <strong>{appt.professional_name}</strong></span>
                      </div>

                      {/* Reason */}
                      <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                        <span className="text-[10px] font-black uppercase text-slate-400 block mb-0.5">
                          Motivo da Consulta
                        </span>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {appt.reason}
                        </p>
                        {appt.notes && (
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                            Obs: {appt.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {appt.status !== "realizado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateAppointmentStatus(appt.id, "realizado")}
                            className="h-8 text-[11px] font-black text-emerald-600 border-emerald-300 hover:bg-emerald-50 rounded-xl"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Realizado
                          </Button>
                        )}
                        {appt.status !== "cancelado" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUpdateAppointmentStatus(appt.id, "cancelado")}
                            className="h-8 text-[11px] font-bold text-slate-500 hover:text-slate-700 rounded-xl"
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteAppointment(appt.id)}
                        className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                        title="Excluir Agendamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: MARCAR ATENDIMENTO / CONSULTA                     */}
      {/* ======================================================== */}
      <Dialog open={isAppointmentModalOpen} onOpenChange={setIsAppointmentModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-[#06D6A0]" />
              Marcar Horário com Jovem
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              Selecione um jovem dentre os usuários registrados no evento ou digite o nome para salvar o agendamento no banco de dados.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAppointment} className="space-y-4 py-2">
            {/* Youth Selection */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white mb-1">
                Selecionar Jovem Registrado *
              </label>

              <div className="space-y-2">
                <Input
                  placeholder="Pesquisar participante por nome ou quarto..."
                  value={youthSelectSearch}
                  onChange={(e) => setYouthSelectSearch(e.target.value)}
                  className="rounded-xl border-2 border-slate-300 dark:border-slate-700 text-xs"
                />

                <div className="max-h-36 overflow-y-auto rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1.5 space-y-1">
                  {registeredProfiles
                    .filter((p) =>
                      p.full_name
                        .toLowerCase()
                        .includes(youthSelectSearch.toLowerCase())
                    )
                    .slice(0, 10)
                    .map((p) => {
                      const isSelected = apptUserId === p.id || apptYouthName === p.full_name;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setApptUserId(p.id);
                            setApptYouthName(p.full_name);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                            isSelected
                              ? "bg-[#007DA5] text-white font-black"
                              : "hover:bg-slate-200 dark:hover:bg-slate-800 font-bold"
                          }`}
                        >
                          <span>{p.full_name}</span>
                          <span className="text-[10px] opacity-80">
                            {p.company_id || "Sem Cia"} {p.room ? `• Qto ${p.room}` : ""}
                          </span>
                        </button>
                      );
                    })}
                </div>

                {/* Manual name override option */}
                <div className="pt-1">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">
                    Ou digite o nome manualmente (se o jovem não estiver registrado):
                  </label>
                  <Input
                    value={apptYouthName}
                    onChange={(e) => {
                      setApptYouthName(e.target.value);
                      setApptUserId("");
                    }}
                    placeholder="Nome do jovem"
                    className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Professional & DateTime */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-900 dark:text-white mb-1">
                  Com quem será a consulta? *
                </label>
                <Input
                  value={apptProfessional}
                  onChange={(e) => setApptProfessional(e.target.value)}
                  placeholder="ex: Dra. Camila (Médica) ou Dr. Lucas (Psicólogo)"
                  className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-900 dark:text-white mb-1">
                  Data e Horário *
                </label>
                <Input
                  type="datetime-local"
                  value={apptDate}
                  onChange={(e) => setApptDate(e.target.value)}
                  className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-bold"
                />
              </div>
            </div>

            {/* Motivos / Reasons */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white mb-1">
                Motivo da Consulta *
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COMMON_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setApptReason(r)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors ${
                      apptReason === r
                        ? "bg-emerald-600 text-white border-emerald-700"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Input
                value={apptReason}
                onChange={(e) => setApptReason(e.target.value)}
                placeholder="Descreva o motivo da consulta..."
                className="rounded-xl border-2 border-slate-900 dark:border-slate-700 text-xs font-bold"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-black text-slate-900 dark:text-white mb-1">
                Observações Confidenciais (Opcional)
              </label>
              <Input
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                placeholder="ex: Levar resultados de exame ou medicamento às 15h"
                className="rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAppointmentModalOpen(false)}
                className="rounded-2xl text-xs font-black"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingAppt}
                className="rounded-2xl bg-[#06D6A0] hover:bg-emerald-400 text-emerald-950 font-black text-xs shadow-sm min-h-[36px]"
              >
                {savingAppt ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Salvando no Banco...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-1.5" />
                    Confirmar Agendamento
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* VIEW MODAL (👁️ Ver Ficha)                                */}
      {/* ======================================================== */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[620px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          {viewingRecord && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-[#007DA5] text-white flex items-center justify-center font-black text-lg border-2 border-slate-900 shadow-sm shrink-0">
                      {viewingRecord.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">
                        {viewingRecord.full_name}
                      </DialogTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {viewingRecord.company_id && (
                          <Badge variant="outline" className="text-xs font-bold bg-sky-50 dark:bg-sky-950 text-[#007DA5] dark:text-cyan-300">
                            {viewingRecord.company_id}
                          </Badge>
                        )}
                        {viewingRecord.room && (
                          <Badge variant="outline" className="text-xs font-bold">
                            Quarto: {viewingRecord.room}
                          </Badge>
                        )}
                        {viewingRecord.user_id && (
                          <Badge className="text-xs font-black bg-sky-100 dark:bg-sky-950 text-[#007DA5] border border-sky-300">
                            Conta Vinculada
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

              {/* Emergency Contacts */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-600 dark:text-purple-400">
                  <PhoneCall className="h-4 w-4" />
                  <span>Contatos de Emergência & Responsáveis</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] font-black uppercase text-purple-600 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded">
                      1. Principal ({viewingRecord.emergency_contact_relationship || "Responsável"})
                    </span>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
                      {viewingRecord.emergency_contact_name || "Não informado"}
                    </p>
                  </div>
                  {viewingRecord.emergency_contact_phone && (
                    <a
                      href={`tel:${viewingRecord.emergency_contact_phone.replace(/\D/g, "")}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-colors shadow-sm self-start sm:self-auto"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      Ligar: {viewingRecord.emergency_contact_phone}
                    </a>
                  )}
                </div>

                {viewingRecord.contact_2_name && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded">
                        2. Secundário ({viewingRecord.contact_2_relationship || "Contato Adicional"})
                      </span>
                      <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
                        {viewingRecord.contact_2_name}
                      </p>
                    </div>
                    {viewingRecord.contact_2_phone && (
                      <a
                        href={`tel:${viewingRecord.contact_2_phone.replace(/\D/g, "")}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-700 transition-colors shadow-sm self-start sm:self-auto"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        Ligar: {viewingRecord.contact_2_phone}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Bishop Section */}
              {viewingRecord.bishop_name && (
                <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border-2 border-purple-200 dark:border-purple-800/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-purple-700 dark:text-purple-300">
                    <Church className="h-4 w-4" />
                    <span>Liderança Eclesiástica — Bispo da Ala</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {viewingRecord.bishop_name}
                      </p>
                      {viewingRecord.bishop_ward && (
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                          Ala / Ramo: {viewingRecord.bishop_ward}
                        </p>
                      )}
                    </div>
                    {viewingRecord.bishop_phone && (
                      <a
                        href={`tel:${viewingRecord.bishop_phone.replace(/\D/g, "")}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 text-white font-black text-xs hover:bg-purple-800 transition-colors shadow-sm self-start sm:self-auto"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        Ligar: {viewingRecord.bishop_phone}
                      </a>
                    )}
                  </div>
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
                    className="bg-[#007DA5] hover:bg-[#005E7C] text-white font-black rounded-xl text-xs min-h-[36px]"
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

      {/* ======================================================== */}
      {/* EDIT / CREATE DRAWER SHEET (Com Vínculo Opcional)        */}
      {/* ======================================================== */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-white dark:bg-slate-900 border-l-2 border-slate-900 dark:border-slate-700 p-0">
          <div className="p-6 border-b-2 border-slate-200 dark:border-slate-800 sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md z-10">
            <SheetHeader>
              <SheetTitle className="text-xl font-black text-slate-900 dark:text-white">
                {isNewSheet ? "Cadastrar Nova Ficha Médica" : `Editar: ${editForm.full_name || "Participante"}`}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500 font-semibold">
                Preencha os dados médicos e de contato do jovem. Você pode vincular a uma conta cadastrada ou salvar de forma avulsa.
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* OPTIONAL PROFILE LINK SECTION */}
            <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#007DA5]" />
                  <span className="text-xs font-black uppercase text-slate-900 dark:text-white">
                    Vincular a Usuário Registrado (Opcional)
                  </span>
                </div>
                <Badge variant="outline" className="text-xs font-bold text-slate-500">
                  Não Obrigatório
                </Badge>
              </div>

              {editForm.user_id ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#007DA5]" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      Vinculado a: <strong>{editForm.full_name}</strong>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleUnlinkProfile}
                    className="h-7 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
                  >
                    <X className="h-3 w-3 mr-1" /> Desvincular
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar jovem registrado para preenchimento automático..."
                    value={profileSearchInForm}
                    onChange={(e) => setProfileSearchInForm(e.target.value)}
                    className="rounded-xl border border-slate-300 dark:border-slate-700 text-xs"
                  />

                  {profileSearchInForm && (
                    <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 space-y-1">
                      {registeredProfiles
                        .filter((p) =>
                          p.full_name
                            .toLowerCase()
                            .includes(profileSearchInForm.toLowerCase())
                        )
                        .slice(0, 6)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              handleLinkProfile(p);
                              setProfileSearchInForm("");
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <span className="font-bold">{p.full_name}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {p.company_id || "Sem Cia"} {p.room ? `• Qto ${p.room}` : ""}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Caso o jovem ainda não possua conta no site, basta preencher o nome no campo abaixo normalmente.
                  </p>
                </div>
              )}
            </div>

            {/* 1. Identification */}
            <section className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Identificação do Participante
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                    Nome Completo *
                  </label>
                  <Input
                    value={editForm.full_name ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                    placeholder="Nome completo do participante"
                    className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Companhia
                    </label>
                    <Input
                      value={editForm.company_id ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, company_id: e.target.value }))}
                      placeholder="Ex: Cia-1"
                      className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Quarto
                    </label>
                    <Input
                      value={editForm.room ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, room: e.target.value }))}
                      placeholder="Ex: 204"
                      className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                      Tipo Sanguíneo
                    </label>
                    <Input
                      value={editForm.blood_type ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, blood_type: e.target.value }))}
                      placeholder="Ex: O+, A-"
                      className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Allergies */}
            <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Alergias e Gravidade
              </h3>

              <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40">
                <input
                  type="checkbox"
                  id="is_severe"
                  checked={Boolean(editForm.is_severe_allergy)}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_severe_allergy: e.target.checked }))}
                  className="h-4 w-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="is_severe" className="text-xs font-black text-rose-900 dark:text-rose-200 cursor-pointer">
                  Alergia Grave / Risco de Anafilaxia (Alerta Vermelho)
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_ALLERGIES.map((allergy) => {
                  const has = (editForm.allergies || []).includes(allergy);
                  return (
                    <button
                      key={allergy}
                      type="button"
                      onClick={() => {
                        setEditForm((f) => {
                          const current = f.allergies || [];
                          return {
                            ...f,
                            allergies: has ? current.filter((a) => a !== allergy) : [...current, allergy],
                          };
                        });
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors ${
                        has
                          ? "bg-amber-500 text-amber-950 border-amber-600"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {allergy} {has && "✓"}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 3. Dietary & Medications */}
            <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                3. Restrições e Medicamentos
              </h3>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Restrição Alimentar
                </label>
                <Input
                  value={editForm.dietary_restrictions ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, dietary_restrictions: e.target.value }))}
                  placeholder="Ex: Vegetariano, Sem Lactose, Sem Glúten..."
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                />
              </div>

              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block mb-1">
                  Medicações de Uso Contínuo (separadas por vírgula)
                </label>
                <Input
                  value={(editForm.medications || []).join(", ")}
                  onChange={(e) => {
                    const parsed = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                    setEditForm((f) => ({ ...f, medications: parsed }));
                  }}
                  placeholder="Ex: Insulina, Ritalina, Bombinha de Asma"
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-sm h-11"
                />
              </div>
            </section>

            {/* 4. Emergency Contacts */}
            <section className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                4. Contatos de Emergência
              </h3>

              {/* Contact 1 */}
              <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-2">
                <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300">
                  Contato 1 (Principal)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    value={editForm.emergency_contact_name ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
                    placeholder="Nome do responsável"
                    className="sm:col-span-2 text-xs font-bold"
                  />
                  <Input
                    value={editForm.emergency_contact_phone ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
                    placeholder="Telefone / WhatsApp"
                    className="text-xs font-bold"
                  />
                </div>
              </div>

              {/* Bishop */}
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Church className="h-3.5 w-3.5 text-purple-600" />
                  Bispo da Ala
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    value={editForm.bishop_name ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, bishop_name: e.target.value }))}
                    placeholder="Nome do Bispo"
                    className="text-xs font-bold"
                  />
                  <Input
                    value={editForm.bishop_phone ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, bishop_phone: e.target.value }))}
                    placeholder="Telefone do Bispo"
                    className="text-xs font-bold"
                  />
                  <Input
                    value={editForm.bishop_ward ?? ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, bishop_ward: e.target.value }))}
                    placeholder="Nome da Ala"
                    className="text-xs font-bold"
                  />
                </div>
              </div>
            </section>

            {/* 5. Doctor Notes */}
            <section className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800">
              <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-400 block">
                Observações Clínicas da Equipe Multidisciplinar
              </label>
              <Input
                value={editForm.doctor_notes ?? ""}
                onChange={(e) => setEditForm((f) => ({ ...f, doctor_notes: e.target.value }))}
                placeholder="Histórico clínico relevante, recomendações ou cuidados..."
                className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-11"
              />
            </section>
          </div>

          <div className="p-6 border-t-2 border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSheetOpen(false)}
              className="rounded-2xl border-2 text-xs font-black"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-[#007DA5] hover:bg-[#005E7C] text-white font-black text-xs shadow-sm px-6 min-h-[36px]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  Salvar Ficha Médica
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Record Confirmation Modal */}
      <Dialog
        open={!!recordToDelete}
        onOpenChange={(open) => !open && setRecordToDelete(null)}
      >
        <DialogContent className="sm:max-w-md rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-brutal-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-black text-rose-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Excluir Ficha Médica
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 dark:text-slate-400">
              Tem certeza que deseja remover a ficha médica de <strong>{recordToDelete?.full_name}</strong>? Esta ação não poderá ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRecordToDelete(null)}
              className="rounded-2xl text-xs font-black"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDelete}
              disabled={!!deleting}
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Excluindo...
                </>
              ) : (
                "Sim, Excluir Ficha"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
