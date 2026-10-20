/**
 * Ordem individual dos cartões de uma página. Preferência apenas visual:
 * nunca altera a ordem oficial de conteúdos (programação, fotos, avisos).
 */

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * Combina a ordem salva com a lista atual de cartões: descarta ids
 * desconhecidos e duplicados e insere cartões novos depois do último
 * cartão que os antecede na ordem padrão.
 */
export function resolveOrder(defaultIds: readonly string[], saved: unknown): string[] {
  if (!isIdList(saved) || saved.length === 0) return [...defaultIds];
  const known = new Set(defaultIds);
  const result: string[] = [];
  for (const id of saved) if (known.has(id) && !result.includes(id)) result.push(id);
  if (result.length === 0) return [...defaultIds];

  defaultIds.forEach((id, index) => {
    if (result.includes(id)) return;
    // Depois do predecessor (na ordem padrão) que estiver mais adiante na ordem salva.
    let position = 0;
    for (let i = 0; i < index; i++) position = Math.max(position, result.indexOf(defaultIds[i]) + 1);
    result.splice(position, 0, id);
  });
  return result;
}

export function moveTo(order: readonly string[], id: string, index: number): string[] {
  const from = order.indexOf(id);
  if (from === -1) return [...order];
  const target = Math.max(0, Math.min(order.length - 1, index));
  if (target === from) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(target, 0, id);
  return next;
}

export function moveBy(order: readonly string[], id: string, delta: number): string[] {
  return moveTo(order, id, order.indexOf(id) + delta);
}

export function isDefaultOrder(defaultIds: readonly string[], order: readonly string[]): boolean {
  return defaultIds.length === order.length && defaultIds.every((id, i) => order[i] === id);
}

const PREFIX = "fsy:layout:v1:";

export function cacheKey(userId: string, pageKey: string): string {
  return `${PREFIX}${userId}:${pageKey}`;
}

/** Chaves de layout de outra conta no mesmo navegador devem ser descartadas. */
export function isForeignLayoutKey(key: string, userId: string): boolean {
  return key.startsWith(PREFIX) && !key.startsWith(`${PREFIX}${userId}:`);
}

interface RectLike {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Índice do cartão cujo centro está mais próximo do ponteiro. */
export function indexAtPoint(rects: readonly RectLike[], point: { x: number; y: number }): number {
  let best = 0;
  let bestDistance = Infinity;
  rects.forEach((rect, index) => {
    const dx = rect.left + rect.width / 2 - point.x;
    const dy = rect.top + rect.height / 2 - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}
