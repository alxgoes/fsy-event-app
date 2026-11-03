"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { PermissionState } from "@/components/ui/states";
import { EVENT_DATES } from "@/lib/event/identity";

export default function AcessoNegadoPage() {
  return (
    <main className="min-h-screen bg-fsy-watermark flex flex-col items-center justify-center gap-4 px-4 py-10">
      <div className="fsy-fade-in w-full max-w-md">
        <PermissionState
          headingLevel="h1"
          title="Área restrita"
          description={
            <>
              <p>Seu cargo não tem permissão para esta área do Painel de Gestão.</p>
              <p className="mt-2">Se você deveria ter acesso, fale com um coordenador ou com o Casal Diretor da sessão para revisar seu cargo.</p>
            </>
          }
          actions={
            <>
              <Link
                href="/dashboard"
                className="fsy-action-link flex-1 justify-center gap-2 rounded-2xl bg-[#007DA5] px-4 py-3 text-sm font-semibold text-white hover:bg-[#005E7C] dark:bg-[#01B6D1] dark:text-slate-950"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Ir para meu painel
              </Link>
              <button
                type="button"
                onClick={() => history.back()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-400"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar
              </button>
            </>
          }
        />
      </div>
      <p className="text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
        FSY Sessão Ribeirão Preto 2 · {EVENT_DATES}
      </p>
    </main>
  );
}
