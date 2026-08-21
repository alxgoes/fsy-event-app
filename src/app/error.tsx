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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 text-slate-900 selection:bg-[#FF6B8B]">
      <div className="max-w-md w-full rounded-3xl border-2 border-slate-900 bg-white p-6 sm:p-8 shadow-brutal-md text-center space-y-6">
        {/* Error Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF6B8B] text-white border-2 border-slate-900 shadow-brutal-sm">
          <AlertTriangle className="h-8 w-8 text-white" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="font-heading text-2xl font-black text-slate-900">
            Ops! Algo inesperado aconteceu.
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
            Se você estiver com conexão de celular instável no local do evento, tente recarregar a página.
          </p>
        </div>

        {/* Offline hint badge */}
        <div className="rounded-2xl bg-amber-50 border-2 border-slate-900/15 p-3 flex items-center gap-2.5 text-left text-xs text-amber-900">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="font-semibold text-[11px]">
            Dica: Os dados essenciais do seu crachá e alojamento permanecem salvos em cache.
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white border-2 border-slate-900 shadow-brutal-sm hover:bg-slate-800 transition-colors"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Tentar Novamente</span>
          </button>

          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-900 border-2 border-slate-900 shadow-brutal-sm hover:bg-slate-50 transition-colors"
          >
            <Home className="h-3.5 w-3.5 text-[#4361EE]" />
            <span>Ir para Início</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
