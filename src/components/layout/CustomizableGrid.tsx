"use client";


import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, GripVertical, LayoutGrid, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { moveBy, moveTo } from "@/lib/layout/order";
import { usePageLayout } from "@/lib/layout/usePageLayout";

export interface GridItem {
  id: string;
  /** Nome do cartão anunciado ao leitor de tela e exibido no modo de edição. */
  label: string;
  /** Classes de coluna do grid (ex.: "md:col-span-6"). */
  className?: string;
  content: React.ReactNode;
}

interface CustomizableGridProps {
  pageKey: string;
  /** Aumente quando o conjunto de cartões mudar de forma incompatível. */
  version: number;
  items: GridItem[];
  className?: string;
  toolbarClassName?: string;
}

/**
 * Grade de cartões que cada pessoa pode reorganizar para si. Arraste apenas
 * pela alça (mouse ou toque), teclado (Enter + setas) ou botões Subir/Descer.
 * Fora do modo de edição, rolagem, cliques e seleção de texto ficam normais.
 */
export function CustomizableGrid({ pageKey, version, items, className, toolbarClassName }: CustomizableGridProps) {
  const defaultIds = items.map((item) => item.id);
  const { order, save, enabled } = usePageLayout(pageKey, defaultIds, version);
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(order);
  const [grabbed, setGrabbed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const focusTarget = useRef<{ id: string; control: string } | null>(null);
  const beforeGrab = useRef<string[] | null>(null);
  const lastSwap = useRef<string | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  const byId = new Map(items.map((item) => [item.id, item]));
  const current = editing ? draft : order;
  const labelOf = (id: string) => byId.get(id)?.label ?? id;


  // Mantém o foco no controle usado depois que o cartão muda de lugar no DOM.
  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    cardRefs.current.get(target.id)?.querySelector<HTMLElement>(`[data-control="${target.control}"]`)?.focus();
  }, [draft]);

  const announceMove = useCallback((next: string[], id: string) => {
    setAnnouncement(`${labelOf(id)}: posição ${next.indexOf(id) + 1} de ${next.length}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const applyMove = (id: string, next: string[], control?: string) => {
    if (control) focusTarget.current = { id, control };
    setDraft(next);
    announceMove(next, id);
  };

  const start = () => {
    setDraft(order);
    setEditing(true);
    setStatus(null);
    setAnnouncement("Modo de personalização ativo. Use a alça de cada cartão ou os botões Subir e Descer.");
  };

  const cancel = () => {
    setEditing(false);
    setGrabbed(null);
    setDraft(order);
    setAnnouncement("Personalização cancelada. Nada foi alterado.");
  };

  const commit = async () => {
    setSaving(true);
    const result = await save(draft);
    setSaving(false);
    setEditing(false);
    setGrabbed(null);
    setStatus(result.ok ? { kind: "ok", text: "Layout salvo para a sua conta." } : { kind: "warn", text: result.message });
    setAnnouncement(result.ok ? "Layout salvo." : result.message);
  };

  const restoreDefault = () => {
    setDraft(defaultIds);
    setAnnouncement("Ordem padrão restaurada. Salve para confirmar.");
  };

  // ---- Arraste por ponteiro (mouse, caneta e toque) ----------------------
  const tick = useCallback(function animateTick() {
    frame.current = null;
    const id = dragging;
    const point = pointer.current;
    if (!id || !point) return;
    const edge = 72;
    if (point.y < edge) window.scrollBy(0, -14);
    else if (point.y > window.innerHeight - edge) window.scrollBy(0, 14);

    let hit: string | null = null;
    cardRefs.current.forEach((el, cardId) => {
      const r = el.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) hit = cardId;
    });
    if (hit !== lastSwap.current) lastSwap.current = null;
    if (hit && hit !== id && hit !== lastSwap.current) {
      setDraft((prev) => {
        const next = moveTo(prev, id, prev.indexOf(hit as string));
        announceMove(next, id);
        return next;
      });
      lastSwap.current = hit;
    }
    if (point.y < edge || point.y > window.innerHeight - edge) frame.current = requestAnimationFrame(animateTick);
  }, [dragging, announceMove]);

  const onPointerDown = (id: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { x: event.clientX, y: event.clientY };
    lastSwap.current = null;
    setDragging(id);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (frame.current === null) frame.current = requestAnimationFrame(tick);
  };
  const endDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pointer.current = null;
    setDragging(null);
  };

  // ---- Teclado na alça -----------------------------------------------------
  const onHandleKey = (id: string) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (grabbed === id) {
        setGrabbed(null);
        beforeGrab.current = null;
        setAnnouncement(`${labelOf(id)} solto na posição ${draft.indexOf(id) + 1}.`);
      } else {
        setGrabbed(id);
        beforeGrab.current = draft;
        setAnnouncement(`${labelOf(id)} selecionado. Setas movem, Enter solta, Esc cancela.`);
      }
      return;
    }
    if (grabbed !== id) return;
    const delta = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : 0;
    if (delta) {
      event.preventDefault();
      applyMove(id, moveBy(draft, id, delta), "handle");
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (beforeGrab.current) setDraft(beforeGrab.current);
      setGrabbed(null);
      setAnnouncement(`Movimento de ${labelOf(id)} cancelado.`);
    }
  };

  return (
    <div>
      <div className={cn("relative z-10 flex flex-wrap items-center justify-end gap-2", editing || status ? "mb-3" : "mb-2 h-7", toolbarClassName)}>
        {status && !editing && (
          <p role="status" className={cn("mr-auto text-sm", status.kind === "ok" ? "text-[#2F5413] dark:text-[#CDEBA9]" : "text-[#6B4A00] dark:text-[#FFE48A]")}>
            {status.text}
          </p>
        )}
        {!editing && enabled && (
          <button
            type="button"
            onClick={start}
            aria-label="Personalizar layout"
            title="Personalizar layout"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-[#007DA5] hover:text-[#005E7C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {editing && (
        <div
          role="region"
          aria-label="Personalização do layout"
          className="sticky top-16 z-40 mb-4 flex flex-col gap-3 rounded-2xl border border-[#007DA5]/30 bg-[#F2F9FC]/95 p-3 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#01B6D1]/40 dark:bg-[#0C2733]/95 sm:flex-row sm:items-center"
        >
          <p className="flex-1 text-sm text-slate-800 dark:text-slate-100">
            Arraste pela alça <GripVertical className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> ou use Subir/Descer. Muda só a sua visualização; nenhum conteúdo é alterado.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={restoreDefault} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-white/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:text-slate-100 dark:hover:bg-slate-900/60">
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restaurar padrão
            </button>
            <button type="button" onClick={cancel} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              <X className="h-4 w-4" aria-hidden="true" /> Cancelar
            </button>
            <button type="button" onClick={() => void commit()} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#007DA5] px-4 text-sm font-semibold text-white hover:bg-[#005E7C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/30 disabled:opacity-70 dark:bg-[#01B6D1] dark:text-slate-950">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Salvar layout
            </button>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <div className={className}>
        {current.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const isDragged = dragging === id;
          return (
            <motion.div
              key={id}
              layout={!reduceMotion && editing}
              transition={{ type: "spring", stiffness: 420, damping: 36 }}
              ref={(el: HTMLDivElement | null) => {
                if (el) cardRefs.current.set(id, el);
                else cardRefs.current.delete(id);
              }}
              className={cn(
                "relative min-w-0",
                item.className,
                editing && "rounded-[1.6rem] outline-dashed outline-2 outline-offset-4 outline-[#007DA5]/45 dark:outline-[#01B6D1]/50",
                isDragged && "z-30 opacity-90",
                grabbed === id && "outline outline-[#007DA5] dark:outline-[#01B6D1]"
              )}
            >
              {editing && (
                <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-[0_4px_14px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                  <span className="hidden px-2 text-xs font-semibold text-slate-700 dark:text-slate-200 sm:inline">{item.label}</span>
                  <button
                    type="button"
                    data-control="up"
                    onClick={() => applyMove(id, moveBy(draft, id, -1), "up")}
                    disabled={index === 0}
                    aria-label={`Subir ${item.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ArrowUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-control="down"
                    onClick={() => applyMove(id, moveBy(draft, id, 1), "down")}
                    disabled={index === current.length - 1}
                    aria-label={`Descer ${item.label}`}
                    className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-control="handle"
                    aria-label={`Mover ${item.label}. Posição ${index + 1} de ${current.length}. Enter para pegar, setas para mover.`}
                    aria-pressed={grabbed === id}
                    onPointerDown={onPointerDown(id)}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={onHandleKey(id)}
                    className={cn(
                      "flex h-11 w-11 touch-none select-none items-center justify-center rounded-lg text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:text-slate-100 dark:hover:bg-slate-800",
                      isDragged ? "cursor-grabbing bg-[#E6F4F9] dark:bg-[#0C2733]" : "cursor-grab"
                    )}
                  >
                    <GripVertical className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              )}
              {item.content}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
