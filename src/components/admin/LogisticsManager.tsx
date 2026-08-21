"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Truck,
  Plus,
  Users,
  MapPin,
  Clock,
  Phone,
  CheckCircle,
  AlertTriangle,
  Search,
  Trash2,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { createClient } from "@/lib/supabase/client";

interface BusTrip {
  id: string;
  bus_number: string;
  stake_city: string;
  driver_name: string;
  driver_phone: string;
  capacity: number;
  passengers_count: number;
  departure_city_time: string;
  arrival_fsy_time: string;
  departure_fsy_time: string;
  status: "programado" | "a_caminho" | "chegou" | "retornando" | "concluido";
  notes: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  programado: "Programado",
  a_caminho: "A caminho",
  chegou: "Chegou",
  retornando: "Retornando",
  concluido: "Concluído",
};

const STAKE_PRESETS = [
  "Estaca São José do Rio Preto",
  "Estaca São José do Rio Preto Sul",
  "Estaca Araçatuba",
  "Estaca Birigui",
];

export function LogisticsManager() {
  const [buses, setBuses] = useState<BusTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // In-app Delete Confirmation state
  const [busToDelete, setBusToDelete] = useState<BusTrip | null>(null);

  // Form state for new bus
  const [form, setForm] = useState({
    bus_number: "",
    stake_city: "",
    driver_name: "",
    driver_phone: "",
    capacity: "46",
    passengers_count: "0",
    departure_city_time: "",
    arrival_fsy_time: "",
    departure_fsy_time: "",
    status: "programado" as BusTrip["status"],
    notes: "",
  });

  const loadBuses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First try API route
      const res = await fetch("/api/logistics");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setBuses(json.data);
          setLoading(false);
          return;
        }
      }

      // Fallback to Supabase client
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("transport_logistics")
        .select("*")
        .order("bus_number");

      if (fetchError) {
        setError("Erro ao carregar caravanas: " + fetchError.message);
      } else {
        setBuses((data as BusTrip[]) ?? []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao conectar com logística: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBuses();
  }, [loadBuses]);

  const handleCreate = async () => {
    if (!form.bus_number.trim() || !form.stake_city.trim()) {
      setError("Número do Ônibus e Estaca/Cidade são obrigatórios.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        bus_number: form.bus_number.trim(),
        stake_city: form.stake_city.trim(),
        driver_name: form.driver_name.trim() || "A definir",
        driver_phone: form.driver_phone.trim() || "A definir",
        capacity: parseInt(form.capacity) || 46,
        passengers_count: parseInt(form.passengers_count) || 0,
        departure_city_time: form.departure_city_time || "08:00",
        arrival_fsy_time: form.arrival_fsy_time || "10:30",
        departure_fsy_time: form.departure_fsy_time || "14:00",
        status: form.status,
        notes: form.notes.trim() || null,
      };

      const res = await fetch("/api/logistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao salvar ônibus no banco.");
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setIsDialogOpen(false);
      setForm({
        bus_number: "",
        stake_city: "",
        driver_name: "",
        driver_phone: "",
        capacity: "46",
        passengers_count: "0",
        departure_city_time: "",
        arrival_fsy_time: "",
        departure_fsy_time: "",
        status: "programado",
        notes: "",
      });
      await loadBuses();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar ônibus";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: BusTrip["status"]) => {
    setUpdatingStatus(id);
    setError(null);

    try {
      const res = await fetch("/api/logistics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao atualizar status");
      }

      setBuses((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar status";
      setError(msg);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!busToDelete) return;
    const id = busToDelete.id;
    setDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/logistics?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao remover ônibus");
      }

      setBuses((prev) => prev.filter((b) => b.id !== id));
      setBusToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover ônibus";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const getStatusBadge = (status: BusTrip["status"]) => {
    switch (status) {
      case "programado":
        return "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      case "a_caminho":
        return "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 animate-pulse";
      case "chegou":
        return "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-black";
      case "retornando":
        return "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "concluido":
        return "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const totalPassengers = buses.reduce((acc, b) => acc + (b.passengers_count || 0), 0);
  const totalCapacity = buses.reduce((acc, b) => acc + (b.capacity || 46), 0);
  const arrivedCount = buses.filter((b) => b.status === "chegou").length;

  const filteredBuses = buses.filter(
    (b) =>
      b.bus_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.stake_city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.driver_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Logística de Ônibus & Transporte
            </h1>
            <Badge className="bg-[#4361EE] text-white text-[10px] font-black uppercase">
              Supabase Live
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Controle em tempo real de caravanas, horários de chegada, retorno e motoristas das 4 estacas.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && (
            <span className="flex items-center gap-1 text-sm font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-1.5 rounded-xl border border-green-200 dark:border-green-800 animate-bounce">
              <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso!
            </span>
          )}
          <Button onClick={loadBuses} variant="outline" size="sm" className="text-xs font-bold rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="text-xs bg-[#4361EE] hover:bg-blue-600 text-white font-black rounded-xl border-2 border-slate-900 shadow-brutal-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Ônibus
          </Button>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ônibus
            </CardTitle>
            <Truck className="h-4 w-4 text-[#4361EE]" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white">{buses.length}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Registrados no banco</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Passageiros
            </CardTitle>
            <Users className="h-4 w-4 text-[#06D6A0]" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white">{totalPassengers}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">de {totalCapacity} vagas totais</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm p-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Chegaram
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{arrivedCount}</div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">Desembarcados no campus</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por estaca, número do ônibus ou motorista..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-sm bg-white dark:bg-slate-900"
        />
      </div>

      {/* Buses Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#4361EE]" />
        </div>
      ) : filteredBuses.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <Truck className="h-12 w-12 mx-auto mb-2 opacity-30 text-[#4361EE]" />
          <p className="font-black text-base text-slate-700 dark:text-slate-300">Nenhum ônibus cadastrado</p>
          <p className="text-xs max-w-sm mx-auto">
            Clique no botão &ldquo;Adicionar Ônibus&rdquo; para registrar a primeira caravana.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredBuses.map((bus) => (
            <Card
              key={bus.id}
              className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all hover:border-slate-400"
            >
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-base text-slate-900 dark:text-white">
                        {bus.bus_number}
                      </span>
                      <Badge variant="outline" className={`text-[10px] font-black px-2 py-0.5 ${getStatusBadge(bus.status)}`}>
                        {STATUS_LABELS[bus.status] ?? bus.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                      {bus.stake_city}
                    </p>
                  </div>
                  <button
                    onClick={() => setBusToDelete(bus)}
                    disabled={deleting === bus.id}
                    title="Remover ônibus"
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <Phone className="h-3.5 w-3.5 text-[#4361EE] shrink-0" />
                    <span className="truncate font-semibold">{bus.driver_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <Users className="h-3.5 w-3.5 text-[#06D6A0] shrink-0" />
                    <span className="font-semibold">{bus.passengers_count}/{bus.capacity} vagas</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="font-semibold">Chegada: {bus.arrival_fsy_time}</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <MapPin className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    <span className="font-semibold">Retorno: {bus.departure_fsy_time}</span>
                  </div>
                </div>

                {bus.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                    {bus.notes}
                  </p>
                )}

                {/* Status Switcher Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">
                    Atualizar Status em Tempo Real
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(["programado", "a_caminho", "chegou", "retornando", "concluido"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(bus.id, s)}
                        disabled={updatingStatus === bus.id}
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-all ${
                          bus.status === s
                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm font-black"
                            : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE BUS DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white">Cadastrar Ônibus / Caravana</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Adicione os detalhes da caravana para monitoramento da logística.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Identificação do Ônibus *</label>
                <Input
                  placeholder="Ex: Ônibus 01"
                  value={form.bus_number}
                  onChange={(e) => setForm({ ...form, bus_number: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Estaca / Região *</label>
                <Input
                  placeholder="Ex: Estaca São José do Rio Preto"
                  value={form.stake_city}
                  onChange={(e) => setForm({ ...form, stake_city: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>
            </div>

            {/* Quick Stake Buttons */}
            <div className="flex flex-wrap gap-1">
              {STAKE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, stake_city: s })}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-[#4361EE] hover:text-white transition-colors"
                >
                  {s.replace("Estaca ", "")}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Nome do Motorista</label>
                <Input
                  placeholder="Nome do motorista"
                  value={form.driver_name}
                  onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Telefone do Motorista</label>
                <Input
                  placeholder="(17) 99999-9999"
                  value={form.driver_phone}
                  onChange={(e) => setForm({ ...form, driver_phone: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Capacidade Total</label>
                <Input
                  type="number"
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Passageiros Confirmados</label>
                <Input
                  type="number"
                  value={form.passengers_count}
                  onChange={(e) => setForm({ ...form, passengers_count: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Previsão de Chegada</label>
                <Input
                  type="time"
                  value={form.arrival_fsy_time}
                  onChange={(e) => setForm({ ...form, arrival_fsy_time: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Previsão de Retorno</label>
                <Input
                  type="time"
                  value={form.departure_fsy_time}
                  onChange={(e) => setForm({ ...form, departure_fsy_time: e.target.value })}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500">Observações / Bagageiro</label>
              <Input
                placeholder="Ex: Ar condicionado ok, parada programada em posto..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10"
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl text-xs font-bold">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-[#4361EE] hover:bg-blue-600 text-white font-black rounded-xl border-2 border-slate-900 shadow-brutal-sm text-xs"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Salvando..." : "Salvar Ônibus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE MODAL */}
      <Dialog open={!!busToDelete} onOpenChange={(open) => !open && setBusToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Excluir Caravana / Ônibus?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Tem certeza que deseja remover <strong className="text-slate-900 dark:text-white">&ldquo;{busToDelete?.bus_number} — {busToDelete?.stake_city}&rdquo;</strong> do sistema?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setBusToDelete(null)}
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
