"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ExternalLink,
  FolderHeart,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export interface MediaEmbedProps {
  url: string;
  type?: "instagram" | "google_drive" | "auto";
  title?: string;
  description?: string;
  aspectRatio?: "16/9" | "4/5" | "1/1" | "auto";
}

function InstagramIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function MediaEmbed({
  url,
  type = "auto",
  title = "Mídia do Evento FSY",
  description = "Fotos e vídeos oficiais da Sessão Ribeirão Preto 2",
  aspectRatio = "16/9",
}: MediaEmbedProps) {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-detect type if set to auto
  const detectedType =
    type !== "auto"
      ? type
      : url.includes("drive.google.com")
      ? "google_drive"
      : "instagram";

  // Build embed URL
  const getEmbedUrl = () => {
    if (detectedType === "instagram") {
      // Formats Instagram URL into embed format
      const cleanUrl = url.split("?")[0].replace(/\/$/, "");
      return `${cleanUrl}/embed`;
    }
    if (detectedType === "google_drive") {
      // Formats Google Drive folder/file preview URL
      if (url.includes("/folders/")) {
        const folderId = url.split("/folders/")[1]?.split("?")[0];
        return `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
      }
      return url.replace("/view", "/preview");
    }
    return url;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const aspectClasses = {
    "16/9": "aspect-video",
    "4/5": "aspect-[4/5]",
    "1/1": "aspect-square",
    auto: "min-h-[380px]",
  }[aspectRatio];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-3xl border-2 border-slate-900 bg-white p-4 sm:p-6 shadow-brutal-md text-slate-900"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-slate-100">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-900 shadow-brutal-sm ${
              detectedType === "instagram"
                ? "bg-[#FF6B8B] text-white"
                : "bg-[#FFD166] text-slate-950"
            }`}
          >
            {detectedType === "instagram" ? (
              <InstagramIcon className="h-4 w-4" />
            ) : (
              <FolderHeart className="h-4 w-4" />
            )}
          </div>
          <div>
            <h4 className="font-heading text-sm sm:text-base font-black text-slate-900 line-clamp-1">
              {title}
            </h4>
            <p className="text-[11px] font-semibold text-slate-500 line-clamp-1">
              {description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.9, y: 1 }}
            onClick={handleCopyLink}
            title="Copiar Link"
            className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-slate-900 bg-slate-50 text-slate-700 shadow-brutal-sm hover:bg-slate-100 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </motion.button>

          <motion.a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.9, y: 1 }}
            title="Abrir no app original"
            className="flex h-8 items-center gap-1.5 px-2.5 rounded-xl border-2 border-slate-900 bg-[#4361EE] text-white text-xs font-black shadow-brutal-sm hover:bg-blue-600 transition-colors"
          >
            <span>Abrir</span>
            <ExternalLink className="h-3 w-3" />
          </motion.a>
        </div>
      </div>

      {/* Embed Container Frame */}
      <div
        className={`relative w-full ${aspectClasses} rounded-2xl border-2 border-slate-900 bg-slate-100 overflow-hidden shadow-brutal-sm`}
      >
        {/* Skeleton / Loading Indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 z-10">
            <RefreshCw className="h-6 w-6 text-[#4361EE] animate-spin" />
            <span className="text-xs font-bold text-slate-500">
              Carregando galeria do evento...
            </span>
          </div>
        )}

        <iframe
          src={getEmbedUrl()}
          title={title}
          className="h-full w-full border-0"
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>

      {/* Footer Pill */}
      <div className="mt-3 flex items-center justify-between text-[11px] font-bold text-slate-400">
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-[#FFD166]" />
          <span>Sincronização em Nuvem Oficial</span>
        </div>
        <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {detectedType === "instagram" ? "Instagram Feed" : "Drive Archive"}
        </span>
      </div>
    </motion.div>
  );
}
