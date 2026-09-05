"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ZoomIn, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

export interface CarouselImage {
  src: string;
  highResSrc?: string;
  alt?: string;
}

interface MagneticCarouselProps {
  images?: CarouselImage[];
  collapsedWidth?: number;
  hoverWidth?: number;
  collapsedHeight?: number;
  hoverHeight?: number;
  gap?: number;
  influence?: number;
  className?: string;
}

const DEFAULT_IMAGES: CarouselImage[] = [
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/612d1402-0ad9-4135-3bbc-a30a6a252b00/w=800", alt: "FSY Momento 1" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/6d2ad64a-102d-4eab-0efe-31479e34b500/w=800", alt: "FSY Momento 2" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/51984031-9176-484b-f5e0-4af9a8e9ed00/w=800", alt: "FSY Momento 3" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/34ce1842-4b7a-4d52-0302-38582c341700/w=800", alt: "FSY Momento 4" },
];

function ZoomLightbox({
  image,
  onClose,
}: {
  image: CarouselImage;
  onClose: () => void;
}) {
  const [src, setSrc] = useState(image.highResSrc || image.src);
  const [loading, setLoading] = useState(true);

  return (
    <motion.div
      key="zoom-lightbox-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-8 select-none"
      style={{
        backgroundColor: "rgba(2, 6, 23, 0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Floating Close Button */}
      <button
        type="button"
        onClick={onClose}
        className="fixed top-5 right-5 sm:top-7 sm:right-7 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-xl border border-white/20 shadow-2xl transition-all cursor-pointer outline-none"
        aria-label="Fechar zoom da foto"
        title="Fechar (Esc)"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Main Image Container */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col items-center justify-center max-h-[88vh] max-w-[92vw]"
      >
        <div
          className="relative flex items-center justify-center rounded-2xl overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border border-white/15 bg-slate-950/60"
          style={{
            minWidth: 260,
            minHeight: 260,
          }}
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#01B6D1]" />
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={image.alt || "Foto em destaque ampliada"}
            onLoad={() => setLoading(false)}
            onError={() => {
              // Fallback to working thumbnail if high-res fails
              if (src !== image.src) {
                setSrc(image.src);
              } else {
                setLoading(false);
              }
            }}
            className={`max-h-[82vh] max-w-[90vw] w-auto h-auto object-contain rounded-2xl select-none transition-opacity duration-200 ${
              loading ? "opacity-0" : "opacity-100"
            }`}
            draggable={false}
          />
        </div>

        {image.alt && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-3.5 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 text-white text-xs font-bold shadow-lg max-w-sm text-center truncate"
          >
            {image.alt}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function MagneticCarousel({
  images,
  collapsedWidth = 80,
  hoverWidth = 180,
  collapsedHeight = 300,
  hoverHeight = 360,
  gap = 12,
  influence = 200,
  className = "",
}: MagneticCarouselProps) {
  const items = images && images.length > 0 ? images : DEFAULT_IMAGES;
  const count = items.length;

  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const [factors, setFactors] = useState<number[]>(() => Array(count).fill(0));
  const [open, setOpen] = useState<number | null>(null);
  const [activeMobileIndex, setActiveMobileIndex] = useState(0);

  const targetRef = useRef<number[]>(Array(count).fill(0));
  const curRef = useRef<number[]>(Array(count).fill(0));
  const loopRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    targetRef.current = Array(count).fill(0);
    curRef.current = Array(count).fill(0);
    setFactors(Array(count).fill(0));
  }, [count]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(loopRef.current);
    };
  }, []);

  useEffect(() => {
    if (open === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const startLoop = () => {
    if (loopRef.current) return;
    const step = () => {
      const tgt = targetRef.current;
      const cur = curRef.current;
      let moving = false;
      for (let i = 0; i < cur.length; i++) {
        const d = (tgt[i] ?? 0) - cur[i];
        if (Math.abs(d) > 0.001) {
          cur[i] += d * 0.22; // Smooth 60fps lerp loop
          moving = true;
        } else {
          cur[i] = tgt[i] ?? 0;
        }
      }
      setFactors([...cur]);
      loopRef.current = moving ? requestAnimationFrame(step) : 0;
    };
    loopRef.current = requestAnimationFrame(step);
  };

  const setTargetFromCursor = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = clientX - rect.left;
    const n = items.length;
    const totalBase = n * collapsedWidth + (n - 1) * gap;
    const startX = (rect.width - totalBase) / 2;
    targetRef.current = items.map((_, i) => {
      const center = startX + i * (collapsedWidth + gap) + collapsedWidth / 2;
      const dist = Math.abs(cx - center);
      const f = Math.max(0, 1 - dist / influence);
      return f * f * (3 - 2 * f);
    });
    startLoop();
  };

  const onMove = (e: React.MouseEvent) => {
    if (open !== null) return;
    setTargetFromCursor(e.clientX);
  };

  const onLeave = () => {
    if (open !== null) return;
    targetRef.current = items.map(() => 0);
    startLoop();
  };

  const close = () => {
    setOpen(null);
    targetRef.current = items.map(() => 0);
    startLoop();
  };

  const sizeFor = (i: number) => {
    const f = factors[i] ?? 0;
    return {
      width: collapsedWidth + (hoverWidth - collapsedWidth) * f,
      height: collapsedHeight + (hoverHeight - collapsedHeight) * f,
    };
  };

  // Mobile navigation handlers
  const scrollToIndex = (idx: number) => {
    const el = mobileScrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>("[data-mobile-card]");
    const target = cards[idx];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    setActiveMobileIndex(idx);
  };

  const scrollPrev = () => {
    const nextIdx = Math.max(0, activeMobileIndex - 1);
    scrollToIndex(nextIdx);
  };

  const scrollNext = () => {
    const nextIdx = Math.min(items.length - 1, activeMobileIndex + 1);
    scrollToIndex(nextIdx);
  };

  const handleMobileScroll = () => {
    const el = mobileScrollRef.current;
    if (!el) return;
    const scrollCenter = el.scrollLeft + el.clientWidth / 2;
    const cards = el.querySelectorAll<HTMLElement>("[data-mobile-card]");
    let closestIdx = 0;
    let minDistance = Infinity;

    cards.forEach((card, i) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const dist = Math.abs(scrollCenter - cardCenter);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    });

    setActiveMobileIndex(closestIdx);
  };

  return (
    <>
      {/* 1. Desktop Magnetic Hover Layout (md and up) */}
      <div
        ref={containerRef}
        className={`hidden md:flex ${className}`}
        style={{
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap,
          position: "relative",
          overflow: "visible",
        }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {items.map((img, i) => {
          const { width, height } = sizeFor(i);
          const isSelected = open === i;
          return (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(i);
              }}
              title={img.alt || "Clique para ampliar"}
              className="group relative cursor-pointer"
              style={{
                flex: "none",
                width,
                height,
                overflow: "hidden",
                transition: "none",
                transform: "translateZ(0)",
                willChange: "width, height",
                position: "relative",
                zIndex: isSelected ? 3 : 2,
                borderRadius: 16,
                boxShadow: "0 8px 28px -4px rgba(0, 0, 0, 0.5)",
                border: isSelected ? "2px solid #01B6D1" : "1px solid rgba(255, 255, 255, 0.18)",
              }}
            >
              <Image
                src={img.src}
                alt={img.alt || "Foto do evento FSY"}
                fill
                sizes="(max-width: 1200px) 280px, 420px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                loading={i < 2 ? "eager" : "lazy"}
                priority={i === 0}
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                <div className="p-2 rounded-full bg-black/50 text-white backdrop-blur-sm shadow-md">
                  <ZoomIn className="h-4 w-4" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Mobile Swipeable Animated Carousel (below md) */}
      <div className="flex md:hidden flex-col items-center justify-center w-full max-w-full relative select-none py-1">
        {/* Horizontal Swipe Track */}
        <div
          ref={mobileScrollRef}
          onScroll={handleMobileScroll}
          className="flex w-full items-center gap-3.5 overflow-x-auto no-scrollbar snap-x snap-mandatory py-3 px-8 touch-pan-x scroll-smooth"
        >
          {items.map((img, i) => {
            const isActive = activeMobileIndex === i;
            return (
              <motion.div
                key={i}
                data-mobile-card={i}
                whileTap={{ scale: 0.96 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(i);
                }}
                className={`relative shrink-0 snap-center cursor-pointer transition-all duration-300 rounded-2xl overflow-hidden ${
                  isActive
                    ? "w-[74vw] max-w-[270px] h-[270px] sm:h-[300px] shadow-[0_12px_36px_-6px_rgba(1,182,209,0.45)] border-2 border-[#01B6D1] scale-100 opacity-100"
                    : "w-[66vw] max-w-[235px] h-[250px] sm:h-[280px] border border-white/20 scale-95 opacity-70"
                }`}
              >
                <Image
                  src={img.src}
                  alt={img.alt || "Foto do evento FSY"}
                  fill
                  sizes="75vw"
                  className="object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  priority={i === 0}
                />
                {/* Visual Depth Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/25 p-3 flex flex-col justify-between z-10">
                  <div className="flex items-center justify-between">
                    <span className="rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-white border border-white/20 uppercase tracking-wider">
                      {i + 1} / {items.length}
                    </span>
                    <div className="p-1.5 rounded-full bg-black/60 text-white backdrop-blur-sm border border-white/20 shadow-md">
                      <ZoomIn className="h-3.5 w-3.5 text-[#01B6D1]" />
                    </div>
                  </div>

                  <div>
                    {img.alt && (
                      <p className="text-xs font-bold text-white line-clamp-2 drop-shadow leading-snug">
                        {img.alt}
                      </p>
                    )}
                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#7DE3F4]">
                      Toque para ampliar
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Floating Prev/Next Buttons */}
        <button
          type="button"
          onClick={scrollPrev}
          disabled={activeMobileIndex === 0}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/85 hover:bg-slate-900 text-white backdrop-blur-md border border-white/20 shadow-lg disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90"
          aria-label="Foto anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={scrollNext}
          disabled={activeMobileIndex === items.length - 1}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/85 hover:bg-slate-900 text-white backdrop-blur-md border border-white/20 shadow-lg disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90"
          aria-label="Próxima foto"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Pagination Dots Indicator */}
        <div className="flex items-center gap-1.5 mt-2">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Ver foto ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeMobileIndex === i
                  ? "w-5 bg-[#01B6D1] shadow-[0_0_8px_#01B6D1]"
                  : "w-1.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {mounted && open !== null && items[open] && (
        createPortal(
          <AnimatePresence>
            <ZoomLightbox
              key={items[open].src}
              image={items[open]}
              onClose={close}
            />
          </AnimatePresence>,
          document.body
        )
      )}
    </>
  );
}
