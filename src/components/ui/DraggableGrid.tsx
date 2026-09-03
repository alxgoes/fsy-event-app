"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, RotateCcw } from "lucide-react";
import { MediaPhoto } from "@/components/media/FeaturedPhotosSection";

interface DraggableGridProps {
  photos: MediaPhoto[];
  isOpen: boolean;
  onClose: () => void;
}

// Resolves high-resolution preview URL from Google Drive
function resolveHighResPhoto(photo: MediaPhoto): string {
  const url = photo.drive_url;
  if (!url) return photo.thumbnail_url || "";

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=w2048`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}=w2048`;
  }

  return photo.thumbnail_url || url;
}

// Resolves direct original file download URL from Google Drive
function resolveOriginalDownloadUrl(photo: MediaPhoto): string {
  const url = photo.drive_url;
  if (!url) return photo.thumbnail_url || "#";

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
  }

  return url;
}

// Resolves card thumbnail
function resolveCardThumbnail(photo: MediaPhoto): string {
  if (photo.thumbnail_url) return photo.thumbnail_url;
  const url = photo.drive_url;
  if (!url) return "";

  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}=w800`;
  }
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}=w800`;
  }

  return url;
}

// Deterministic 2D distribution so neighbors don't repeat the same image
function getPhotoIndex(r: number, c: number, total: number): number {
  if (total <= 1) return 0;
  const A = r >= 0 ? 2 * r : -2 * r - 1;
  const B = c >= 0 ? 2 * c : -2 * c - 1;
  const pair = ((A + B) * (A + B + 1)) / 2 + B;
  const hash = Math.abs((pair * 2654435761) ^ (r * 31) ^ (c * 17));
  return hash % total;
}

export function DraggableGridModal({ photos, isOpen, onClose }: DraggableGridProps) {
  // Viewport size
  const [viewport, setViewport] = useState({ w: 1920, h: 1080 });
  // Continuous position state (re-renders only on animation frame)
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // Inspected photo state (pure minimal zoom)
  const [inspectedPhoto, setInspectedPhoto] = useState<MediaPhoto | null>(null);

  // Position & physics refs
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ vx: 0, vy: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const lastPointerRef = useRef({ x: 0, y: 0, time: 0 });
  const momentumRafRef = useRef<number | null>(null);

  // Cell sizing matching the reference layout
  const itemWidth = 280;
  const itemHeight = 280;
  const gap = 16;
  const cellW = itemWidth + gap;
  const cellH = itemHeight + gap;

  // Window resize observer
  useEffect(() => {
    if (!isOpen) return;
    const updateSize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isOpen]);

  // Keyboard navigation (Escape to close zoom or modal)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (inspectedPhoto) {
          setInspectedPhoto(null);
        } else if (isOpen) {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [inspectedPhoto, isOpen, onClose]);

  // Inertia / momentum loop
  const startMomentum = useCallback(() => {
    if (momentumRafRef.current) {
      cancelAnimationFrame(momentumRafRef.current);
    }

    const loop = () => {
      // Apply friction
      velRef.current.vx *= 0.93;
      velRef.current.vy *= 0.93;

      posRef.current.x += velRef.current.vx;
      posRef.current.y += velRef.current.vy;

      setOffset({ x: posRef.current.x, y: posRef.current.y });

      if (Math.hypot(velRef.current.vx, velRef.current.vy) > 0.15) {
        momentumRafRef.current = requestAnimationFrame(loop);
      } else {
        velRef.current.vx = 0;
        velRef.current.vy = 0;
        momentumRafRef.current = null;
      }
    };

    momentumRafRef.current = requestAnimationFrame(loop);
  }, []);

  // Stop momentum animation
  const stopMomentum = useCallback(() => {
    if (momentumRafRef.current) {
      cancelAnimationFrame(momentumRafRef.current);
      momentumRafRef.current = null;
    }
    velRef.current = { vx: 0, vy: 0 };
  }, []);

  // Center / reset view
  const handleResetPosition = useCallback(() => {
    stopMomentum();
    posRef.current = { x: 0, y: 0 };
    setOffset({ x: 0, y: 0 });
  }, [stopMomentum]);

  // Pointer event handlers on the canvas
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      stopMomentum();
      isDraggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);

      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: posRef.current.x,
        posY: posRef.current.y,
      };

      lastPointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      };
    },
    [stopMomentum]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    posRef.current.x = dragStartRef.current.posX + dx;
    posRef.current.y = dragStartRef.current.posY + dy;

    // Track instantaneous velocity
    const now = performance.now();
    const dt = Math.max(1, now - lastPointerRef.current.time);
    const vx = ((e.clientX - lastPointerRef.current.x) / dt) * 16;
    const vy = ((e.clientY - lastPointerRef.current.y) / dt) * 16;

    velRef.current = {
      vx: velRef.current.vx * 0.4 + vx * 0.6,
      vy: velRef.current.vy * 0.4 + vy * 0.6,
    };

    lastPointerRef.current = { x: e.clientX, y: e.clientY, time: now };
    setOffset({ x: posRef.current.x, y: posRef.current.y });
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture already lost
      }

      const totalDist = Math.hypot(
        e.clientX - dragStartRef.current.x,
        e.clientY - dragStartRef.current.y
      );

      // If moved less than 6px, treat as a click on a photo
      if (totalDist < 6 && photos && photos.length > 0) {
        const clickCanvasX = e.clientX - posRef.current.x;
        const clickCanvasY = e.clientY - posRef.current.y;
        const c = Math.floor(clickCanvasX / cellW);
        const r = Math.floor(clickCanvasY / cellH);

        // Check if click was within the card (and not in the gap)
        const cellInternalX = clickCanvasX - c * cellW;
        const cellInternalY = clickCanvasY - r * cellH;

        if (cellInternalX < itemWidth && cellInternalY < itemHeight) {
          const photoIdx = getPhotoIndex(r, c, photos.length);
          setInspectedPhoto(photos[photoIdx]);
          return;
        }
      }

      // If dragged with momentum, start decay loop
      if (Math.hypot(velRef.current.vx, velRef.current.vy) > 0.5) {
        startMomentum();
      }
    },
    [cellW, cellH, itemWidth, itemHeight, photos, startMomentum]
  );

  // Wheel scrolling (infinite pan in any direction)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    posRef.current.x -= e.deltaX;
    posRef.current.y -= e.deltaY;
    setOffset({ x: posRef.current.x, y: posRef.current.y });
  }, []);

  // Compute truly infinite visible cell matrix dynamically based on current offset
  const visibleCells = useMemo(() => {
    if (!photos || photos.length === 0) return [];

    const colStart = Math.floor(-offset.x / cellW) - 1;
    const colEnd = Math.ceil((-offset.x + viewport.w) / cellW) + 1;
    const rowStart = Math.floor(-offset.y / cellH) - 1;
    const rowEnd = Math.ceil((-offset.y + viewport.h) / cellH) + 1;

    const cells = [];
    for (let r = rowStart; r <= rowEnd; r++) {
      for (let c = colStart; c <= colEnd; c++) {
        const photoIdx = getPhotoIndex(r, c, photos.length);
        const photo = photos[photoIdx];
        cells.push({
          key: `${r}_${c}`,
          r,
          c,
          screenX: c * cellW + offset.x,
          screenY: r * cellH + offset.y,
          photo,
        });
      }
    }
    return cells;
  }, [offset.x, offset.y, viewport.w, viewport.h, cellW, cellH, photos]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 bg-black text-white select-none overflow-hidden"
      >
        {/* =========================================================================
           Floating Minimalist Navigation Controls (Zero Header Bar, Pure Floating Pill)
           ========================================================================= */}
        <div className="fixed top-5 right-5 z-40 flex items-center gap-2 pointer-events-auto">
          {/* Minimal Centralize Button */}
          <button
            type="button"
            onClick={handleResetPosition}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 backdrop-blur-xl transition-all cursor-pointer shadow-lg border-0 outline-none"
            title="Centralizar Mural"
            aria-label="Centralizar Mural"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Minimal Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-xl transition-all cursor-pointer shadow-lg border-0 outline-none"
            title="Fechar (Esc)"
            aria-label="Fechar mural"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Minimal Subtle Floating Hint */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="rounded-full bg-black/40 backdrop-blur-md px-4 py-1.5 text-[11px] font-medium text-white/60 tracking-wider uppercase">
            Arraste livremente • Toque na foto para ver
          </div>
        </div>

        {/* =========================================================================
           Truly Infinite 2D Pannable Surface
           ========================================================================= */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none overflow-hidden"
          style={{ touchAction: "none" }}
        >
          {visibleCells.map((cell) => {
            const thumb = resolveCardThumbnail(cell.photo);

            return (
              <div
                key={cell.key}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: itemWidth,
                  height: itemHeight,
                  transform: `translate3d(${cell.screenX}px, ${cell.screenY}px, 0)`,
                  willChange: "transform",
                }}
                className="overflow-hidden rounded-3xl bg-neutral-950 transition-transform duration-200 hover:scale-[1.03]"
              >
                {/* Clean, borderless image tile directly matching the reference */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumb}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  className="h-full w-full object-cover select-none pointer-events-none"
                />
              </div>
            );
          })}
        </div>

        {/* =========================================================================
           Minimalist Floating Photo Inspector (Zero Box Borders, Floating Controls)
           ========================================================================= */}
        <AnimatePresence>
          {inspectedPhoto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 select-none"
              onClick={() => setInspectedPhoto(null)}
            >
              {/* Floating Minimal Close Button */}
              <button
                type="button"
                onClick={() => setInspectedPhoto(null)}
                className="fixed top-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-xl transition-all cursor-pointer shadow-2xl border-0 outline-none"
                aria-label="Fechar foto ampliada"
                title="Fechar (Esc)"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Pure Floating Image (Zero Borders, Zero Card Frames, Minimalist Centerpiece) */}
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.92, opacity: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                className="relative flex items-center justify-center max-h-[85vh] max-w-[90vw]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveHighResPhoto(inspectedPhoto)}
                  alt={inspectedPhoto.title}
                  draggable={false}
                  className="max-h-[82vh] max-w-[88vw] object-contain rounded-3xl shadow-2xl select-none"
                />
              </motion.div>

              {/* Floating Minimal Action Pill (Download + Title) */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-white/10 px-5 py-2.5 backdrop-blur-xl text-white shadow-2xl"
              >
                {inspectedPhoto.title && (
                  <span className="text-xs font-semibold text-white/90 max-w-[200px] truncate">
                    {inspectedPhoto.title}
                  </span>
                )}

                <a
                  href={resolveOriginalDownloadUrl(inspectedPhoto)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={`${inspectedPhoto.title.toLowerCase().replace(/\s+/g, "-")}.jpg`}
                  className="inline-flex items-center gap-2 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 px-4 py-1.5 text-xs font-bold text-white transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar Original</span>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
