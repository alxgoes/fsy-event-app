"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  ExternalLink,
  Save,
  RefreshCw,
  FolderOpen,
  Image as ImageIcon,
  Link2,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  X,
  Maximize2,
  Copy,
  Check,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
import { VoluteLoader } from "@/components/ui/VoluteLoader";
import { GooeyButton } from "@/components/ui/GooeyButton";
import { GooeyPillTabs } from "@/components/ui/GooeyPillTabs";
import { GooeyFilter } from "@/components/ui/GooeyFilter";
import { SuccessCheck, ShakeBox } from "@/components/ui/TransitionsMicro";

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

function getDriveThumbnail(url: string, size = "w600"): string | null {
  if (!url) return null;
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=${size}`;
  }
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://lh3.googleusercontent.com/d/${openMatch[1]}=${size}`;
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
  const [shakeCount, setShakeCount] = useState<number>(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Lightbox modal state (P4 / P7 from Transitions.dev)
  const [lightboxPhoto, setLightboxPhoto] = useState<MediaPhoto | null>(null);

  // Delete confirmation modal state
  const [photoToDelete, setPhotoToDelete] = useState<MediaPhoto | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");
  const [category, setCategory] = useState("Geral");
  const [visible, setVisible] = useState(true);

  const shouldReduceMotion = useReducedMotion();

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/media?all=true");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setPhotos(json.data as MediaPhoto[]);
          setLoading(false);
          return;
        }
      }

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
      setShakeCount((c) => c + 1);
      setError("Por favor, informe o título e o link de compartilhamento do Google Drive.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
      setTimeout(() => setSavedMsg(false), 3000);
      setTitle("");
      setDriveUrl("");
      setCategory("Geral");
      setShowForm(false);
      await loadPhotos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar foto";
      setShakeCount((c) => c + 1);
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

      if (lightboxPhoto && lightboxPhoto.id === id) {
        setLightboxPhoto((prev) => (prev ? { ...prev, visible: !currentVisible } : null));
      }
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
      if (lightboxPhoto?.id === id) setLightboxPhoto(null);
      setPhotoToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao remover foto";
      setError(msg);
    } finally {
      setDeleting(null);
    }
  };

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1dfwsm7KDII2bhk5gZZGwKDP4H2NiNIdH";

  // Build category tabs with counts for the GooeyPillTabs
  const categoriesList = ["Todas", ...Array.from(new Set(photos.map((p) => p.category)))];
  const tabsWithCount = categoriesList.map((cat) => ({
    id: cat,
    label: cat,
    count: cat === "Todas" ? photos.length : photos.filter((p) => p.category === cat).length,
  }));

  const filteredPhotos =
    filterCategory === "Todas"
      ? photos
      : photos.filter((p) => p.category === filterCategory);

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 relative">
      {/* Hidden SVG Filter for Liquid Gooey effects */}
      <GooeyFilter />

      {/* Floating Liquid Action Dock (Jakub Antalik style) */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between p-5 rounded-3xl bg-white/90 dark:bg-slate-900/90 border-2 border-slate-900/10 dark:border-slate-800 shadow-xl backdrop-blur-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight text-slate-900 dark:text-white">
              Gestão de Fotos & Mídia
            </h1>
            <span className="rounded-full bg-[#FC4E6D]/15 text-[#FC4E6D] dark:text-[#ff6b87] border border-[#FC4E6D]/30 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">
              FSY 2027 Live
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Sincronização em tempo real com o Google Drive para o Mural de Memórias dos jovens.
          </p>
        </div>

        {/* Liquid Buttons Action Dock (Matches User Photo + Elastic Springs) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {savedMsg && (
            <SuccessCheck label="Foto publicada com sucesso!" className="mr-1" />
          )}

          <GooeyButton
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            iconColor="text-white"
            onClick={() => setShowForm(!showForm)}
          >
            Adicionar Foto
          </GooeyButton>

          <GooeyButton
            variant="tactile-dark"
            size="sm"
            href={DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            icon={<FolderOpen className="h-4 w-4" />}
            iconColor="text-[#007DA5] dark:text-cyan-400"
          >
            Pasta Drive
          </GooeyButton>

          <GooeyButton
            variant="outline"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            iconColor="text-emerald-600 dark:text-emerald-400"
            onClick={loadPhotos}
            loading={loading}
          >
            Atualizar
          </GooeyButton>
        </div>
      </header>

      {/* Error Alert Box */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs sm:text-sm font-bold text-red-700 dark:text-red-300 flex items-center justify-between shadow-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="underline text-xs font-black cursor-pointer">
            Fechar
          </button>
        </motion.div>
      )}

      {/* Add Photo Form with P12 Shake on Error */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
          >
            <ShakeBox shakeTrigger={shakeCount}>
              <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-heading font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#007DA5]" />
                    Cadastrar Nova Foto Oficial do Google Drive
                  </h3>
                  <button
                    onClick={() => setShowForm(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
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
                          <option key={c} value={c}>
                            {c}
                          </option>
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
                        aria-label="Link de Compartilhamento do Google Drive"
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                        className="pl-10 h-11 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-semibold"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      💡 Cole o link da foto com permissão &ldquo;Qualquer pessoa com o link pode ver&rdquo;.
                    </p>
                  </div>

                  {/* Live Thumbnail Preview */}
                  {driveUrl && getDriveThumbnail(driveUrl) && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 flex items-center gap-3 shadow-inner"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getDriveThumbnail(driveUrl)!}
                        alt="Prévia"
                        className="h-16 w-16 object-cover rounded-xl border border-slate-300 dark:border-slate-600 shadow-sm"
                      />
                      <div>
                        <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          Miniatura de alta definição detectada!
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Pronta para ser exibida nos portais com transição suave.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => setVisible(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#007DA5] focus:ring-[#007DA5]"
                      />
                      <span>Publicar imediatamente no Mural dos Jovens</span>
                    </label>

                    <GooeyButton
                      type="submit"
                      variant="primary"
                      disabled={saving}
                      loading={saving}
                      icon={<Save className="h-4 w-4" />}
                      iconColor="text-white"
                    >
                      {saving ? "Publicando..." : "Salvar & Publicar Foto"}
                    </GooeyButton>
                  </div>
                </form>
              </div>
            </ShakeBox>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Pills Bar using Liquid Gooey Tabs (P13 Fluid Glide) */}
      <div className="pt-1">
        <GooeyPillTabs
          tabs={tabsWithCount}
          activeTab={filterCategory}
          onChange={(cat) => setFilterCategory(cat)}
          variant="brand"
        />
      </div>

      {/* Photos Grid with Shared Layout Lightbox (P4 / P7) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
          <VoluteLoader size={72} variant="brand" />
          <p className="text-xs font-bold tracking-wide">Carregando acervo de mídia...</p>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 p-12 text-center text-slate-400 dark:text-slate-500 space-y-2 backdrop-blur-sm">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-30 text-[#007DA5]" />
          <p className="font-heading font-black text-base text-slate-700 dark:text-slate-300">
            Nenhuma foto encontrada nesta categoria
          </p>
          <p className="text-xs max-w-sm mx-auto">
            Utilize o botão &ldquo;Adicionar Foto&rdquo; para vincular links do Drive ou selecione outra categoria acima.
          </p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filteredPhotos.map((photo) => {
            const thumb = photo.thumbnail_url || getDriveThumbnail(photo.drive_url);
            return (
              <motion.div
                key={photo.id}
                layoutId={shouldReduceMotion ? undefined : `photo-card-${photo.id}`}
                whileHover={shouldReduceMotion ? undefined : { y: -3, scale: 1.01 }}
                transition={{ type: "spring", stiffness: 380, damping: 24 }}
                className="group relative rounded-3xl border-2 border-slate-900/10 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-tactile-pill hover:border-slate-900/40 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                {/* Image Container with Quick Lightbox Expand */}
                <div
                  onClick={() => setLightboxPhoto(photo)}
                  className="relative aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden border-b-2 border-slate-900/10 dark:border-slate-800 cursor-zoom-in flex items-center justify-center"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={photo.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <ImageIcon className="h-8 w-8 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 font-bold">Google Drive</span>
                    </div>
                  )}

                  {/* Category Badge */}
                  <span className="absolute top-2 left-2 rounded-full bg-slate-900/80 text-white text-[11px] font-black px-2.5 py-0.5 backdrop-blur-md border border-white/20">
                    {photo.category}
                  </span>

                  {/* Visibility Tag */}
                  {!photo.visible && (
                    <span className="absolute top-2 right-2 rounded-full bg-amber-500 text-amber-950 text-[11px] font-black px-2.5 py-0.5 shadow-sm">
                      Oculta
                    </span>
                  )}

                  {/* Hover Quick Expand Button */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white text-xs font-black shadow-md backdrop-blur-sm">
                      <Maximize2 className="h-3.5 w-3.5" />
                      Expandir
                    </span>
                  </div>
                </div>

                {/* Card Content & Action Buttons */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h4 className="font-heading font-black text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">
                      {photo.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
                      {new Date(photo.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href={photo.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-black text-[#007DA5] dark:text-cyan-400 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Drive
                    </a>

                    <div className="flex items-center gap-1">
                      {/* Copy link */}
                      <button
                        onClick={() => handleCopyLink(photo.drive_url, photo.id)}
                        title="Copiar link do Drive"
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
                      >
                        {copiedId === photo.id ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>

                      {/* Visibility Toggle */}
                      <button
                        onClick={() => toggleVisible(photo.id, photo.visible)}
                        disabled={toggling === photo.id}
                        title={photo.visible ? "Ocultar dos jovens" : "Tornar visível"}
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                      >
                        {photo.visible ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-amber-500" />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setPhotoToDelete(photo)}
                        disabled={deleting === photo.id}
                        title="Excluir foto"
                        className="p-1.5 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Lightbox Modal (Transitions.dev P4 + P7 Card Resize & Smooth Modal) */}
      <AnimatePresence>
        {lightboxPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md"
            onClick={() => setLightboxPhoto(null)}
          >
            <motion.div
              initial={shouldReduceMotion ? { scale: 1 } : { scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { scale: 1 } : { scale: 0.92, y: 12 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="relative max-w-4xl w-full rounded-3xl bg-slate-900 border-2 border-slate-700 shadow-2xl overflow-hidden text-white"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Bar of Modal */}
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/70">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full bg-[#007DA5] text-white text-xs font-black px-3 py-1">
                    {lightboxPhoto.category}
                  </span>
                  <h3 className="font-heading font-black text-sm sm:text-base truncate max-w-[280px] sm:max-w-md">
                    {lightboxPhoto.title}
                  </h3>
                </div>

                <button
                  onClick={() => setLightboxPhoto(null)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* High-Resolution Image Preview */}
              <div className="relative aspect-video max-h-[65vh] bg-black flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    getDriveThumbnail(lightboxPhoto.drive_url, "w1600") ||
                    lightboxPhoto.thumbnail_url ||
                    lightboxPhoto.drive_url
                  }
                  alt={lightboxPhoto.title}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Bottom Action Dock inside Lightbox */}
              <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-400 font-semibold">
                  Publicado em: {new Date(lightboxPhoto.created_at).toLocaleDateString("pt-BR")}
                </div>

                <div className="flex items-center gap-2">
                  <GooeyButton
                    variant="tactile-dark"
                    size="sm"
                    href={lightboxPhoto.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                    iconColor="text-cyan-400"
                  >
                    Abrir no Drive
                  </GooeyButton>

                  <GooeyButton
                    variant="outline"
                    size="sm"
                    onClick={() => toggleVisible(lightboxPhoto.id, lightboxPhoto.visible)}
                    icon={lightboxPhoto.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    iconColor={lightboxPhoto.visible ? "text-emerald-400" : "text-amber-400"}
                  >
                    {lightboxPhoto.visible ? "Visível" : "Oculta"}
                  </GooeyButton>

                  <GooeyButton
                    variant="coral"
                    size="sm"
                    onClick={() => setPhotoToDelete(lightboxPhoto)}
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    iconColor="text-white"
                  >
                    Excluir
                  </GooeyButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <Dialog open={!!photoToDelete} onOpenChange={(open) => !open && setPhotoToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] bg-white dark:bg-slate-900 border-2 border-slate-900 dark:border-slate-700 rounded-3xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <Trash2 className="h-5 w-5" /> Excluir Foto do Mural?
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Tem certeza que deseja remover <strong className="text-slate-900 dark:text-white">&ldquo;{photoToDelete?.title}&rdquo;</strong> da galeria oficial do FSY 2027?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <GooeyButton
              variant="outline"
              size="sm"
              onClick={() => setPhotoToDelete(null)}
              className="flex-1"
            >
              Cancelar
            </GooeyButton>
            <GooeyButton
              variant="coral"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={!!deleting}
              loading={!!deleting}
              icon={<Trash2 className="h-4 w-4" />}
              iconColor="text-white"
              className="flex-1"
            >
              {deleting ? "Excluindo..." : "Sim, Excluir"}
            </GooeyButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MediaManager;
