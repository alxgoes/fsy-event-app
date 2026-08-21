"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  ExternalLink,
  Save,
  Loader2,
  RefreshCw,
  CheckCircle2,
  FolderOpen,
  Image,
  Link2,
  Eye,
  EyeOff,
  AlertTriangle,
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
import { createClient } from "@/lib/supabase/client";

interface MediaPhoto {
  id: string;
  title: string;
  drive_url: string;
  thumbnail_url: string | null;
  category: string;
  visible: boolean;
  created_at: string;
  profiles?: { full_name: string } | null;
}

const CATEGORIES = [
  "Geral",
  "Dia 0 (Prep)",
  "Dia 1 (Chegada)",
  "Dia 2 (Domingo)",
  "Dia 3 (Baile & Jogos)",
  "Dia 4 (Musical & Variedades)",
  "Dia 5 (Despedida)",
  "Companhias",
  "Devocional",
  "Baile",
  "Show de Variedades",
  "Jogos Musicais",
];

function getDriveThumbnail(url: string): string | null {
  if (!url) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=w600`;
  }
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://lh3.googleusercontent.com/d/${openMatch[1]}=w600`;
  }
  if (url.match(/\.(jpeg|jpg|png|webp|gif|svg)($|\?)/i)) {
    return url;
  }
  return null;
}

export function MediaManager() {
  const [photos, setPhotos] = useState<MediaPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("Todas");

  // In-app Delete Confirmation state
  const [photoToDelete, setPhotoToDelete] = useState<MediaPhoto | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [category, setCategory] = useState("Geral");
  const [visible, setVisible] = useState(true);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First try API route with all=true
      const res = await fetch("/api/media?all=true");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setPhotos(json.data as MediaPhoto[]);
          setLoading(false);
          return;
        }
      }

      // Fallback to Supabase client
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("media_photos")
        .select("id, title, drive_url, thumbnail_url, category, visible, created_at, profiles(full_name)")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError("Erro ao carregar fotos: " + fetchError.message);
      } else {
        setPhotos((data as unknown as MediaPhoto[]) ?? []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setError("Erro ao conectar com galeria: " + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleAddPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !driveUrl.trim()) {
      setError("Preencha o título e o link do Google Drive.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        title: title.trim(),
        drive_url: driveUrl.trim(),
        category,
        visible,
        author_id: user?.id ?? null,
      };

      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao cadastrar foto no banco.");
      }

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      setTitle("");
      setDriveUrl("");
      setCategory("Geral");
      setShowForm(false);
      await loadPhotos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar foto";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (id: string, currentVisible: boolean) => {
    setToggling(id);
    setError(null);

    try {
      const res = await fetch("/api/media", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, visible: !currentVisible }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao atualizar visibilidade");
      }

      setPhotos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, visible: !currentVisible } : p))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar";
      setError(msg);
    } finally {
      setToggling(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!photoToDelete) return;
    const id = photoToDelete.id;
    setDeleting(id);
    setError(null);

    try {
      const res = await fetch(`/api/media?id=${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        throw new Error(json.error || "Falha ao remover foto");
      }

      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setPhotoToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover foto";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1dfwsm7KDII2bhk5gZZGwKDP4H2NiNIdH";

  const categories = ["Todas", ...Array.from(new Set(photos.map((p) => p.category)))];
  const filteredPhotos =
    filterCategory === "Todas"
      ? photos
      : photos.filter((p) => p.category === filterCategory);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Gestão de Fotos & Mídia
            </h1>
            <span className="rounded-full bg-pink-100 dark:bg-pink-950 px-2 py-0.5 text-[10px] font-black text-[#FF6B8B]">
              FSY 2027 Live
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Adicione fotos do Google Drive — elas aparecem no Mural de Memórias dos jovens em tempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {savedMsg && (
            <span className="flex items-center gap-1 text-sm font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-3 py-1.5 rounded-xl border border-green-200 dark:border-green-800 animate-bounce">
              <CheckCircle2 className="h-4 w-4" /> Foto publicada!
            </span>
          )}
          <a
            href={DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 px-3 py-2 text-xs font-black text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-brutal-sm"
          >
            <FolderOpen className="h-4 w-4 text-[#4361EE]" />
            Abrir Pasta Drive
          </a>
          <Button onClick={loadPhotos} variant="outline" size="sm" className="text-xs font-bold rounded-xl">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="text-xs bg-[#4361EE] hover:bg-blue-600 text-white font-black rounded-xl border-2 border-slate-900 shadow-brutal-sm"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar Foto
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

      {/* Add Photo Form Dialog / Drawer */}
      {showForm && (
        <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-brutal-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#4361EE]" />
              Cadastrar Nova Foto do Google Drive
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Cancelar
            </button>
          </div>

          <form onSubmit={handleAddPhoto} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Título da Foto *
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Chegada das Caravanas / Noite de Jogos"
                  className="h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 rounded-2xl text-xs bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 px-3 font-semibold"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1">
                Link de Compartilhamento do Google Drive *
              </label>
              <div className="relative">
                <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                  className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                💡 Cole o link da foto no Google Drive com permissão &ldquo;Qualquer pessoa com o link pode ver&rdquo;.
              </p>
            </div>

            {/* Live Preview of parsed Thumbnail */}
            {driveUrl && getDriveThumbnail(driveUrl) && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getDriveThumbnail(driveUrl)!}
                  alt="Prévia"
                  className="h-16 w-16 object-cover rounded-xl border border-slate-300"
                />
                <div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Miniatura detectada com sucesso!</p>
                  <p className="text-[10px] text-slate-500">A imagem será exibida com alta definição no portal dos jovens.</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#4361EE] focus:ring-[#4361EE]"
                />
                <span>Publicar imediatamente no Mural de Memórias dos Jovens</span>
              </label>

              <Button
                type="submit"
                disabled={saving}
                className="bg-[#4361EE] hover:bg-blue-600 text-white font-black rounded-xl border-2 border-slate-900 shadow-brutal-sm text-xs h-11 px-6"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Publicando..." : "Publicar Foto"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Category Filter Pills */}
      {categories.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
                filterCategory === cat
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 dark:border-white shadow-sm"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Photos Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#4361EE]" />
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center space-y-3 bg-white dark:bg-slate-900">
          <Image className="h-12 w-12 text-slate-400 mx-auto opacity-30" />
          <h4 className="font-black text-base text-slate-900 dark:text-white">Nenhuma foto adicionada ainda</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Clique em &ldquo;Adicionar Foto&rdquo; para vincular imagens do Google Drive ao portal dos jovens.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPhotos.map((photo) => {
            const thumb = photo.thumbnail_url || getDriveThumbnail(photo.drive_url);
            return (
              <div
                key={photo.id}
                className={`rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-brutal-sm flex flex-col justify-between ${
                  !photo.visible ? "opacity-60" : ""
                }`}
              >
                {/* Photo Image / Thumbnail */}
                <div className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden border-b-2 border-slate-900 dark:border-slate-700 flex items-center justify-center">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={photo.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <Image className="h-8 w-8 text-slate-400 mb-1" />
                      <span className="text-[10px] text-slate-500 font-bold">Google Drive</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 rounded-xl bg-slate-900/80 text-white text-[10px] font-black px-2 py-0.5 backdrop-blur-sm">
                    {photo.category}
                  </span>
                  {!photo.visible && (
                    <span className="absolute top-2 right-2 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5">
                      Oculta
                    </span>
                  )}
                </div>

                {/* Photo info */}
                <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-black text-xs text-slate-900 dark:text-white line-clamp-1">
                      {photo.title}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(photo.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href={photo.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-black text-[#4361EE] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir no Drive
                    </a>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleVisible(photo.id, photo.visible)}
                        disabled={toggling === photo.id}
                        title={photo.visible ? "Ocultar dos jovens" : "Tornar visível"}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                      >
                        {photo.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-amber-500" />}
                      </button>

                      <button
                        onClick={() => setPhotoToDelete(photo)}
                        disabled={deleting === photo.id}
                        title="Excluir foto"
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <Dialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Excluir Foto do Mural?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Tem certeza que deseja remover <strong className="text-slate-900 dark:text-white">&ldquo;{photoToDelete?.title}&rdquo;</strong> da galeria oficial?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPhotoToDelete(null)}
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
