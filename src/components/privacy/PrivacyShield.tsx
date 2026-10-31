"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EyeOff, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrivacyShieldProps {
  /** Nome da área protegida no plural (ex.: "Dados de saúde"). */
  label: string;
  children: React.ReactNode;
  className?: string;
}

const stop = (event: React.SyntheticEvent) => event.stopPropagation();

/**
 * Cobre a tela inteira (inclusive diálogos abertos) quando a aba/app sai de foco
 * (troca de app, bloqueio da tela, outra aba) e só mostra os dados de novo com
 * um toque intencional. Reduz exposição em celulares compartilhados e na
 * miniatura do alternador de apps quando o sistema a captura depois do evento.
 * Não impede capturas de tela. Nada é armazenado: o conteúdo segue em memória.
 */
export function PrivacyShield({ label, children, className }: PrivacyShieldProps) {
  const [covered, setCovered] = useState(false);
  const revealRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const cover = () => {
      if (document.visibilityState === "hidden") setCovered(true);
    };
    const coverOnLeave = () => setCovered(true);
    document.addEventListener("visibilitychange", cover);
    window.addEventListener("pagehide", coverOnLeave);
    return () => {
      document.removeEventListener("visibilitychange", cover);
      window.removeEventListener("pagehide", coverOnLeave);
    };
  }, []);

  useEffect(() => {
    if (covered) revealRef.current?.focus();
  }, [covered]);

  return (
    <div className={cn("min-w-0", className)} data-sensitive="" data-privacy-covered={covered ? "" : undefined}>
      <div aria-hidden={covered || undefined} inert={covered || undefined}>
        {children}
      </div>
      {covered &&
        createPortal(
          // Eventos não sobem até o documento: tocar aqui não fecha um diálogo aberto por baixo.
          <div
            className="fsy-privacy-cover p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fsy-privacy-title"
            onPointerDown={stop}
            onMouseDown={stop}
            onClick={stop}
            onKeyDown={stop}
          >
            <div className="fsy-panel flex max-w-sm flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center dark:bg-slate-900">
              <EyeOff className="h-6 w-6 text-slate-700 dark:text-slate-200" aria-hidden="true" />
              <p id="fsy-privacy-title" className="text-sm text-slate-800 dark:text-slate-100">
                <strong className="font-semibold">{label} ocultos.</strong> O conteúdo foi coberto quando o app saiu da tela.
              </p>
              <button
                ref={revealRef}
                type="button"
                onClick={() => setCovered(false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#007DA5] px-4 text-sm font-semibold text-white hover:bg-[#005E7C] dark:bg-[#01B6D1] dark:text-slate-950"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                Mostrar {label.toLowerCase()}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
