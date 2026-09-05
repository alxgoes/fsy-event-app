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
  const youthItems = items.filter((i) => i.day !== "dia0");
  const list = youthItems.length > 0 ? youthItems : items;

  const eventStartDate = new Date("2027-02-06T08:00:00");
  const eventEndDate = new Date("2027-02-10T23:59:59");
  const isBeforeEvent = referenceDate < eventStartDate;
  const isAfterEvent = referenceDate > eventEndDate;

  const currentTime = referenceDate.toTimeString().slice(0, 5); // "HH:MM"
  const todayIso = referenceDate.toISOString().slice(0, 10);

  const dayNameMap: Record<string, string> = {
    dia1: "1º Dia (Sábado 06/02)",
    dia2: "2º Dia (Domingo 07/02)",
    dia3: "3º Dia (Segunda 08/02)",
    dia4: "4º Dia (Terça 09/02)",
    dia5: "5º Dia (Quarta 10/02)",
  };

  if (!isBeforeEvent && !isAfterEvent) {
    const todayEvents = list.filter((item) => item.date === todayIso);
    const candidateList = todayEvents.length > 0 ? todayEvents : list;

    const activeCurrent = candidateList.find(
      (item) => item.start_time <= currentTime && item.end_time > currentTime
    );
    const activeNext = candidateList.find((item) => item.start_time > currentTime);
    const fallbackCurrent = candidateList.find((i) => i.is_highlight) || candidateList[0];
    const fallbackNext = candidateList.find((i) => i.id !== fallbackCurrent?.id) || null;

    const current = activeCurrent || fallbackCurrent || null;
    const next = activeNext || fallbackNext || null;
    const dayKey = current?.day || "dia1";

    return {
      currentEvent: current,
      nextEvent: next,
      activeDayLabel: dayNameMap[dayKey] || "1º Dia (Sábado 06/02)",
    };
  }

  // Pre or Post event default view
  const firstEvent = list.find((i) => i.day === "dia1") || list[0] || null;
  const secondEvent = list.find((i) => i.id !== firstEvent?.id) || null;

  return {
    currentEvent: firstEvent,
    nextEvent: secondEvent,
    activeDayLabel: isBeforeEvent ? "Em Breve • 06 a 10 Fev 2027" : "Edição Concluída • FSY 2027",
  };
}
