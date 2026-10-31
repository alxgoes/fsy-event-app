"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, GripVertical, LayoutGrid, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { moveBy, moveTo } from "@/lib/layout/order";
import { usePageLayout } from "@/lib/layout/usePageLayout";
import { SPRING_SETTLE, hapticTick } from "@/lib/motion";

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

/** Distância mínima (px) antes de levantar o cartão: toque curto na alça não arrasta. */
const LIFT_THRESHOLD = 6;
/** Faixa (px) junto às bordas da janela que rola a página durante o arraste. */
const EDGE = 80;
const MAX_SCROLL_STEP = 16;
/** O alvo só muda quando o ponteiro está claramente mais perto dele que do próprio lugar. */
const HYSTERESIS = 16;
const DROP_MS = 180;

/** Retângulo de layout do slot na janela, sem as transformações da animação FLIP. */
function slotBox(grid: HTMLElement, el: HTMLElement) {
  const origin = grid.getBoundingClientRect();
  return { left: origin.left + el.offsetLeft, top: origin.top + el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
}

interface DragSession {
  id: string;
  pointerId: number;
  handle: HTMLElement;
  startX: number;
  startY: number;
  /** Posição do ponteiro dentro do cartão no momento em que foi pego. */
  grabX: number;
  grabY: number;
  lifted: boolean;
  before: string[];
}

/**
 * Grade de cartões que cada pessoa pode reorganizar para si. Arraste apenas
 * pela alça (mouse, caneta ou toque): o cartão acompanha o dedo, a página rola
 * perto das bordas e qualquer interrupção devolve a ordem anterior. Alternativas
 * sem gesto: teclado na alça (Enter, setas, Home/End, Esc) e botões Subir/Descer.
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
  // Ordem do DOM congelada durante o arraste: mover o nó no DOM soltaria a captura do
  // ponteiro (o navegador cancela o gesto). A troca visual usa a propriedade CSS `order`.
  const [dragBase, setDragBase] = useState<string[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<string, HTMLDivElement>());
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const focusTarget = useRef<{ id: string; control: string } | null>(null);
  const beforeGrab = useRef<string[] | null>(null);
  const session = useRef<DragSession | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const itemsRef = useRef(items);

  const byId = new Map(items.map((item) => [item.id, item]));
  const current = editing ? draft : order;
  // Lido por handlers fora do render; identidade estável para não reiniciar o gesto a cada render.
  const labelOf = useCallback((id: string) => itemsRef.current.find((item) => item.id === id)?.label ?? id, []);

  useLayoutEffect(() => {
    draftRef.current = draft;
    itemsRef.current = items;
  });

  // Mantém o foco no controle usado depois que o cartão muda de lugar no DOM.
  useLayoutEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    focusTarget.current = null;
    slotRefs.current.get(target.id)?.querySelector<HTMLElement>(`[data-control="${target.control}"]`)?.focus();
  }, [draft]);

  const announceMove = useCallback(
    (next: string[], id: string) => setAnnouncement(`${labelOf(id)}: posição ${next.indexOf(id) + 1} de ${next.length}.`),
    [labelOf]
  );

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

  // ---- Arraste por ponteiro (mouse, caneta e toque) ------------------------

  /** Posiciona o cartão levantado sob o dedo, relativo ao slot atual. */
  const placeCard = useCallback(() => {
    const s = session.current;
    const point = pointer.current;
    if (!s || !s.lifted || !point) return;
    const slot = slotRefs.current.get(s.id);
    const card = cardRefs.current.get(s.id);
    if (!slot || !card || !gridRef.current) return;
    const box = slotBox(gridRef.current, slot);
    card.style.transform = `translate3d(${point.x - s.grabX - box.left}px, ${point.y - s.grabY - box.top}px, 0)${reduceMotion ? "" : " scale(1.02)"}`;
  }, [reduceMotion]);

  // Depois de cada troca o slot muda de lugar: reposiciona antes da pintura, sem salto.
  useLayoutEffect(() => {
    placeCard();
  }, [draft, placeCard]);

  const retarget = () => {
    const s = session.current;
    const point = pointer.current;
    if (!s || !point) return;
    const ids = draftRef.current;
    const distance = (id: string) => {
      const el = slotRefs.current.get(id);
      if (!el || !gridRef.current) return Infinity;
      const box = slotBox(gridRef.current, el);
      return Math.hypot(box.left + box.width / 2 - point.x, box.top + box.height / 2 - point.y);
    };
    let best = s.id;
    let bestDistance = distance(s.id);
    const own = bestDistance;
    for (const id of ids) {
      if (id === s.id) continue;
      const d = distance(id);
      if (d < bestDistance) {
        best = id;
        bestDistance = d;
      }
    }
    if (best !== s.id && own - bestDistance > HYSTERESIS) {
      const next = moveTo(ids, s.id, ids.indexOf(best));
      setDraft(next);
      announceMove(next, s.id);
      hapticTick(6);
    }
  };

  const tick = () => {
    frame.current = null;
    const point = pointer.current;
    if (!session.current?.lifted || !point) return;
    // Autoscroll proporcional à proximidade da borda.
    let step = 0;
    if (point.y < EDGE) step = -Math.ceil(MAX_SCROLL_STEP * (1 - point.y / EDGE));
    else if (point.y > window.innerHeight - EDGE) step = Math.ceil(MAX_SCROLL_STEP * (1 - (window.innerHeight - point.y) / EDGE));
    if (step) window.scrollBy(0, step);
    placeCard();
    retarget();
    if (step) frame.current = requestAnimationFrame(tick);
  };

  const schedule = () => {
    if (frame.current === null) frame.current = requestAnimationFrame(tick);
  };

  /** Encerra o arraste. `revert` devolve a ordem de antes do gesto. */
  const finishDrag = useCallback(
    (revert: boolean) => {
      const s = session.current;
      if (!s) return;
      session.current = null;
      pointer.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      if (s.handle.hasPointerCapture?.(s.pointerId)) s.handle.releasePointerCapture(s.pointerId);
      document.body.style.removeProperty("user-select");
      if (!s.lifted) return;

      const card = cardRefs.current.get(s.id);
      if (card) {
        // Assenta no slot (ou volta ao original) em vez de saltar.
        card.style.transition = reduceMotion ? "" : `transform ${DROP_MS}ms var(--ease-out)`;
        card.style.transform = "";
        window.setTimeout(() => {
          card.style.transition = "";
        }, DROP_MS);
      }
      setDragging(null);
      setDragBase(null);
      if (revert) {
        setDraft(s.before);
        setAnnouncement(`Movimento de ${labelOf(s.id)} cancelado. Ordem anterior mantida.`);
      } else {
        hapticTick(10);
        setAnnouncement(`${labelOf(s.id)} solto na posição ${draftRef.current.indexOf(s.id) + 1} de ${draftRef.current.length}.`);
      }
    },
    [labelOf, reduceMotion]
  );

  const finishRef = useRef(finishDrag);
  useLayoutEffect(() => {
    finishRef.current = finishDrag;
  }, [finishDrag]);

  // Interrupções (Esc, troca de app, janela sem foco) cancelam e revertem.
  useEffect(() => {
    if (!dragging) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finishRef.current(true);
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") finishRef.current(true);
    };
    const onBlur = () => finishRef.current(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [dragging]);

  // Desmontar no meio de um gesto nunca deixa o cartão flutuando nem a seleção bloqueada.
  useEffect(() => () => finishRef.current(true), []);

  const onPointerDown = (id: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || session.current) return;
    const card = cardRefs.current.get(id);
    if (!card) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = card.getBoundingClientRect();
    session.current = {
      id,
      pointerId: event.pointerId,
      handle: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      lifted: false,
      before: draftRef.current,
    };
    pointer.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const s = session.current;
    if (!s || event.pointerId !== s.pointerId) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    if (!s.lifted) {
      if (Math.hypot(event.clientX - s.startX, event.clientY - s.startY) < LIFT_THRESHOLD) return;
      s.lifted = true;
      setGrabbed(null);
      setDragBase(draftRef.current);
      setDragging(s.id);
      document.body.style.setProperty("user-select", "none");
      hapticTick(10);
      setAnnouncement(`${labelOf(s.id)} levantado. Solte para confirmar a posição; Esc cancela.`);
    }
    schedule();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (session.current?.pointerId === event.pointerId) finishDrag(false);
  };

  const onPointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (session.current?.pointerId === event.pointerId) finishDrag(true);
  };

  // ---- Teclado na alça -------------------------------------------------------
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
        setAnnouncement(`${labelOf(id)} selecionado. Setas movem, Home e End levam ao início ou fim, Enter solta, Esc cancela.`);
      }
      return;
    }
    if (grabbed !== id) return;
    const step: Record<string, number> = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 };
    if (event.key in step) {
      event.preventDefault();
      applyMove(id, moveBy(draft, id, step[event.key]), "handle");
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      applyMove(id, moveTo(draft, id, event.key === "Home" ? 0 : draft.length - 1), "handle");
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
          className="fsy-fade-in sticky top-16 z-40 mb-4 flex flex-col gap-3 rounded-2xl border border-[#007DA5]/30 bg-[#F2F9FC] p-3 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08)] dark:border-[#01B6D1]/40 dark:bg-[#0C2733] sm:flex-row sm:items-center"
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
            <button type="button" onClick={() => void commit()} disabled={saving || !!dragging} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#007DA5] px-4 text-sm font-semibold text-white hover:bg-[#005E7C] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/30 disabled:opacity-70 dark:bg-[#01B6D1] dark:text-slate-950">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Salvar layout
            </button>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>

      <div ref={gridRef} className={cn("relative", className)}>
        {(dragBase ?? current).map((id) => {
          const item = byId.get(id);
          if (!item) return null;
          const index = current.indexOf(id);
          const isDragged = dragging === id;
          return (
            <motion.div
              key={id}
              // O cartão arrastado não participa do FLIP: ele segue o dedo.
              layout={!reduceMotion && editing && !isDragged}
              transition={SPRING_SETTLE}
              style={dragBase ? { order: index } : undefined}
              ref={(el: HTMLDivElement | null) => {
                if (el) slotRefs.current.set(id, el);
                else slotRefs.current.delete(id);
              }}
              className={cn(
                "relative min-w-0",
                item.className,
                editing && "rounded-[1.6rem] outline-dashed outline-2 outline-offset-4 outline-[#007DA5]/45 dark:outline-[#01B6D1]/50",
                isDragged && "z-30 bg-[#007DA5]/[0.06] dark:bg-[#01B6D1]/10",
                grabbed === id && "outline outline-[#007DA5] dark:outline-[#01B6D1]"
              )}
            >
              <div
                ref={(el: HTMLDivElement | null) => {
                  if (el) cardRefs.current.set(id, el);
                  else cardRefs.current.delete(id);
                }}
                className={cn("relative h-full min-w-0", isDragged && "fsy-drag-lift")}
              >
                {editing && (
                  <div className="mb-2 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
                    <span className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{item.label}</span>
                    <button
                      type="button"
                      data-control="up"
                      onClick={() => applyMove(id, moveBy(draft, id, -1), "up")}
                      disabled={index === 0 || !!dragging}
                      aria-label={`Subir ${item.label}`}
                      className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007DA5]/25 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      data-control="down"
                      onClick={() => applyMove(id, moveBy(draft, id, 1), "down")}
                      disabled={index === current.length - 1 || !!dragging}
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
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerCancel}
                      onLostPointerCapture={onPointerCancel}
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
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
