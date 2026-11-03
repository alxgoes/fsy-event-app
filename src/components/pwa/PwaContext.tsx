"use client";
import { startTransition } from "react";


import React, { createContext, useContext, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaContextType {
  isInstalled: boolean;
  isOffline: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  canPromptInstall: boolean;
  showInstallModal: boolean;
  openInstallModal: () => void;
  closeInstallModal: (remember?: boolean) => void;
  triggerInstall: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType | undefined>(undefined);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    // 1. Detect environment
    if (typeof window === "undefined") return;

    // Detect Standalone (already installed as PWA)
    const standaloneMedia = window.matchMedia("(display-mode: standalone)").matches;
    const navigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const runningStandalone = standaloneMedia || navigatorStandalone;
    startTransition(() => { setIsInstalled(runningStandalone); });

    // Detect iOS
    const userAgent = window.navigator.userAgent || "";
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    startTransition(() => { setIsIOS(isIOSDevice); });

    // Detect Android
    const isAndroidDevice = /Android/i.test(userAgent);
    startTransition(() => { setIsAndroid(isAndroidDevice); });

    // 2. Register Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[FSY PWA] Service Worker ativo:", reg.scope);
        })
        .catch((err) => {
          console.warn("[FSY PWA] Falha ao registrar Service Worker:", err);
        });
    }

    // 3. Online/Offline listeners
    startTransition(() => { setIsOffline(!navigator.onLine); });
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 4. Android/Chrome beforeinstallprompt listener
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      startTransition(() => { setDeferredPrompt(e as BeforeInstallPromptEvent); });
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 5. Sem pop-up automático: a instalação é oferecida em /instalar e no menu do perfil,
    // para não interromper a tarefa nem cobrir conteúdo.

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const openInstallModal = () => {
    setShowInstallModal(true);
  };

  const closeInstallModal = (remember = true) => {
    setShowInstallModal(false);
    if (remember && typeof window !== "undefined") {
      try {
        localStorage.setItem("fsy_pwa_dismissed_at", Date.now().toString());
      } catch {}
    }
  };

  const triggerInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        setIsInstalled(true);
        closeInstallModal(true);
      }
    } else {
      // If native deferred prompt is not directly available (e.g. iOS or already shown),
      // open the visual instruction modal!
      setShowInstallModal(true);
    }
  };

  return (
    <PwaContext.Provider
      value={{
        isInstalled,
        isOffline,
        isIOS,
        isAndroid,
        canPromptInstall: Boolean(deferredPrompt),
        showInstallModal,
        openInstallModal,
        closeInstallModal,
        triggerInstall,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwa() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error("usePwa must be used within a PwaProvider");
  }
  return context;
}
