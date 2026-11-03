/**
 * Tokens de movimento FSY, espelhados nas variáveis `--motion-*` de globals.css.
 * Movimento explica estado, continuidade ou retorno de ação; nunca decoração em
 * laço. Com `prefers-reduced-motion`, use `instant` e só opacidade/cor.
 */

export const DURATION = {
  /** Pressionar, retorno imediato. */
  instant: 0.1,
  /** Cor, hover, foco. */
  fast: 0.16,
  /** Abas, toasts, troca de estado. */
  base: 0.22,
  /** Reordenação (FLIP) e reflow de layout. */
  layout: 0.26,
  /** Entrada de sheet/diálogo; a saída usa `exit`. */
  overlay: 0.3,
  exit: 0.2,
  /** Único momento autoral por sessão (entrada da identidade no login). */
  focal: 0.52,
} as const;

/** Desaceleração natural para chegadas confiantes. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** Saídas: aceleração curta, sempre mais rápidas que a entrada. */
export const EASE_IN = [0.4, 0, 1, 1] as const;

/**
 * Mola criticamente amortecida (damping ≥ 2·√stiffness): chega sem ultrapassar
 * o destino. Usada no deslocamento dos cartões vizinhos durante o arraste.
 */
export const SPRING_SETTLE = { type: "spring", stiffness: 420, damping: 42, mass: 1 } as const;

/** Retorno tátil curto no Android; ignorado onde não houver suporte (iOS/desktop). */
export function hapticTick(ms = 10) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
  } catch {
    /* sem suporte */
  }
}
