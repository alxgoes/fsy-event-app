/** "agora", "há 5 min", "há 3 h", "ontem", "12 fev" — sempre em pt-BR. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diff = Math.round((now.getTime() - then.getTime()) / 1000);
  if (!Number.isFinite(diff)) return "";
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ontem";
  return then.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}
