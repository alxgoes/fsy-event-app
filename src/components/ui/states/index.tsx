"use client";

import React, { useSyncExternalStore } from "react";
import { AlertTriangle, Inbox, ShieldX, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatePanel, type StatePanelProps } from "./StatePanel";

export { StatePanel };

type Preset = Omit<StatePanelProps, "icon" | "tone"> & { icon?: React.ElementType };

/** Lista ou consulta sem resultados: diga o que preencheria a área e a próxima ação. */
export function EmptyState({ icon = Inbox, ...props }: Preset) {
  return <StatePanel icon={icon} tone="neutral" {...props} />;
}

/** Falha ao carregar ou salvar. A descrição nomeia o problema; `actions` oferece repetir. */
export function ErrorState({ icon = AlertTriangle, ...props }: Preset) {
  return (
    <div role="alert">
      <StatePanel icon={icon} tone="danger" {...props} />
    </div>
  );
}

/** 401/403: substitui telas em branco quando o cargo não permite a área. */
export function PermissionState({ icon = ShieldX, ...props }: Preset) {
  return <StatePanel icon={icon} tone="warning" {...props} />;
}

const subscribeOnline = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

/** Estado de conexão do navegador; no servidor assume conectado. */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/**
 * Faixa discreta quando o aparelho fica sem conexão. Não promete fila nem envio
 * posterior: só informa que o que está na tela pode estar desatualizado.
 */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className={cn(
        "fsy-fade-in flex items-start gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100",
        className
      )}
    >
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold">Sem conexão.</strong> As informações exibidas podem estar desatualizadas, e alterações só podem ser salvas com internet.
      </span>
    </div>
  );
}
