import React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "warning" | "danger";

const TONES: Record<Tone, { icon: string }> = {
  neutral: { icon: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  info: { icon: "bg-[#E6F4F9] text-[#005E7C] dark:bg-[#0C2733] dark:text-[#7DE3F4]" },
  warning: { icon: "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200" },
  danger: { icon: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200" },
};

export interface StatePanelProps {
  icon: React.ElementType;
  title: string;
  /** O que aconteceu e o que a pessoa pode fazer agora. */
  description: React.ReactNode;
  tone?: Tone;
  /** Ações (links/botões) já com alvo de 44 px. */
  actions?: React.ReactNode;
  /** Detalhe secundário (ex.: código do erro), nunca stack trace. */
  footnote?: React.ReactNode;
  headingLevel?: "h1" | "h2";
  className?: string;
}

/**
 * Base comum dos estados vazio, erro, sem permissão e offline. Superfície FSY
 * (borda tátil do sistema), texto que nomeia o problema e a saída.
 */
export function StatePanel({ icon: Icon, title, description, tone = "neutral", actions, footnote, headingLevel = "h2", className }: StatePanelProps) {
  const Heading = headingLevel;
  return (
    <section
      className={cn(
        "fsy-panel w-full rounded-3xl bg-white p-6 text-center dark:bg-slate-900 sm:p-8",
        className
      )}
    >
      <div className={cn("mx-auto flex h-12 w-12 items-center justify-center rounded-2xl", TONES[tone].icon)}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <Heading className="mt-4 font-heading text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{title}</Heading>
      <div className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-slate-700 dark:text-slate-300">{description}</div>
      {actions && <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">{actions}</div>}
      {footnote && <p className="mt-4 text-xs font-semibold text-slate-600 dark:text-slate-400">{footnote}</p>}
    </section>
  );
}
