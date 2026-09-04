"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  MapPin,
  Sparkles,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Save,
  RefreshCw,
  CheckCircle2,
  Database,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { GooeyButton } from "@/components/ui/GooeyButton";
import { GooeyPillTabs } from "@/components/ui/GooeyPillTabs";

interface ScheduleItem {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string | null;
  category: string | null;
  day: string;
  date: string | null;
  is_highlight: boolean;
}

const DAY_TABS = [
  { key: "all", label: "Todos os Dias" },
  { key: "dia0", label: "Dia Zero (Sexta 05/02 • Consultores)", defaultDate: "2027-02-05" },
  { key: "dia1", label: "1º Dia (Sábado 06/02 • Chegada Jovens)", defaultDate: "2027-02-06" },
  { key: "dia2", label: "2º Dia (Domingo 07/02)", defaultDate: "2027-02-07" },
  { key: "dia3", label: "3º Dia (Segunda 08/02)", defaultDate: "2027-02-08" },
  { key: "dia4", label: "4º Dia (Terça 09/02)", defaultDate: "2027-02-09" },
  { key: "dia5", label: "5º Dia (Quarta 10/02)", defaultDate: "2027-02-10" },
];

const DAY_DEFAULT_DATES: Record<string, string> = {
  dia0: "2027-02-05",
  dia1: "2027-02-06",
  dia2: "2027-02-07",
  dia3: "2027-02-08",
  dia4: "2027-02-09",
  dia5: "2027-02-10",
};

export function ScheduleManager() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedDayTab, setSelectedDayTab] = useState<string>("dia1");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Custom Delete Dialog state
  const [itemToDelete, setItemToDelete] = useState<ScheduleItem | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  // Form State with direct reactive control
  const [formTitle, setFormTitle] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("Atividade");
  const [formDay, setFormDay] = useState("dia1");
  const [formDate, setFormDate] = useState("2027-02-06");
  const [formIsHighlight, setFormIsHighlight] = useState(false);

  const handleDayChange = (newDay: string) => {
    setFormDay(newDay);
    if (DAY_DEFAULT_DATES[newDay]) {
      setFormDate(DAY_DEFAULT_DATES[newDay]);
    }
  };

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First try API route
      const res = await fetch("/api/schedule");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setItems(json.data);
          setLoading(false);
          return;
        }
      }

      // Fallback to Supabase client
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("schedule_items")
        .select("*")
        .order("day")
        .order("start_time");

      if (fetchError) {
        setError("Erro ao carregar cronograma: " + fetchError.message);
      } else {
        setItems((data as ScheduleItem[]) ?? []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao conectar com cronograma: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormErrors({});
    const dayKey = selectedDayTab === "all" ? "dia1" : selectedDayTab;
    setFormTitle("");
    setFormStartTime("");
    setFormEndTime("");
    setFormLocation("");
    setFormDescription("");
    setFormCategory("Atividade");
    setFormDay(dayKey);
    setFormDate(DAY_DEFAULT_DATES[dayKey] || "2027-02-06");
    setFormIsHighlight(false);
    setIsDialogOpen(true);
  };

  const handleOpenEditModal = (item: ScheduleItem) => {
    setEditingItem(item);
    setFormErrors({});
    setFormTitle(item.title);
    setFormStartTime(item.start_time);
    setFormEndTime(item.end_time && item.end_time !== "--" ? item.end_time : "");
    setFormLocation(item.location);
    setFormDescription(item.description || "");
    setFormCategory(item.category || "Atividade");
    setFormDay(item.day);
    setFormDate(item.date || DAY_DEFAULT_DATES[item.day] || "2027-02-06");
    setFormIsHighlight(Boolean(item.is_highlight));
    setIsDialogOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formTitle.trim()) {
      errors.title = "Informe o título da atividade";
    }
    if (!formStartTime.trim()) {
      errors.start_time = "Informe o horário de início (Ex: 08:30)";
    }
    if (!formLocation.trim()) {
      errors.location = "Informe o local do evento";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: formTitle.trim(),
        start_time: formStartTime.trim(),
        end_time: formEndTime.trim() || "--",
        location: formLocation.trim(),
        description: formDescription.trim() || null,
        category: formCategory || "Atividade",
        day: formDay,
        date: formDate.trim() || DAY_DEFAULT_DATES[formDay] || "2027-02-06",
        is_highlight: Boolean(formIsHighlight),
      };

      let res;
      if (editingItem) {
        res = await fetch("/api/schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
      } else {
        res = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao salvar evento no banco de dados.");
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setIsDialogOpen(false);
      await loadSchedule();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar evento";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete.id;
    setDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/schedule?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao remover evento");
      }

      setItems((prev) => prev.filter((i) => i.id !== id));
      setItemToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover evento";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const handleSyncOfficial = async () => {
    setSeeding(true);
    setError(null);

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed", overwrite: true }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao sincronizar atividades.");
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
      setIsSyncModalOpen(false);
      await loadSchedule();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao sincronizar";
      setError(msg);
    } finally {
      setSeeding(false);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesDay = selectedDayTab === "all" || item.day === selectedDayTab;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;

    return matchesDay && matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case "Espiritual":
        return "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "Alimentação":
        return "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Show":
        return "bg-pink-100 dark:bg-pink-950/80 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800";
      case "Baile":
        return "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      case "Logística":
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
      case "Equipe":
        return "bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800";
      default:
        return "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
  };

  const getDayCount = (dayKey: string) => {
    if (dayKey === "all") return items.length;
    return items.filter((i) => i.day === dayKey).length;
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Gestão do Cronograma Oficial
            </h1>
            <Badge className="bg-[#007DA5] text-white text-xs font-black uppercase">
              FSY 2027 Live
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            05 a 10 de Fevereiro de 2027 — Todas as alterações refletem em tempo real no portal dos jovens.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && (
            <span className="flex items-center gap-1 text-sm font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 motion-safe:animate-pulse motion-reduce:animate-none">
              <CheckCircle2 className="h-4 w-4" /> Atualizado!
            </span>
          )}

          <GooeyButton
            variant="gold"
            size="sm"
            onClick={() => setIsSyncModalOpen(true)}
            disabled={seeding}
            loading={seeding}
            icon={<Database className="h-3.5 w-3.5 text-amber-900 dark:text-amber-300" />}
          >
            {seeding ? "Sincronizando..." : "Sincronizar Oficial"}
          </GooeyButton>

          <GooeyButton
            variant="outline"
            size="sm"
            onClick={loadSchedule}
            loading={loading}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            iconColor="text-emerald-600 dark:text-emerald-400"
          >
            Atualizar
          </GooeyButton>

          <GooeyButton
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            icon={<Plus className="h-4 w-4" />}
            iconColor="text-white"
          >
            Adicionar Evento
          </GooeyButton>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="underline text-xs">fechar</button>
        </div>
      )}

      {/* Day Tabs using Liquid Gooey Pill Tabs */}
      <div className="pt-1">
        <GooeyPillTabs
          tabs={DAY_TABS.map((day) => ({
            id: day.key,
            label: day.label,
            count: getDayCount(day.key),
          }))}
          activeTab={selectedDayTab}
          onChange={(key) => setSelectedDayTab(key)}
          variant="brand"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            aria-label="Buscar por título, local ou descrição"
            placeholder="Buscar por título, local ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-sm bg-white dark:bg-slate-900"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {["all", "Espiritual", "Atividade", "Alimentação", "Show", "Baile", "Logística", "Equipe"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all duration-200 border-2 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#007DA5] text-white border-slate-950 dark:border-slate-700 shadow-tactile-pill -translate-y-0.5"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-900/20 dark:border-slate-700 hover:border-slate-950 dark:hover:border-slate-500 hover:bg-[#007DA5]/10 hover:text-[#007DA5] dark:hover:text-[#01B6D1] hover:shadow-tactile-pill hover:-translate-y-0.5 active:translate-y-0"
              }`}
            >
              {cat === "all" ? "Todas Categorias" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Schedule Items List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <Clock className="h-12 w-12 mx-auto mb-2 opacity-30 text-[#007DA5]" />
          <p className="font-black text-base text-slate-700 dark:text-slate-300">Nenhuma atividade encontrada</p>
          <p className="text-xs max-w-sm mx-auto">
            Clique no botão &ldquo;Adicionar Evento&rdquo; ou &ldquo;Sincronizar Oficial (82)&rdquo; para carregar a grade completa.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:border-slate-400 ${
                item.is_highlight ? "border-amber-400/80 dark:border-amber-500/80 bg-amber-50/20 dark:bg-amber-950/10 ring-1 ring-amber-400/40" : ""
              }`}
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-black text-slate-900 dark:text-white">
                      <Clock className="h-3.5 w-3.5 text-[#007DA5]" />
                      {item.start_time} {item.end_time && item.end_time !== "--" ? `— ${item.end_time}` : ""}
                    </span>

                    <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-black uppercase text-slate-500">
                      {item.day.toUpperCase()}
                    </span>

                    {item.category && (
                      <Badge variant="outline" className={`text-xs font-black px-2 py-0.5 ${getCategoryColor(item.category)}`}>
                        {item.category}
                      </Badge>
                    )}

                    {item.is_highlight && (
                      <Badge className="bg-amber-400 text-amber-950 font-black text-xs flex items-center gap-1 border border-amber-500 shadow-sm">
                        <Sparkles className="h-3 w-3" /> Destaque
                      </Badge>
                    )}
                  </div>

                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                      {item.location}
                    </p>
                  </div>

                  {item.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditModal(item)}
                    className="h-8 px-3 text-xs font-bold rounded-xl border-slate-200 dark:border-slate-700"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemToDelete(item)}
                    className="h-8 px-3 text-xs font-bold rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[560px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">
              {editingItem ? "Editar Atividade no Cronograma" : "Nova Atividade no Cronograma"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Salvo imediatamente no Supabase e refletido para todos os jovens.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveForm} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Nome da Atividade / Título *</label>
              <Input
                value={formTitle}
                onChange={(e) => {
                  setFormTitle(e.target.value);
                  if (formErrors.title) setFormErrors((prev) => ({ ...prev, title: "" }));
                }}
                placeholder="Ex: Estudo das Escrituras"
                className="text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
              />
              {formErrors.title && (
                <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.title}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Dia do Evento *</label>
                <select
                  value={formDay}
                  onChange={(e) => handleDayChange(e.target.value)}
                  className="w-full h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-2 font-semibold"
                >
                  <option value="dia0">Dia Zero (05/02 • Consultores)</option>
                  <option value="dia1">1º Dia (06/02 • Chegada Jovens)</option>
                  <option value="dia2">2º Dia (07/02)</option>
                  <option value="dia3">3º Dia (08/02)</option>
                  <option value="dia4">4º Dia (09/02)</option>
                  <option value="dia5">5º Dia (10/02)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Início *</label>
                <Input
                  value={formStartTime}
                  onChange={(e) => {
                    setFormStartTime(e.target.value);
                    if (formErrors.start_time) setFormErrors((prev) => ({ ...prev, start_time: "" }));
                  }}
                  placeholder="08:00"
                  className="text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                />
                {formErrors.start_time && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.start_time}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Término</label>
                <Input
                  value={formEndTime}
                  onChange={(e) => setFormEndTime(e.target.value)}
                  placeholder="09:00"
                  className="text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Local *</label>
                <Input
                  value={formLocation}
                  onChange={(e) => {
                    setFormLocation(e.target.value);
                    if (formErrors.location) setFormErrors((prev) => ({ ...prev, location: "" }));
                  }}
                  placeholder="Ex: Auditório Principal"
                  className="text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                />
                {formErrors.location && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">{formErrors.location}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Categoria</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-2 font-semibold"
                >
                  {["Atividade", "Espiritual", "Alimentação", "Show", "Baile", "Logística", "Equipe", "Geral"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Data do Evento (YYYY-MM-DD)</label>
              <Input
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                type="date"
                className="text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Descrição Detalhada</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Detalhes, vestimenta recomendada ou instruções..."
                rows={3}
                className="text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl resize-none font-medium"
              />
            </div>

            {/* Interactive "Marcar como Destaque" Toggle */}
            <div
              onClick={() => setFormIsHighlight(!formIsHighlight)}
              className={`flex items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                formIsHighlight
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border ${formIsHighlight ? "bg-amber-400 text-amber-950 border-amber-500" : "bg-muted text-muted-foreground border-border"}`}>
                  <Star className="h-4 w-4 fill-current" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    Marcar como Destaque
                    {formIsHighlight && <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider">(Ativo)</span>}
                  </p>
                  <p className="text-xs text-slate-500">Exibido com card dourado no mural e no feed dos jovens</p>
                </div>
              </div>

              <div
                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                  formIsHighlight ? "bg-[#007DA5]" : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    formIsHighlight ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="text-xs font-bold rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="text-xs bg-[#007DA5] hover:bg-[#005E7C] text-white font-black rounded-xl border-2 border-slate-900 shadow-sm min-h-[36px]"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : "Salvar no Cronograma"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE DIALOG */}
      <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Excluir Atividade?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Tem certeza que deseja remover <strong className="text-slate-900 dark:text-white">&ldquo;{itemToDelete?.title}&rdquo;</strong> do cronograma oficial?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setItemToDelete(null)}
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

      {/* CONFIRM SYNC DIALOG */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="sm:max-w-[460px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-[#007DA5]">
              <Database className="h-5 w-5" /> Sincronizar Cronograma 2027
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Isso atualizará todas as 82 atividades oficiais dos 6 dias (05 a 10 de Fevereiro de 2027) no banco de dados. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsSyncModalOpen(false)}
              className="flex-1 rounded-xl text-xs font-bold min-h-[36px]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSyncOfficial}
              disabled={seeding}
              className="flex-1 bg-[#007DA5] hover:bg-[#005E7C] text-white font-black rounded-xl text-xs min-h-[36px]"
            >
              {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
              {seeding ? "Sincronizando..." : "Sincronizar Agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
