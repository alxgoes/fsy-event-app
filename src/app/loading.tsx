import React from "react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-900 selection:bg-[#FFD166]">
      <div className="relative flex flex-col items-center max-w-sm w-full p-8 rounded-3xl border-2 border-slate-900 bg-white shadow-brutal-md text-center space-y-4">
        {/* Animated FSY Logo Badge */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#4361EE] text-white font-black text-2xl border-2 border-slate-900 shadow-brutal-sm animate-bounce">
          FSY
        </div>

        {/* Text */}
        <div className="space-y-1">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">
            Carregando o FSY...
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            Sincronizando atividades e avisos para a sua sessão.
          </p>
        </div>

        {/* Progress Dots Bar */}
        <div className="flex items-center gap-2 pt-2">
          <div className="h-3 w-3 rounded-full bg-[#FFD166] border border-slate-900 animate-pulse" />
          <div className="h-3 w-3 rounded-full bg-[#FF6B8B] border border-slate-900 animate-pulse delay-100" />
          <div className="h-3 w-3 rounded-full bg-[#06D6A0] border border-slate-900 animate-pulse delay-200" />
          <div className="h-3 w-3 rounded-full bg-[#4361EE] border border-slate-900 animate-pulse delay-300" />
        </div>
      </div>
    </div>
  );
}
