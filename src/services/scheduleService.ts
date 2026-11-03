import { OFFICIAL_FSY_SCHEDULE } from "@/data/officialSchedule";
import { createClient } from "@/lib/supabase/client";
import { allowsDirectFallback, cachedRequest, fetchJson, sessionScope } from "@/lib/requests/client";
import { EVENT_DATES, EVENT_DAY_DATES, EVENT_END_AT, EVENT_START_AT } from "@/lib/event/identity";

export interface ScheduleItem {
  id: string;
  day: string;
  date: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string | null;
  category: string;
  is_highlight: boolean;
}

const STORAGE_KEY = "fsy_offline_schedule";
const SCHEDULE_TTL_MS = 60_000;

/** Helper to generate fallback items from the official static schedule */
function getOfficialStaticFallback(): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  for (const [dayKey, dayData] of Object.entries(OFFICIAL_FSY_SCHEDULE)) {
    const assignedDate = EVENT_DAY_DATES[dayKey] || EVENT_DAY_DATES.dia0;
    dayData.events.forEach((event, idx) => {
      items.push({
        id: `static-${dayKey}-${idx}`,
        day: dayKey,
        date: assignedDate,
        title: event.title,
        start_time: event.time === "Horário a definir" ? "07:00" : event.time,
        end_time: event.endTime || "--",
        location: event.location,
        description: event.description || null,
        category: event.category || "Geral",
        is_highlight: Boolean(event.isHighlight),
      });
    });
  }
  return items;
}

/**
 * Loads schedule items with an Offline-First strategy:
 * 1. Tries the API (direct Supabase only when the API fails with 5xx)
 * 2. Caches response in localStorage (and in memory for a few seconds per account)
 * 3. Falls back to localStorage if offline
 * 4. Falls back to static officialSchedule if storage is empty
 */
export async function getSchedule(day?: string, signal?: AbortSignal): Promise<{ data: ScheduleItem[]; fromCache: boolean }> {
  const dayKey = day && day !== "all" ? day : "all";
  try {
    const scope = await sessionScope();
    const data = await cachedRequest(
      `schedule:${scope}:${dayKey}`,
      async (signal) => {
        const url = dayKey !== "all" ? `/api/schedule?day=${encodeURIComponent(dayKey)}` : "/api/schedule";
        try {
          const json = await fetchJson<{ data?: ScheduleItem[] }>(url, signal);
          return Array.isArray(json.data) ? json.data : [];
        } catch (error) {
          if (!allowsDirectFallback(error)) throw error;
          let query = createClient().from("schedule_items").select("*");
          if (dayKey !== "all") query = query.eq("day", dayKey);
          const { data: dbData, error: dbError } = await query
            .order("start_time", { ascending: true })
            .abortSignal(signal);
          if (dbError) throw dbError;
          return (dbData ?? []) as ScheduleItem[];
        }
      },
      { ttlMs: SCHEDULE_TTL_MS, signal }
    );
    if (data.length > 0) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch {
          // Storage quota exceeded or disabled
        }
      }
      return { data, fromCache: false };
    }
  } catch {
    // Rede indisponível, acesso negado ou falha do servidor
  }

  // Offline Cache Fallback
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ScheduleItem[];
        if (day && day !== "all") {
          return { data: parsed.filter((i) => i.day === day), fromCache: true };
        }
        return { data: parsed, fromCache: true };
      }
    } catch {
      // JSON parse error
    }
  }

  // Last Resort: Official Static Schedule
  const fallback = getOfficialStaticFallback();
  if (day && day !== "all") {
    return { data: fallback.filter((i) => i.day === day), fromCache: true };
  }
  return { data: fallback, fromCache: true };
}

const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * O que cada pessoa vê na agenda. Jovens não veem o dia zero nem atividades
 * internas da equipe (reuniões de coordenação, preparação de check-in etc.).
 */
export function scheduleVisibleTo(role: string | null | undefined, items: ScheduleItem[]): ScheduleItem[] {
  if (role && role !== "jovem") return items;
  return items.filter(
    (item) =>
      item.day !== "dia0" &&
      item.category !== "Equipe" &&
      // Bancos semeados antes de nov/2026 marcam a preparação da equipe como "Logística".
      !(item.category === "Logística" && /^Prepara/i.test(item.title))
  );
}

function addMinutes(hhmm: string, minutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Data (AAAA-MM-DD) e hora (HH:MM) atuais no fuso do evento. */
export function eventClock(referenceDate: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(referenceDate);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? "";
  return { today: `${part("year")}-${part("month")}-${part("day")}`, now: `${part("hour")}:${part("minute")}` };
}

/**
 * Término efetivo: o informado; sem ele, o início da próxima atividade do dia
 * (ou uma hora depois do início). Assim nada fica eternamente "sem horário".
 */
export function effectiveEndTime(item: ScheduleItem, sameDay: ScheduleItem[]): string {
  if (TIME_RE.test(item.end_time) && item.end_time > item.start_time) return item.end_time;
  const next = sameDay.find((other) => other.start_time > item.start_time);
  return next?.start_time ?? addMinutes(item.start_time, 60);
}

/**
 * Calculates currently active event and next scheduled event
 */
export function calculateActiveAndNextEvents(
  items: ScheduleItem[],
  referenceDate: Date = new Date()
): {
  currentEvent: ScheduleItem | null;
  nextEvent: ScheduleItem | null;
  activeDayLabel: string;
} {
  const list = items.filter(item => item.day !== "dia0").sort((a, b) =>
    `${a.date}T${a.start_time}`.localeCompare(`${b.date}T${b.start_time}`));
  const eventStart = new Date(EVENT_START_AT);
  const eventEnd = new Date(EVENT_END_AT);
  const { today, now } = eventClock(referenceDate);
  const labels: Record<string, string> = {
    dia1: "1º dia · sábado 06/02", dia2: "2º dia · domingo 07/02",
    dia3: "3º dia · segunda 08/02", dia4: "4º dia · terça 09/02", dia5: "5º dia · quarta 10/02",
  };
  if (referenceDate < eventStart) return {
    currentEvent: null, nextEvent: list[0] ?? null,
    activeDayLabel: EVENT_DATES,
  };
  if (referenceDate > eventEnd) return {
    currentEvent: null, nextEvent: null, activeDayLabel: "Edição concluída",
  };
  const todays = list.filter(item => item.date === today);
  const current = todays.find(item => item.start_time <= now && effectiveEndTime(item, todays) > now) ?? null;
  const next = list.find(item => item.date > today || (item.date === today && item.start_time > now)) ?? null;
  const day = todays[0]?.day;
  return { currentEvent: current, nextEvent: next, activeDayLabel: day ? labels[day] : "FSY 2027" };
}
