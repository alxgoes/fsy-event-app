"use client";

import React from "react";
import Link from "next/link";
import { WifiOff, RotateCcw, Home } from "lucide-react";
import { FsyTempleMark } from "@/components/brand/FsyLogo";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-fsy-watermark flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center shadow-brutal-md space-y-6">
        <div className="flex justify-center">
          <div className="w-12 h-16 shrink-0 p-1 rounded-t-full rounded-b-xl bg-[#EFEFE7] dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm flex items-center justify-center overflow-hidden">
            <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-black uppercase">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Sem Conexão à Internet</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Você está Offline
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
            Não se preocupe! O aplicativo FSY salvou a programação, sua companhia e os avisos mais recentes neste aparelho para acesso instantâneo.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#007DA5] text-white px-4 py-3 text-xs font-black border-2 border-slate-900 shadow-brutal-sm hover:bg-[#005E7C] transition-all"
          >
            <Home className="h-4 w-4" />
            <span>Abrir Programação</span>
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-4 py-3 text-xs font-black border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 transition-all"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Tentar Reconectar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
