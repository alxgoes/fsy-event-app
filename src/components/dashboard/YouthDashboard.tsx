"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, Variants, useReducedMotion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { HeroCard } from "./HeroCard";
import { HappeningNowCard } from "./HappeningNowCard";
import { MyCompanyCard } from "./MyCompanyCard";
import { MemoriesCard } from "./MemoriesCard";
import { DailyThemeCard } from "./DailyThemeCard";
import { FeaturedPhotosSection, MediaPhoto } from "@/components/media/FeaturedPhotosSection";
import { useProfile } from "@/lib/supabase/useProfile";
import { createClient } from "@/lib/supabase/client";
import { Users } from "lucide-react";
import { LoadingScreen } from "@/components/ui/LoadingScreen";


interface ScheduleItem {
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

interface CompanyData {
  id: string;
  name: string;
  motto: string | null;
  counselors: string[] | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: string;
  category?: string;
  created_at: string;
  liked_by?: string[];
  likes_count?: number;
  profiles?: { full_name: string; role: string } | null;
}

export function YouthDashboard() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const shouldReduceMotion = useReducedMotion();
  const [currentEvent, setCurrentEvent] = useState<ScheduleItem | null>(null);
  const [nextEvent, setNextEvent] = useState<ScheduleItem | null>(null);
  const [activeDayLabel, setActiveDayLabel] = useState<string>("Em Breve • FSY 2027");
  const [isPreEvent, setIsPreEvent] = useState<boolean>(true);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [featuredPhotos, setFeaturedPhotos] = useState<MediaPhoto[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!profileLoading && !profile) {
      router.push("/login");
    }
  }, [profileLoading, profile, router]);

  useEffect(() => {
    if (!profile) return;

    let isMounted = true;
    const supabase = createClient();

    // Safety timeout: never hang forever if network is offline or throttled
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setDataLoading(false);
      }
    }, 3500);

    async function loadDashboardData() {
      if (!profile) return;
      setDataLoading(true);

      const now = new Date();
      // Youth arrival is Saturday, 06 of February (Dia 1). Friday (Dia 0) is counselors only.
      const eventStartDate = new Date("2027-02-06T08:00:00");
      const eventEndDate = new Date("2027-02-10T23:59:59");
      const isBeforeEvent = now < eventStartDate;
      const isAfterEvent = now > eventEndDate;

      if (isMounted) {
        setIsPreEvent(isBeforeEvent);
        if (isBeforeEvent) {
          const diffMs = eventStartDate.getTime() - now.getTime();
          const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          setDaysRemaining(diffDays);
          setActiveDayLabel("Em Breve • 06 a 10 Fev 2027");
        }
      }

      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      const todayIso = now.toISOString().slice(0, 10);

      // Task 1: Schedule items
      const scheduleTask = (async () => {
        try {
          const res = await fetch("/api/schedule");
          if (res.ok) {
            const json = await res.json();
            if (json.data && json.data.length > 0) {
              return json.data as ScheduleItem[];
            }
          }
          const { data } = await supabase
            .from("schedule_items")
            .select("*")
            .order("start_time", { ascending: true });
          return (data as ScheduleItem[]) || [];
        } catch {
          return [];
        }
      })();

      // Task 2: Company data
      const companyTask = (async () => {
        if (!profile.company_id) return null;
        try {
          const { data } = await supabase
            .from("companies")
            .select("*")
            .eq("id", profile.company_id)
            .single();
          return (data as CompanyData) || null;
        } catch {
          return null;
        }
      })();

      // Task 3: Announcements
      const announcementsTask = (async () => {
        try {
          const endpoint = profile.company_id
            ? `/api/announcements?company_id=${profile.company_id}&_t=${Date.now()}`
            : `/api/announcements?_t=${Date.now()}`;
          const res = await fetch(endpoint);
          if (res.ok) {
            const json = await res.json();
            if (profile.company_id) {
              return (json.data as Announcement[]) || [];
            } else {
              return ((json.data ?? []) as (Announcement & { target_company_id?: string | null })[]).filter(
                (a) => !a.target_company_id
              );
            }
          }
        } catch {
          // ignore
        }
        return [];
      })();

      // Task 4: Pre-load featured photos so they don't pop-in afterwards
      const mediaTask = (async () => {
        try {
          const res = await fetch(`/api/media?_t=${Date.now()}`);
          if (res.ok) {
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
              return (json.data as MediaPhoto[]).filter((p) => p.visible);
            }
          }
          const { data } = await supabase
            .from("media_photos")
            .select("*")
            .eq("visible", true)
            .order("created_at", { ascending: false });
          return (data as MediaPhoto[]) || [];
        } catch {
          return [];
        }
      })();

      // Execute all essential tasks concurrently
      const [scheduleRes, compRes, annRes, mediaRes] = await Promise.allSettled([
        scheduleTask,
        companyTask,
        announcementsTask,
        mediaTask,
      ]);

      if (!isMounted) return;

      // 1. Process Schedule (Dia 0 is for counselors only; youth schedule starts on Dia 1)
      if (scheduleRes.status === "fulfilled" && scheduleRes.value.length > 0) {
        const rawScheduleItems = scheduleRes.value;
        const youthScheduleItems = rawScheduleItems.filter((item) => item.day !== "dia0");
        const scheduleItems = youthScheduleItems.length > 0 ? youthScheduleItems : rawScheduleItems;

        if (!isBeforeEvent && !isAfterEvent) {
          const todayEvents = scheduleItems.filter((item) => item.date === todayIso);
          const candidateList = todayEvents.length > 0 ? todayEvents : scheduleItems;

          const activeCurrent = candidateList.find(
            (item) => item.start_time <= currentTime && item.end_time > currentTime
          );
          const activeNext = candidateList.find((item) => item.start_time > currentTime);

          const fallbackCurrent = candidateList.find((i) => i.is_highlight) || candidateList[0];
          const fallbackNext = candidateList.find((i) => i.id !== fallbackCurrent?.id) || null;

          setCurrentEvent(activeCurrent || fallbackCurrent || null);
          setNextEvent(activeNext || fallbackNext || null);

          const selectedDayKey = (activeCurrent || fallbackCurrent)?.day || "dia1";
          const dayNameMap: Record<string, string> = {
            dia1: "1º Dia (Sábado 06/02)",
            dia2: "2º Dia (Domingo 07/02)",
            dia3: "3º Dia (Segunda 08/02)",
            dia4: "4º Dia (Terça 09/02)",
            dia5: "5º Dia (Quarta 10/02)",
          };
          setActiveDayLabel(dayNameMap[selectedDayKey] || "1º Dia (Sábado 06/02)");
        } else {
          const firstEvent =
            scheduleItems.find((i) => i.day === "dia1") || scheduleItems[0];
          setCurrentEvent(firstEvent || null);
          setNextEvent(scheduleItems[1] || null);
        }
      }

      // 2. Process Company
      if (compRes.status === "fulfilled" && compRes.value) {
        setCompany(compRes.value);
      }

      // 3. Process Announcements
      if (annRes.status === "fulfilled" && annRes.value) {
        setAnnouncements(annRes.value);
      }

      // 4. Process Media
      if (mediaRes.status === "fulfilled" && mediaRes.value) {
        setFeaturedPhotos(mediaRes.value);
      }

      clearTimeout(safetyTimeout);
      setDataLoading(false);
    }

    loadDashboardData();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [profile]);

  const isReady = !profileLoading && !dataLoading && Boolean(profile);

  if (!isReady) {
    return (
      <LoadingScreen
        title="Preparando o FSY 2027"
        message="Sincronizando atividades, comunicados e companhia..."
        submessage="Verificando dados da sua sessão em tempo real"
      />
    );
  }

  const containerVariants: Variants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0 },
    visible: {
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : {
            staggerChildren: 0.08,
            delayChildren: 0.04,
          },
    },
  };

  const itemVariants: Variants = {
    hidden: shouldReduceMotion
      ? { opacity: 1, y: 0, scale: 1 }
      : { y: 16, opacity: 0, scale: 0.98 },
    visible: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : {
            type: "spring",
            stiffness: 320,
            damping: 26,
          },
    },
  };

  const firstName = profile?.full_name?.split(" ")[0] ?? "Olá";
  const companyName = company?.name ?? profile?.company_id ?? null;
  const roomLabel = profile?.room ?? null;

  return (
    <div className="min-h-screen pb-24 sm:pb-12 bg-fsy-watermark text-slate-900 dark:text-slate-100">
      {/* Global Modular Header with Theme Toggle & Notifications */}
      <Header />

      {/* No Company Assigned Yet — friendly onboarding state */}
      {!profile?.company_id && !dataLoading && (
        <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-700 p-3.5 text-xs text-amber-900 dark:text-amber-200 shadow-brutal-sm"
          >
            <Users className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Companhia não designada:</strong> Sua companhia será designada pela equipe na abertura do FSY 2027.
            </span>
          </motion.div>
        </div>
      )}

      {/* Main Grid Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-12"
        >
          {/* 1. Hero Card */}
          <motion.div variants={itemVariants} className="md:col-span-12 lg:col-span-8">
            <HeroCard
              userName={firstName}
              companyName={companyName ?? "Aguardando designação"}
              sessionDay={activeDayLabel}
              room={roomLabel}
            />
          </motion.div>

          {/* 2. Daily Theme Card */}
          <motion.div variants={itemVariants} className="md:col-span-6 lg:col-span-4">
            <DailyThemeCard />
          </motion.div>

          {/* 3. Happening Now Card */}
          <motion.div variants={itemVariants} className="md:col-span-6 lg:col-span-5">
            <HappeningNowCard
              isPreEvent={isPreEvent}
              daysRemaining={daysRemaining}
              currentEvent={
                currentEvent
                  ? {
                      title: currentEvent.title,
                      startTime: currentEvent.start_time,
                      endTime: currentEvent.end_time || "--",
                      location: currentEvent.location,
                      description: currentEvent.description ?? "",
                      tag: currentEvent.category,
                    }
                  : undefined
              }
              nextEvent={
                nextEvent
                  ? {
                      title: nextEvent.title,
                      startTime: nextEvent.start_time,
                      location: nextEvent.location,
                    }
                  : undefined
              }
            />
          </motion.div>

          {/* 4. My Company Card */}
          <motion.div variants={itemVariants} className="md:col-span-6 lg:col-span-7">
            <MyCompanyCard
              currentUserId={profile?.id || null}
              companyName={companyName}
              counselors={company?.counselors ?? null}
              companyMotto={company?.motto ?? null}
              announcements={announcements}
            />
          </motion.div>

          {/* 5. Featured Drive Photos (pre-loaded and verified before dashboard reveals) */}
          <motion.div variants={itemVariants} className="md:col-span-12">
            <FeaturedPhotosSection initialPhotos={featuredPhotos} initialLoading={false} />
          </motion.div>

          {/* 6. Instagram Memories Card */}
          <motion.div variants={itemVariants} className="md:col-span-12">
            <MemoriesCard />
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
