"use client";

/** Avisos lidos ficam neste aparelho (localStorage), por pessoa. */
export const NOTICES_UPDATED_EVENT = "fsy_notifications_updated";

function key(profileId: string | null | undefined) {
  return profileId ? `fsy_read_announcements_${profileId}` : "fsy_read_announcements_guest";
}

export function readNoticeIds(profileId: string | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(key(profileId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function markNoticesRead(profileId: string | null | undefined, ids: string[]) {
  if (!ids.length) return;
  try {
    const next = Array.from(new Set([...readNoticeIds(profileId), ...ids])).slice(-500);
    localStorage.setItem(key(profileId), JSON.stringify(next));
  } catch {
    /* armazenamento indisponível: o aviso só continua marcado como novo */
  }
  window.dispatchEvent(new Event(NOTICES_UPDATED_EVENT));
}
