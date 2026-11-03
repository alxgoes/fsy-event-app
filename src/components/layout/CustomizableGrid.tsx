"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface GridItem {
  id: string;
  /** Nome do bloco, anunciado ao leitor de tela. */
  label: string;
  /** Classes de coluna do grid (ex.: "md:col-span-6"). */
  className?: string;
  content: React.ReactNode;
}

interface CustomizableGridProps {
  /** Mantidos por compatibilidade com as telas existentes; a ordem agora é fixa. */
  pageKey?: string;
  version?: number;
  items: GridItem[];
  className?: string;
  toolbarClassName?: string;
}

/**
 * Grade de blocos em ordem fixa. A personalização por arraste foi removida em nov/2026
 * (decisão do responsável): cada tela tem uma ordem pensada, sem botão "Personalizar".
 */
export function CustomizableGrid({ items, className }: CustomizableGridProps) {
  return (
    <div className={cn(className)}>
      {items.map((item) => (
        <div key={item.id} className={cn("min-w-0", item.className)} aria-label={item.label} role="group">
          {item.content}
        </div>
      ))}
    </div>
  );
}
