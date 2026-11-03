/**
 * Contratos compartilhados de ordenação de cards personalizáveis (Web, iOS e Android).
 * Reutiliza `cacheKey(userId, pageKey)` e `resolveOrder(defaultIds, saved)` de
 * `src/lib/layout/order.ts` como implementação canônica única (isolada por `userId`).
 */

export {
  resolveOrder,
  moveTo,
  moveBy,
  isDefaultOrder,
  cacheKey,
  isForeignLayoutKey,
  indexAtPoint,
} from "@/lib/layout/order";

export type LayoutPageKey =
  | "dashboard"
  | "admin-metrics"
  | "admin-modules"
  | "medical-metrics"
  | "consultor-metrics"
  | "consultor-announcements";

export interface LayoutPageSchema<K extends LayoutPageKey = LayoutPageKey> {
  readonly pageKey: K;
  readonly version: number;
  readonly cardIds: readonly string[];
}

export const LAYOUT_PAGES: { readonly [K in LayoutPageKey]: LayoutPageSchema<K> } = {
  dashboard: {
    pageKey: "dashboard",
    version: 1,
    cardIds: ["hero", "theme", "now", "company", "photos", "instagram"] as const,
  },
  "admin-metrics": {
    pageKey: "admin-metrics",
    version: 1,
    cardIds: ["youth", "companies", "medical", "media"] as const,
  },
  "admin-modules": {
    pageKey: "admin-modules",
    version: 1,
    cardIds: [
      "medical",
      "companies",
      "schedule",
      "logistics",
      "announcements",
      "media",
      "registrations",
    ] as const,
  },
  "medical-metrics": {
    pageKey: "medical-metrics",
    version: 1,
    cardIds: ["records", "allergies", "diets"] as const,
  },
  "consultor-metrics": {
    pageKey: "consultor-metrics",
    version: 1,
    cardIds: ["youth", "announcements", "likes"] as const,
  },
  "consultor-announcements": {
    pageKey: "consultor-announcements",
    version: 1,
    cardIds: ["compose", "published"] as const,
  },
} as const;

export interface CardLayoutState {
  pageKey: LayoutPageKey;
  version: number;
  orderedIds: string[];
  isCustomOrder: boolean;
}
