"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldX, ArrowLeft, Home } from "lucide-react";

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-screen bg-fsy-watermark flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 24 }}
        className="w-full max-w-md"
      >
        <div className="rounded-3xl border-2 border-slate-900 bg-white dark:bg-slate-900 p-10 text-center shadow-brutal-md space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-red-100 dark:bg-red-950/50 border-2 border-red-400 dark:border-red-700">
              <ShieldX className="h-10 w-10 text-red-500" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="font-heading text-3xl font-black text-slate-900 dark:text-white">
              Acesso Negado
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Você não tem permissão para acessar esta área. Apenas membros da equipe de liderança têm acesso ao painel administrativo.
            </p>
          </div>

          {/* Info box */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 text-left space-y-1">
            <p>🔒 <strong>Área restrita</strong> — Painel de Gestão FSY</p>
            <p>Se você acredita que deveria ter acesso, entre em contato com um coordenador ou com o Casal Diretor da sessão.</p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard"
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#4361EE] text-white px-4 py-3 text-sm font-black border-2 border-slate-900 shadow-brutal-sm hover:bg-blue-600 transition-colors"
            >
              <Home className="h-4 w-4" />
              Meu Painel
            </Link>
            <button
              onClick={() => history.back()}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-3 text-sm font-black border-2 border-slate-300 dark:border-slate-600 hover:border-slate-900 dark:hover:border-slate-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs font-bold text-slate-400 dark:text-slate-600">
          FSY Sessão Ribeirão Preto 2 • 2027 (05 a 10 de Fevereiro)
        </p>
      </motion.div>
    </div>
  );
}
