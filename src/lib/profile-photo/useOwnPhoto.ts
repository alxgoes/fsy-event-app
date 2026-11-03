"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProfilePhotoState } from "@/types/profile-photo";

const EVENT = "fsy_profile_photo_updated";
let shared: ProfilePhotoState | null = null;
let inflight: Promise<ProfilePhotoState | null> | null = null;

async function readError(res: Response) {
  const body = await res.json().catch(() => null);
  return (body && typeof body.error === "string" && body.error) || "Não foi possível concluir. Tente de novo.";
}

function publish(state: ProfilePhotoState) {
  shared = state;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: state }));
}

async function fetchState(): Promise<ProfilePhotoState | null> {
  inflight ??= fetch("/api/profile/photo", { cache: "no-store" })
    .then(async (res) => (res.ok ? ((await res.json()) as ProfilePhotoState) : null))
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Foto de perfil da própria pessoa, compartilhada entre cabeçalho, barra e página Mais. */
export function useOwnPhoto(enabled = true) {
  const [state, setState] = useState<ProfilePhotoState | null>(shared);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onUpdate = (e: Event) => setState((e as CustomEvent<ProfilePhotoState>).detail);
    window.addEventListener(EVENT, onUpdate);
    if (!shared) {
      fetchState().then((next) => {
        if (next) publish(next);
      });
    }
    return () => window.removeEventListener(EVENT, onUpdate);
  }, [enabled]);

  const upload = useCallback(async (file: Blob) => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file, "foto.jpg");
      const res = await fetch("/api/profile/photo", { method: "POST", body });
      if (!res.ok) throw new Error(await readError(res));
      publish((await res.json()) as ProfilePhotoState);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (scope: "pending" | "approved") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/profile/photo?scope=${scope}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      publish((await res.json()) as ProfilePhotoState);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover a foto.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, upload, remove };
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
