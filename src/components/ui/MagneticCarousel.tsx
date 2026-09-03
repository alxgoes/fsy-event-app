"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const EASE_PRESETS: Record<string, string> = {
  linear: "linear",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
};

export interface CarouselImage {
  src: string;
  alt?: string;
}

interface MagneticCarouselProps {
  images?: CarouselImage[];
  collapsedWidth?: number;
  hoverWidth?: number;
  collapsedHeight?: number;
  hoverHeight?: number;
  openSize?: number;
  gap?: number;
  influence?: number;
  blur?: number;
  transition?: {
    type?: string;
    duration?: number;
    delay?: number;
    ease?: string | number[];
  };
  className?: string;
}

const DEFAULT_IMAGES: CarouselImage[] = [
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/612d1402-0ad9-4135-3bbc-a30a6a252b00/w=800", alt: "FSY Momento 1" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/6d2ad64a-102d-4eab-0efe-31479e34b500/w=800", alt: "FSY Momento 2" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/51984031-9176-484b-f5e0-4af9a8e9ed00/w=800", alt: "FSY Momento 3" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/34ce1842-4b7a-4d52-0302-38582c341700/w=800", alt: "FSY Momento 4" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/88369c6d-00cc-4ac9-74ca-0f0965e06300/w=800", alt: "FSY Momento 5" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/aeaa0756-9647-4f6c-d900-204bd25e4a00/w=800", alt: "FSY Momento 6" },
  { src: "https://imagedelivery.net/IEUjvl3YUlxY-MrTpOAWDQ/316d1761-fd79-4ca9-b8d4-f2bb20521a00/w=800", alt: "FSY Momento 7" },
];

function parseTransition(t: MagneticCarouselProps["transition"]) {
  const dur = Math.max(0.05, (t && t.duration) || 0.5);
  let ease = "cubic-bezier(0.44, 0, 0.56, 1)";
  if (t && Array.isArray(t.ease) && t.ease.length === 4) {
    ease = `cubic-bezier(${t.ease.join(", ")})`;
  } else if (t && typeof t.ease === "string" && EASE_PRESETS[t.ease]) {
    ease = EASE_PRESETS[t.ease];
  } else if (t && t.type === "spring") {
    ease = "cubic-bezier(0.34, 1.56, 0.64, 1)";
  }
  return { dur, ease };
}

export function MagneticCarousel({
  images,
  collapsedWidth = 80,
  hoverWidth = 180,
  collapsedHeight = 300,
  hoverHeight = 360,
  openSize = 500,
  gap = 12,
  influence = 200,
  blur = 2,
  transition = { type: "tween", duration: 0.3, ease: "easeInOut" },
  className = "",
}: MagneticCarouselProps) {
  const items = images && images.length > 0 ? images : DEFAULT_IMAGES;
  const count = items.length;

  const containerRef = useRef<HTMLDivElement>(null);
  const [factors, setFactors] = useState<number[]>(() => items.map(() => 0));
  const [open, setOpen] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);

  const targetRef = useRef<number[]>(items.map(() => 0));
  const curRef = useRef<number[]>(items.map(() => 0));
  const loopRef = useRef(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    targetRef.current = Array(count).fill(0);
    curRef.current = Array(count).fill(0);
    setFactors(Array(count).fill(0));
  }, [count]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(loopRef.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const startLoop = () => {
    if (loopRef.current) return;
    const step = () => {
      const tgt = targetRef.current;
      const cur = curRef.current;
      let moving = false;
      for (let i = 0; i < cur.length; i++) {
        const d = (tgt[i] ?? 0) - cur[i];
        if (Math.abs(d) > 0.001) {
          cur[i] += d * 0.2;
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

  const { dur, ease } = parseTransition(transition);

  const close = () => {
    targetRef.current = items.map(() => 0);
    curRef.current = items.map(() => 0);
    setFactors(items.map(() => 0));
    setClosing(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setClosing(false), dur * 1000);
    setOpen(null);
  };

  const sizeFor = (i: number) => {
    if (open !== null) {
      return i === open
        ? { width: openSize, height: openSize }
        : { width: collapsedWidth, height: collapsedHeight };
    }
    const f = factors[i] ?? 0;
    return {
      width: collapsedWidth + (hoverWidth - collapsedWidth) * f,
      height: collapsedHeight + (hoverHeight - collapsedHeight) * f,
    };
  };

  const openEase = `width ${dur}s ${ease}, height ${dur}s ${ease}, filter ${dur}s ${ease}, opacity ${dur}s ${ease}`;
  const barTransition = open !== null || closing ? openEase : "none";

  return (
    <>
      {/* Full-screen backdrop with blur when a photo is open */}
      <AnimatePresence>
        {open !== null && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={close}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              background: "rgba(2, 8, 23, 0.55)",
              pointerEvents: "auto",
            }}
          />
        )}
      </AnimatePresence>

      {/* Carousel */}
      <div
        ref={containerRef}
        className={className}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap,
          position: "relative",
          overflow: "visible",
          zIndex: open !== null ? 50 : "auto",
        }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* Transparent backdrop inside carousel — click to close */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: open !== null ? "auto" : "none",
          }}
          onClick={close}
        />
        {items.map((img, i) => {
          const { width, height } = sizeFor(i);
          const blurred = open !== null && i !== open;
          return (
            <div
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                if (open === i) close();
                else setOpen(i);
              }}
              title={img.alt}
              style={{
                flex: "none",
                width,
                height,
                overflow: "hidden",
                cursor: "pointer",
                transition: barTransition,
                willChange: "width, height",
                position: "relative",
                zIndex: open === i ? 3 : 2,
                filter: blurred ? `blur(${blur}px)` : "none",
                opacity: blurred ? 0.6 : 1,
                borderRadius: 12,
                backgroundImage: `url(${img.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            />
          );
        })}
      </div>
    </>
  );
}
