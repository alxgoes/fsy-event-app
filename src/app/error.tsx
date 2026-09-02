"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCcw, Home, WifiOff } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring if needed
    console.error("App boundary error caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 text-slate-900 selection:bg-[#FFE48A]">
      <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl text-center space-y-6">
        {/* Error Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FC4E6D] text-white border-2 border-slate-900 shadow-sm">
          <AlertTriangle className="h-8 w-8 text-white" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-black text-slate-900 dark:text-white">
            Ops! Algo inesperado aconteceu.
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            Se você estiver com conexão de celular instável no local do evento, tente recarregar a página.
          </p>
        </div>

        {/* Offline hint badge */}
        <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 p-3 flex items-center gap-2.5 text-left text-xs text-amber-900 dark:text-amber-200">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-xs">
            Dica: Os dados essenciais do seu crachá e alojamento permanecem salvos em cache.
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white border-2 border-slate-900 shadow-sm hover:bg-slate-800 transition-colors min-h-[44px]"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Tentar Novamente</span>
          </button>

          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-4 py-3 text-xs font-black text-slate-900 dark:text-white border-2 border-slate-900 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[44px]"
          >
            <Home className="h-3.5 w-3.5 text-[#007DA5]" />
            <span>Ir para Início</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
