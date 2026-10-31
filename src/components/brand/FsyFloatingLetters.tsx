"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";

export interface FsyFloatingLettersProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Entrada única ao montar (momento focal do login). Nunca entra em laço. */
  animated?: boolean;
  className?: string;
}

/**
 * Letreiro FSY do app (não é o identificador oficial 2027). As letras são glifos
 * reais da Libre Baskerville, centralizados opticamente em discos com borda fina,
 * sem sombra projetada (regra da marca). Sem caminhos vetoriais desenhados à mão.
 */
interface LetterBadge {
  id: "F" | "S" | "Y";
  tilt: number;
  disc: string;
  ink: string;
}

const BADGES: LetterBadge[] = [
  { id: "F", tilt: -4, disc: "#007DA5", ink: "#FFFFFF" },
  { id: "S", tilt: 2, disc: "#FFE48A", ink: "#0F172A" },
  { id: "Y", tilt: -2, disc: "#FC4E6D", ink: "#0F172A" },
];

const SIZE_MAP = {
  xs: { container: "gap-1", badge: "h-6 w-6 text-[14px]" },
  sm: { container: "gap-1.5", badge: "h-8 w-8 text-[18px]" },
  md: { container: "gap-2", badge: "h-11 w-11 text-[25px]" },
  lg: { container: "gap-2.5", badge: "h-14 w-14 text-[32px]" },
  xl: { container: "gap-3", badge: "h-[4.5rem] w-[4.5rem] text-[41px]" },
};

export function FsyFloatingLetters({ size = "md", animated = false, className }: FsyFloatingLettersProps) {
  const current = SIZE_MAP[size];
  const reduceMotion = useReducedMotion();
  const entrance = animated && !reduceMotion;

  return (
    <span
      className={cn("inline-flex items-center select-none py-1", current.container, className)}
      role="img"
      aria-label="FSY"
    >
      {BADGES.map((badge, index) => (
        <motion.span
          key={badge.id}
          aria-hidden="true"
          initial={entrance ? { opacity: 0, y: 6, rotate: 0 } : false}
          animate={{ opacity: 1, y: 0, rotate: badge.tilt }}
          transition={entrance ? { duration: DURATION.focal * 0.7, ease: EASE_OUT, delay: 0.08 + index * 0.06 } : { duration: 0 }}
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#0F172A] font-heading font-bold leading-none",
            current.badge
          )}
          style={{ backgroundColor: badge.disc, color: badge.ink }}
        >
          {/* Ajuste óptico: o glifo maiúsculo fica no centro do disco, não a caixa da linha. */}
          <span className="block translate-y-[0.04em]">{badge.id}</span>
        </motion.span>
      ))}
    </span>
  );
}

/**
 * Versão vetorial estática (exportações e ícones). Usa a mesma família tipográfica
 * por `font-family`; onde a fonte não existir, cai para Georgia, nunca para traços manuais.
 */
export function FsyFloatingLettersSvg({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none overflow-visible", className)}
      role="img"
      aria-label="FSY"
    >
      {BADGES.map((badge, index) => {
        const cx = 30 + index * 40;
        return (
          <g key={badge.id} transform={`rotate(${badge.tilt} ${cx} 31)`}>
            <circle cx={cx} cy={31} r={23} fill={badge.disc} stroke="#0F172A" strokeWidth="1.5" />
            <text
              x={cx}
              y={32}
              textAnchor="middle"
              dominantBaseline="central"
              fill={badge.ink}
              fontFamily="var(--font-heading), 'Libre Baskerville', Georgia, serif"
              fontWeight={700}
              fontSize={26}
            >
              {badge.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
