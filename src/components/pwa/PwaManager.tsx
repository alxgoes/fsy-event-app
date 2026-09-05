"use client";

import React from "react";
import { WifiOff, Download } from "lucide-react";
import { usePwa } from "./PwaContext";
import { PwaInstallModal } from "./PwaInstallModal";

export function PwaManager() {
  const { isOffline, isInstalled, openInstallModal } = usePwa();

  return (
    <>
      {/* 1. Offline Alert Pill */}
      {isOffline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/95 text-amber-300 border-2 border-amber-400/50 px-4 py-2 text-xs font-black shadow-2xl backdrop-blur-md animate-bounce"
        >
          <WifiOff className="h-4 w-4 text-amber-400" />
          <span>Você está offline • Exibindo dados locais</span>
        </aside>
      )}

      {/* 2. Floating Quick Install App Button on Mobile & Desktop (if not installed) */}
      {!isInstalled && (
        <aside
          role="region"
          aria-label="Instalação do Aplicativo"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl bg-[#007DA5] hover:bg-[#005E7C] text-white p-2.5 pr-3.5 border-2 border-slate-900 shadow-brutal-md transition-all cursor-pointer select-none active:translate-x-[1px] active:translate-y-[1px]"
        >
          <button
            type="button"
            onClick={openInstallModal}
            className="flex items-center gap-2 text-xs font-black"
          >
            <div className="p-1 rounded-xl bg-white/20">
              <Download className="h-3.5 w-3.5 text-white" />
            </div>
            <span>Instalar App</span>
          </button>
        </aside>
      )}

      {/* 3. Universal Install Modal (automatic pop-up or manual trigger) */}
      <PwaInstallModal />
    </>
  );
}
