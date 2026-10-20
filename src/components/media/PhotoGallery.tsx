"use client";


import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ChevronLeft, ChevronRight, ExternalLink, ImageOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { photoSources, type PhotoSources } from "@/lib/media/drive";
import type { MediaPhoto } from "@/types/media";

const PAGE_SIZE = 8;
const DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1dfwsm7KDII2bhk5gZZGwKDP4H2NiNIdH";

interface GalleryPhoto extends MediaPhoto {
  sources: PhotoSources | null;
}

/**
 * Galeria de fotos do evento. As imagens continuam hospedadas no Google Drive;
 * a grade usa miniaturas leves e a visualização ampliada mostra a foto inteira.
 */
export function PhotoGallery({ photos }: { photos: MediaPhoto[] }) {
  const items = useMemo<GalleryPhoto[]>(() => photos.map((p) => ({ ...p, sources: photoSources(p) })), [photos]);
  const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category || "Geral"))).sort((a, b) => a.localeCompare(b, "pt-BR")), [items]);
  const [category, setCategory] = useState<string>("todas");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [open, setOpen] = useState<number | null>(null);
  const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filtered = category === "todas" ? items : items.filter((p) => (p.category || "Geral") === category);
  const shown = filtered.slice(0, visible);


  const close = useCallback(() => {
    const index = open;
    setOpen(null);
    if (index !== null) requestAnimationFrame(() => tileRefs.current[index]?.focus());
  }, [open]);

  return (
    <section aria-labelledby="gallery-title" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E6F4F9] text-[#005E7C] dark:bg-[#01B6D1] dark:text-slate-950">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="gallery-title" className="font-heading text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">Galeria do FSY</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {items.length === 0 ? "As fotos aparecem aqui assim que a equipe de mídia publicar." : `${filtered.length} ${filtered.length === 1 ? "foto" : "fotos"} · toque para ver inteira`}
            </p>
          </div>
        </div>
        <a
          href={DRIVE_FOLDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="fsy-action-link inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 sm:self-auto"
        >
          Pasta no Google Drive <ExternalLink className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
      </header>

      {categories.length > 1 && (
        <div role="group" aria-label="Filtrar fotos por categoria" className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {["todas", ...categories].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => { setCategory(value); setVisible(PAGE_SIZE); }}
              className={cn(
                "min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25",
                category === value
                  ? "bg-[#007DA5] text-white dark:bg-[#01B6D1] dark:text-slate-950"
                  : "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              )}
            >
              {value === "todas" ? "Todas" : value}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {shown.map((photo, index) => (
            <li key={photo.id}>
              <Tile photo={photo} buttonRef={(el) => (tileRefs.current[index] = el)} onOpen={() => setOpen(index)} />
            </li>
          ))}
        </ul>
      )}

      {visible < filtered.length && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="min-h-11 rounded-xl bg-slate-100 px-5 text-sm font-semibold text-slate-900 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            Ver mais {Math.min(PAGE_SIZE, filtered.length - visible)} fotos
          </button>
        </div>
      )}

      {open !== null && filtered[open] && (
        <Lightbox key={filtered[open].id} photos={filtered} index={open} onIndex={setOpen} onClose={close} />
      )}
    </section>
  );
}

function Tile({ photo, onOpen, buttonRef }: { photo: GalleryPhoto; onOpen: () => void; buttonRef: (el: HTMLButtonElement | null) => void }) {
  const [state, setState] = useState<"loading" | "ok" | "error">(photo.sources ? "loading" : "error");
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      disabled={!photo.sources}
      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/35 disabled:cursor-not-allowed dark:bg-slate-800"
    >
      {photo.sources && state !== "error" && (
        // eslint-disable-next-line @next/next/no-img-element -- miniatura servida pelo Google Drive
        <img
          src={photo.sources.thumb}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setState("ok")}
          onError={() => setState("error")}
          className={cn("h-full w-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100", state === "ok" ? "opacity-100" : "opacity-0")}
        />
      )}
      {state === "loading" && <span className="absolute inset-0 animate-pulse bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" aria-hidden="true" />}
      {state === "error" && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
          <ImageOff className="h-5 w-5" aria-hidden="true" /> Imagem indisponível
        </span>
      )}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 to-transparent px-3 pb-2 pt-8 text-xs font-semibold text-white">
        <span className="line-clamp-2">{photo.title}</span>
      </span>
      <span className="sr-only">{photo.sources ? "Abrir foto ampliada" : "Link de foto indisponível"}</span>
    </button>
  );
}

function Lightbox({ photos, index, onIndex, onClose }: { photos: GalleryPhoto[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const photo = photos[index];
  const count = photos.length;

  const go = useCallback((delta: number) => onIndex((index + delta + count) % count), [index, count, onIndex]);


  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowRight" && count > 1) go(1);
    else if (event.key === "ArrowLeft" && count > 1) go(-1);
    else if (event.key === "Tab") {
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button, a[href]");
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (!photo?.sources) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[100] flex flex-col bg-[#0B1620]/95 text-white backdrop-blur-sm"
    >
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <p className="text-sm text-slate-200" aria-live="polite">{index + 1} de {count}</p>
        <h2 id="lightbox-title" className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">{photo.title}</h2>
        <a
          href={photo.sources.original}
          target="_blank"
          rel="noopener noreferrer"
          className="fsy-action-link inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7DE3F4]/50"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Abrir no Drive</span>
          <span className="sr-only sm:hidden">Abrir no Google Drive</span>
        </a>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar foto" className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7DE3F4]/50">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4 sm:px-16"
        onClick={(event) => event.target === event.currentTarget && onClose()}
        onPointerDown={(event) => (swipe.current = { x: event.clientX, y: event.clientY })}
        onPointerUp={(event) => {
          const start = swipe.current;
          swipe.current = null;
          if (!start || count < 2) return;
          const dx = event.clientX - start.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(event.clientY - start.y)) go(dx < 0 ? 1 : -1);
        }}
      >
        {failed ? (
          <p className="flex flex-col items-center gap-2 text-center text-sm text-slate-200">
            <ImageOff className="h-6 w-6" aria-hidden="true" /> Não foi possível carregar esta foto. Abra no Google Drive.
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- imagem integral servida pelo Google Drive
          <img
            key={photo.id}
            src={photo.sources.full}
            alt={photo.title}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="max-h-full max-w-full select-none rounded-lg object-contain"
            draggable={false}
          />
        )}

        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7DE3F4]/50 sm:left-4">
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Próxima foto" className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#7DE3F4]/50 sm:right-4">
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
