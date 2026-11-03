"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const TONES = ["#007DA5", "#FC4E6D", "#93C742", "#F68D2E", "#01B6D1"];

function toneFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

/**
 * Foto de perfil redonda. Sem foto (ou se a URL assinada expirar), mostra as iniciais
 * sobre uma cor da paleta oficial derivada do nome. `ring` desenha o anel de destaque.
 */
export function Avatar({
  name,
  src,
  size = 40,
  ring = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const usable = src && /^https:\/\//.test(src) && failed !== src ? src : null;
  const tone = toneFor(name || "?");

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none",
        ring && "ring-[3px] ring-[#FFE48A] ring-offset-2 ring-offset-background",
        className
      )}
      style={{ width: size, height: size, backgroundColor: usable ? undefined : tone }}
    >
      {usable ? (
        // URLs assinadas do armazenamento: o otimizador de imagens não deve guardá-las.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={usable}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(usable)}
        />
      ) : (
        <span
          aria-hidden
          className="fsy-figure font-semibold text-white"
          style={{ fontSize: Math.max(11, Math.round(size * 0.38)) }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
