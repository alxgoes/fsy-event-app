import { OFFICIAL_FSY_SCHEDULE } from "@/data/officialSchedule";
import { createClient } from "@/lib/supabase/client";

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

/** Helper to generate fallback items from the official static schedule */
function getOfficialStaticFallback(): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const dayDates: Record<string, string> = {
    dia0: "2027-02-05",
    dia1: "2027-02-06",
    dia2: "2027-02-07",
    dia3: "2027-02-08",
    dia4: "2027-02-09",
    dia5: "2027-02-10",
  };

  for (const [dayKey, dayData] of Object.entries(OFFICIAL_FSY_SCHEDULE)) {
    const assignedDate = dayDates[dayKey] || "2027-02-05";
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
 * 1. Tries to fetch from API / Supabase
 * 2. Caches response in localStorage
 * 3. Falls back to localStorage if offline
 * 4. Falls back to static officialSchedule if storage is empty
 */
export async function getSchedule(day?: string): Promise<{ data: ScheduleItem[]; fromCache: boolean }> {
  // Try network fetch first
  try {
    const url = day && day !== "all" ? `/api/schedule?day=${encodeURIComponent(day)}` : "/api/schedule";
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(json.data));
          } catch {
            // Storage quota exceeded or disabled
          }
        }
        return { data: json.data as ScheduleItem[], fromCache: false };
      }
    }

    // Direct Supabase fallback
    const supabase = createClient();
    let query = supabase.from("schedule_items").select("*");
    if (day && day !== "all") query = query.eq("day", day);
    const { data: dbData } = await query.order("start_time", { ascending: true });
    if (dbData && dbData.length > 0) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(dbData));
        } catch {}
      }
      return { data: dbData as ScheduleItem[], fromCache: false };
    }
  } catch {
    // Network failed or offline
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
  const eventStart = new Date("2027-02-06T08:00:00-03:00");
  const eventEnd = new Date("2027-02-10T23:59:59-03:00");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(referenceDate);
  const part = (type: string) => parts.find(value => value.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const now = `${part("hour")}:${part("minute")}`;
  const labels: Record<string, string> = {
    dia1: "1º Dia (Sábado 06/02)", dia2: "2º Dia (Domingo 07/02)",
    dia3: "3º Dia (Segunda 08/02)", dia4: "4º Dia (Terça 09/02)", dia5: "5º Dia (Quarta 10/02)",
  };
  if (referenceDate < eventStart) return {
    currentEvent: null, nextEvent: list[0] ?? null,
    activeDayLabel: "Em Breve • 06 a 10 Fev 2027",
  };
  if (referenceDate > eventEnd) return {
    currentEvent: null, nextEvent: null, activeDayLabel: "Edição Concluída • FSY 2027",
  };
  const current = list.find(item => item.date === today && item.start_time <= now && item.end_time > now) ?? null;
  const next = list.find(item => item.date > today || (item.date === today && item.start_time > now)) ?? null;
  const day = list.find(item => item.date === today)?.day;
  return { currentEvent: current, nextEvent: next, activeDayLabel: day ? labels[day] : "FSY 2027" };
}
