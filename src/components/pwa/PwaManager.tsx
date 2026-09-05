"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaManager() {
  const [isOffline, setIsOffline] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[FSY PWA] Service Worker registrado com sucesso no escopo:", reg.scope);
        })
        .catch((err) => {
          console.warn("[FSY PWA] Falha ao registrar Service Worker:", err);
        });
    }

    // 2. Offline / Online Status Listeners
    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 3. Android PWA Install Prompt Listener
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 4. Detect if already running in standalone mode (installed)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  return (
    <>
      {/* Offline Alert Pill */}
      {isOffline && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900/95 text-amber-300 border-2 border-amber-400/50 px-4 py-2 text-xs font-black shadow-2xl backdrop-blur-md animate-bounce"
        >
          <WifiOff className="h-4 w-4 text-amber-400" />
          <span>Você está offline • Exibindo dados locais</span>
        </aside>
      )}

      {/* Floating Install App Button (when available and not already standalone) */}
      {installPrompt && !isInstalled && (
        <aside
          role="region"
          aria-label="Instalação do Aplicativo"
          className="fixed bottom-20 right-4 z-40 hidden sm:flex items-center gap-2 rounded-2xl bg-[#007DA5] hover:bg-[#005E7C] text-white p-2.5 pr-4 border-2 border-slate-900 shadow-brutal-md transition-all cursor-pointer"
        >
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center gap-2 text-xs font-black"
          >
            <div className="p-1 rounded-xl bg-white/20">
              <Download className="h-4 w-4 text-white" />
            </div>
            <span>Instalar App FSY</span>
          </button>
        </aside>
      )}
    </>
  );
}
