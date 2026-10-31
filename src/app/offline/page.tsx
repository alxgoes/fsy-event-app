"use client";

import React from "react";
import Link from "next/link";
import { WifiOff, RotateCcw, Home } from "lucide-react";
import { FsyTempleMark } from "@/components/brand/FsyLogo";
import { StatePanel } from "@/components/ui/states";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-fsy-watermark flex flex-col items-center justify-center gap-6 p-4">
      <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-t-full rounded-b-xl border-2 border-slate-900/60 bg-[#EFEFE7] p-1 dark:border-slate-700 dark:bg-slate-800">
        <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
      </div>
      <div className="fsy-fade-in w-full max-w-md">
        <StatePanel
          icon={WifiOff}
          tone="warning"
          headingLevel="h1"
          title="Você está sem conexão"
          description="Esta página ainda não estava salva no aparelho. Conecte-se à internet para ver programação, avisos e dados da sessão atualizados."
          actions={
            <>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#007DA5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#005E7C] dark:bg-[#01B6D1] dark:text-slate-950"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Tentar novamente
              </button>
              <Link
                href="/dashboard"
                className="fsy-action-link flex-1 justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Voltar ao painel
              </Link>
            </>
          }
        />
      </div>
    </main>
  );
}
