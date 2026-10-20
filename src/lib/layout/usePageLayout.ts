"use client";
import { startTransition } from "react";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/supabase/useProfile";
import { cacheKey, isDefaultOrder, isForeignLayoutKey, resolveOrder } from "@/lib/layout/order";

const BREAKPOINT = "all";

function readCache(key: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, order: string[] | null) {
  try {
    if (order) window.localStorage.setItem(key, JSON.stringify(order));
    else window.localStorage.removeItem(key);
  } catch {
    /* armazenamento indisponível (aba privada): segue só com o servidor */
  }
}

/** Remove do aparelho layouts salvos por outras contas que usaram o mesmo navegador. */
function purgeForeignLayouts(userId: string) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && isForeignLayoutKey(key, userId)) window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export type LayoutSaveResult = { ok: true } | { ok: false; message: string };

/**
 * Preferência individual de ordem dos cartões por pessoa e página, salva no
 * Supabase (tabela user_layout_preferences, protegida por RLS) com cópia local.
 */
export function usePageLayout(pageKey: string, defaultIds: readonly string[], version: number) {
  const { profile } = useProfile();
  const userId = profile?.id ?? null;
  const [saved, setSaved] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const defaultsKey = defaultIds.join("|");

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const key = cacheKey(userId, pageKey);
    purgeForeignLayouts(userId);
    startTransition(() => { setSaved(readCache(key)); });

    createClient()
      .from("user_layout_preferences")
      .select("card_order, layout_version")
      .eq("user_id", userId)
      .eq("page_key", pageKey)
      .eq("breakpoint", BREAKPOINT)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (!error) {
          // Versão futura (outro aparelho com app mais novo) não é aplicada aqui.
          const usable = data && data.layout_version <= version ? (data.card_order as string[]) : null;
          setSaved(usable);
          writeCache(key, usable);
        }
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [userId, pageKey, version]);

  const order = useMemo(
    () => resolveOrder(defaultIds, saved),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultsKey, saved]
  );

  const save = useCallback(
    async (next: string[]): Promise<LayoutSaveResult> => {
      if (!userId) return { ok: false, message: "Entre novamente para salvar o layout." };
      const key = cacheKey(userId, pageKey);
      const supabase = createClient();
      const restoring = isDefaultOrder(defaultIds, next);
      setSaved(restoring ? null : next);
      writeCache(key, restoring ? null : next);

      const { error } = restoring
        ? await supabase.from("user_layout_preferences").delete().eq("user_id", userId).eq("page_key", pageKey).eq("breakpoint", BREAKPOINT)
        : await supabase.from("user_layout_preferences").upsert(
            { user_id: userId, page_key: pageKey, breakpoint: BREAKPOINT, layout_version: version, card_order: next, updated_at: new Date().toISOString() },
            { onConflict: "user_id,page_key,breakpoint" }
          );
      if (error) return { ok: false, message: "Salvo só neste aparelho: não foi possível sincronizar com sua conta agora." };
      return { ok: true };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, pageKey, version, defaultsKey]
  );

  return { order, save, loaded, enabled: !!userId };
}
