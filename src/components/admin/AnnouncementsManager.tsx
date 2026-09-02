"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Megaphone,
  Plus,
  AlertTriangle,
  Search,
  Trash2,
  Users,
  Radio,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  target_company_id: string | null;
  category: string;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgente",
  important: "Importante",
  normal: "Geral",
};

export function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // In-app Delete Confirmation state
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<string>("important");
  const [newTarget, setNewTarget] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("Geral");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First try API route
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setAnnouncements(json.data as Announcement[]);
          setLoading(false);
          return;
        }
      }

      // Fallback to Supabase client
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("announcements")
        .select("id, title, content, priority, target_company_id, category, created_at, profiles(full_name)")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError("Erro ao carregar comunicados: " + fetchError.message);
      } else {
        setAnnouncements((data as unknown as Announcement[]) ?? []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao carregar comunicados: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      setError("Preencha o título e o conteúdo.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        title: newTitle.trim(),
        content: newContent.trim(),
        priority: newPriority,
        target_company_id: newTarget || null,
        category: newCategory,
        author_id: user?.id ?? null,
      };

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao emitir comunicado.");
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setIsDialogOpen(false);
      setNewTitle("");
      setNewContent("");
      setNewPriority("important");
      setNewTarget("");
      await loadAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao publicar comunicado";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!announcementToDelete) return;
    const id = announcementToDelete.id;
    setDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/announcements?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao remover comunicado");
      }

      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setAnnouncementToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover comunicado";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const filtered = announcements.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 animate-pulse";
      case "important":
        return "bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      default:
        return "bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800";
    }
  };

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Comunicados & Transmissões Oficiais
            </h1>
            <Badge className="bg-[#007DA5] text-white text-xs font-black uppercase">
              Supabase Live
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Envie alertas para todos os participantes ou companhias específicas em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && (
            <span className="flex items-center gap-1 text-sm font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 motion-safe:animate-pulse motion-reduce:animate-none">
              <CheckCircle2 className="h-4 w-4" /> Comunicado publicado!
            </span>
          )}
          <Button onClick={loadAnnouncements} variant="outline" size="sm" className="text-xs font-bold rounded-xl min-h-[36px]">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="text-xs bg-[#007DA5] hover:bg-[#005E7C] text-white font-black rounded-xl border-2 border-slate-900 shadow-sm min-h-[36px]"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Emitir Novo Comunicado
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
              Comunicados Ativos
            </CardTitle>
            <Megaphone className="h-4 w-4 text-[#007DA5]" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white">{announcements.length}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Salvos no banco</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Alertas Urgentes
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-black text-rose-600 dark:text-rose-400">
              {announcements.filter((a) => a.priority === "urgent").length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Exibidos com destaque</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2 p-0">
            <CardTitle className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Globais
            </CardTitle>
            <Radio className="h-4 w-4 text-[#06D6A0]" />
          </CardHeader>
          <CardContent className="p-0 pt-2">
            <div className="text-3xl font-black text-slate-900 dark:text-white">
              {announcements.filter((a) => !a.target_company_id).length}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Para todos os jovens</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          aria-label="Buscar comunicado por título ou conteúdo"
          placeholder="Buscar comunicado por título ou conteúdo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-semibold text-sm bg-white dark:bg-slate-900"
        />
      </div>

      {/* Announcements List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#007DA5]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 p-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
          <Megaphone className="h-12 w-12 mx-auto mb-2 opacity-30 text-[#007DA5]" />
          <p className="font-black text-base text-slate-700 dark:text-slate-300">Nenhum comunicado encontrado</p>
          <p className="text-xs max-w-sm mx-auto">Clique em &quot;Emitir Novo Comunicado&quot; para criar o primeiro.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((announcement) => (
            <Card key={announcement.id} className="border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-400 transition-colors">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-black text-sm text-slate-900 dark:text-white">{announcement.title}</span>
                      <Badge variant="outline" className={`text-[10px] font-black px-2 py-0.5 ${getPriorityBadge(announcement.priority)}`}>
                        {PRIORITY_LABELS[announcement.priority] ?? announcement.priority}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-500">
                      {new Date(announcement.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <button
                    onClick={() => setAnnouncementToDelete(announcement)}
                    disabled={deleting === announcement.id}
                    title="Excluir comunicado"
                    aria-label={`Excluir comunicado: ${announcement.title}`}
                    className="text-rose-600/80 hover:text-rose-700 dark:hover:text-rose-400 transition-colors p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 min-h-[36px] min-w-[36px] inline-flex items-center justify-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-medium leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                  {announcement.content}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1 font-semibold">
                    <Users className="h-3.5 w-3.5 text-[#007DA5]" />
                    {announcement.target_company_id ? `Companhia: ${announcement.target_company_id}` : "Todos os Jovens (Global)"}
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    {announcement.category}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Announcement Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg rounded-3xl border-2 border-slate-900 bg-white dark:bg-slate-900 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-[#007DA5]" />
              Novo Comunicado Oficial
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              O comunicado será transmitido instantaneamente com notificação sonora/visual no topo do app.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-500">Título do Alerta</label>
              <Input
                aria-label="Título do comunicado"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="ex: Reunião Geral no Pavilhão A às 19:30"
                className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-slate-500">Conteúdo do Comunicado</label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Escreva a mensagem que aparecerá para os jovens..."
                rows={4}
                className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-medium text-xs resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-500">Prioridade</label>
                <Select value={newPriority} onValueChange={(val) => val && setNewPriority(val)}>
                  <SelectTrigger className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgente (Destaque Vermelho)</SelectItem>
                    <SelectItem value="important">Importante (Destaque Amarelo)</SelectItem>
                    <SelectItem value="normal">Geral / Informativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-slate-500">Categoria</label>
                <Select value={newCategory} onValueChange={(val) => val && setNewCategory(val)}>
                  <SelectTrigger className="border-2 border-slate-200 dark:border-slate-700 rounded-xl font-semibold text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Geral", "Atividades", "Alimentação", "Espiritual", "Logística", "Saúde"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl font-bold text-xs min-h-[36px]">
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving}
              className="bg-[#007DA5] hover:bg-[#005E7C] text-white font-black rounded-xl border-2 border-slate-900 shadow-sm text-xs min-h-[36px]"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {saving ? "Transmitindo..." : "Publicar Comunicado"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DELETE MODAL */}
      <Dialog open={!!announcementToDelete} onOpenChange={(open) => !open && setAnnouncementToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Excluir Comunicado?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Tem certeza que deseja remover <strong className="text-slate-900 dark:text-white">&ldquo;{announcementToDelete?.title}&rdquo;</strong> do sistema?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setAnnouncementToDelete(null)}
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
