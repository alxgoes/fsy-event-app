"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Download,
  Share,
  PlusSquare,
  Sparkles,
  WifiOff,
  Zap,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { usePwa } from "./PwaContext";
import { FsyTempleMark } from "@/components/brand/FsyLogo";

export function PwaInstallModal() {
  const {
    showInstallModal,
    closeInstallModal,
    isIOS,
    isAndroid,
    canPromptInstall,
    triggerInstall,
    isInstalled,
  } = usePwa();

  if (!showInstallModal || isInstalled) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => closeInstallModal(true)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 26 }}
          className="relative w-full max-w-md rounded-3xl border-3 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-10 overflow-hidden"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={() => closeInstallModal(true)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            aria-label="Fechar modal de instalação"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header Badge & Temple Icon */}
          <div className="flex flex-col items-center text-center space-y-3 pt-1">
            <div className="w-12 h-16 shrink-0 p-1 rounded-t-full rounded-b-xl bg-[#EFEFE7] dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm flex items-center justify-center overflow-hidden">
              <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE48A] border border-slate-900 text-slate-950 text-xs font-black uppercase">
              <Sparkles className="h-3 w-3 text-amber-900" />
              <span>Instale o App Oficial • FSY 2027</span>
            </div>

            <div>
              <h2 className="font-heading text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-snug">
                Adicione o FSY à sua Tela Inicial
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                Acesse o portal da Sessão Ribeirão Preto 2 como um app nativo no celular.
              </p>
            </div>
          </div>

          {/* Benefits Grid */}
          <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Zap className="h-4 w-4 text-[#007DA5] shrink-0" />
              <span>Acesso instantâneo com um clique no celular</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <WifiOff className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Funciona 100% offline mesmo sem 4G/Wi-Fi</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
              <Smartphone className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>Visual em tela cheia sem barra de navegador</span>
            </div>
          </div>

          {/* Device-Specific Instructions */}
          <div className="mt-4 pt-1">
            {isIOS ? (
              /* iOS Safari Instructions */
              <div className="space-y-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border-2 border-sky-300 dark:border-sky-800 p-4">
                <p className="text-xs font-black text-sky-950 dark:text-sky-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Share className="h-3.5 w-3.5 text-[#007DA5]" />
                  <span>Como instalar no iPhone / iPad:</span>
                </p>

                <ol className="space-y-2.5 text-xs text-slate-800 dark:text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#007DA5] text-white text-[10px] font-black">
                      1
                    </span>
                    <span>
                      Toque no botão de <strong>Compartilhar</strong> (quadrado com seta para cima <Share className="inline h-3.5 w-3.5 text-[#007DA5] -mt-0.5" />) na barra inferior do Safari.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#007DA5] text-white text-[10px] font-black">
                      2
                    </span>
                    <span>
                      Role o menu para baixo e selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong> (<PlusSquare className="inline h-3.5 w-3.5 text-slate-700 dark:text-slate-300 -mt-0.5" />).
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#007DA5] text-white text-[10px] font-black">
                      3
                    </span>
                    <span>
                      Toque em <strong>&quot;Adicionar&quot;</strong> no canto superior direito. Pronto!
                    </span>
                  </li>
                </ol>
              </div>
            ) : canPromptInstall ? (
              /* Android / Chromium with Native Prompt Ready */
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="w-full h-12 flex items-center justify-center gap-2.5 rounded-2xl bg-[#007DA5] hover:bg-[#005E7C] text-white font-black text-sm border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>Instalar Aplicativo no Celular</span>
                </button>
              </div>
            ) : (
              /* Android / Desktop Manual Guide */
              <div className="space-y-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 p-3.5 text-xs text-amber-950 dark:text-amber-200">
                <p className="font-black flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  <span>{isAndroid ? "Como instalar no Android / Chrome:" : "Para instalar no seu navegador:"}</span>
                </p>
                <p className="leading-relaxed">
                  Toque nos <strong>três pontinhos (⋮)</strong> no canto superior do navegador e selecione <strong>&quot;Instalar aplicativo&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Dismiss Action */}
          <div className="mt-4 pt-1 flex items-center justify-center">
            <button
              type="button"
              onClick={() => closeInstallModal(true)}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              Lembrar mais tarde
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
