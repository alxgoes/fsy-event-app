"use client";

import React from "react";
import { WifiOff } from "lucide-react";
import { usePwa } from "./PwaContext";
import { PwaInstallModal } from "./PwaInstallModal";

export function PwaManager() {
  const { isOffline } = usePwa();

  return (
    <>
      {/* 1. Offline Alert Pill */}
      {isOffline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/95 text-amber-300 border-2 border-amber-400/50 px-4 py-2 text-xs font-black shadow-2xl backdrop-blur-md"
        >
          <WifiOff className="h-4 w-4 text-amber-400" />
          <span>Você está sem conexão</span>
        </aside>
      )}

      {/* 2. Instalação: acesso contextual (menu do perfil e /instalar), sem pílula flutuante sobre o conteúdo. */}

      {/* 3. Universal Install Modal (automatic pop-up or manual trigger) */}
      <PwaInstallModal />
    </>
  );
}
