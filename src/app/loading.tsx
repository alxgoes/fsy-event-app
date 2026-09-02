import React from "react";
import { FsyTempleMark } from "@/components/brand/FsyLogo";

export default function Loading() {
  return (
    <div className="min-h-screen bg-fsy-watermark flex flex-col items-center justify-center p-6 text-slate-900 selection:bg-[#FFE48A]">
      <div className="relative flex flex-col items-center max-w-sm w-full p-8 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center space-y-4">
        {/* Animated FSY Temple Logo Badge */}
        <div className="relative flex h-20 w-16 items-center justify-center p-1 rounded-2xl bg-[#EFEFE7] dark:bg-slate-800 border-2 border-slate-900 dark:border-slate-700 shadow-md motion-safe:animate-pulse motion-reduce:animate-none">
          <FsyTempleMark colorMode="four-color" className="h-full w-auto" />
        </div>

        {/* Text */}
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-extrabold text-slate-900 dark:text-white">
            Carregando o FSY...
          </h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Sincronizando atividades e avisos para a sua sessão.
          </p>
        </div>

        {/* Progress Dots Bar using Official FSY 2027 Palette */}
        <div className="flex items-center gap-2 pt-2">
          <div className="h-3 w-3 rounded-full bg-[#FFE48A] border border-slate-900 animate-pulse" />
          <div className="h-3 w-3 rounded-full bg-[#FC4E6D] border border-slate-900 animate-pulse delay-100" />
          <div className="h-3 w-3 rounded-full bg-[#93C742] border border-slate-900 animate-pulse delay-200" />
          <div className="h-3 w-3 rounded-full bg-[#007DA5] border border-slate-900 animate-pulse delay-300" />
        </div>
      </div>
    </div>
  );
}
