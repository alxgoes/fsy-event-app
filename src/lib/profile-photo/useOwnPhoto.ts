"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfilePhotoState } from "@/types/profile-photo";
import { useProfile } from "@/lib/supabase/useProfile";

const EVENT = "fsy_profile_photo_updated";
const REFRESH_EVENT = "fsy_profile_photo_refresh";
interface PhotoUpdate { userId: string; state: ProfilePhotoState | null }

async function readError(res: Response) {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === "string" && body.error) || "Não foi possível concluir. Tente de novo.";
}

function publish(userId: string, state: ProfilePhotoState | null) {
  window.dispatchEvent(new CustomEvent<PhotoUpdate>(EVENT, { detail: { userId, state } }));
}

/** Foto de perfil da própria pessoa, compartilhada entre cabeçalho, barra e página Mais. */
export function useOwnPhoto(enabled = true) {
  const { profile } = useProfile();
  const userId = enabled ? profile?.id ?? null : null;
  const [snapshot, setSnapshot] = useState<PhotoUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let version = 0;
    let pending: AbortController | null = null;
    const onUpdate = (e: Event) => {
      const update = (e as CustomEvent<PhotoUpdate>).detail;
      if (update.userId !== userId) return;
      version += 1;
      pending?.abort();
      setSnapshot(update);
    };
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const requestVersion = ++version;
      try {
        const res = await fetch("/api/profile/photo", { cache: "no-store", signal: controller.signal });
        const next = res.ok ? await res.json() as ProfilePhotoState : null;
        if (active && requestVersion === version && (res.ok || res.status === 401 || res.status === 403)) publish(userId, next);
      } catch { /* Sem rede preserva somente a foto desta conta. */ }
    };
    window.addEventListener(EVENT, onUpdate);
    window.addEventListener("focus", load);
    window.addEventListener("online", load);
    window.addEventListener(REFRESH_EVENT, load);
    document.addEventListener("visibilitychange", load);
    const interval = window.setInterval(load, 60_000);
    void load();
    return () => {
      active = false;
      pending?.abort();
      window.clearInterval(interval);
      window.removeEventListener(EVENT, onUpdate);
      window.removeEventListener("focus", load);
      window.removeEventListener("online", load);
      window.removeEventListener(REFRESH_EVENT, load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [userId]);

  const refresh = useCallback(() => window.dispatchEvent(new Event(REFRESH_EVENT)), []);

  const upload = useCallback(async (file: Blob) => {
    if (!userId) return false;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file, "foto.jpg");
      const res = await fetch("/api/profile/photo", { method: "POST", body });
      if (!res.ok) throw new Error(await readError(res));
      publish(userId, (await res.json()) as ProfilePhotoState);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const remove = useCallback(async (scope: "pending" | "approved") => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile/photo?scope=${scope}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      publish(userId, (await res.json()) as ProfilePhotoState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover a foto.");
    } finally {
      setBusy(false);
    }
  }, [userId]);

  const state = snapshot?.userId === userId ? snapshot.state : null;
  return { state, busy, error, upload, remove, refresh };
}

/**
 * Recorta ao centro em quadrado e reduz para até 1024 px antes do envio:
 * fotos de celular ficam leves e o servidor recebe sempre um JPEG.
 */
export async function prepareSquarePhoto(file: File, size = 1024): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const target = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu preparar a foto.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, target, target);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível preparar a foto."))), "image/jpeg", 0.86)
  );
}
