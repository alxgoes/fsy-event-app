"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { HeroCard } from "./HeroCard";
import { HappeningNowCard } from "./HappeningNowCard";
import { MyCompanyCard } from "./MyCompanyCard";
import { MemoriesCard } from "./MemoriesCard";
import { DailyThemeCard } from "./DailyThemeCard";
import { useProfile } from "@/lib/supabase/useProfile";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Clock, Users } from "lucide-react";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0, scale: 0.96 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 24,
    },
  },
};

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
  created_at: string;
  profiles?: { full_name: string; role: string } | null;
}

export function YouthDashboard() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [currentEvent, setCurrentEvent] = useState<ScheduleItem | null>(null);
  const [nextEvent, setNextEvent] = useState<ScheduleItem | null>(null);
  const [activeDayLabel, setActiveDayLabel] = useState<string>("1º Dia");
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!profileLoading && !profile) {
      router.push("/login");
    }
  }, [profileLoading, profile, router]);

  useEffect(() => {
    if (!profile) return;

    const supabase = createClient();

    async function loadDashboardData() {
      if (!profile) return;
      setDataLoading(true);

      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"
      const todayIso = now.toISOString().slice(0, 10);

      // Fetch all schedule items from API or Supabase
      try {
        let scheduleItems: ScheduleItem[] = [];

        const res = await fetch("/api/schedule");
        if (res.ok) {
          const json = await res.json();
          if (json.data && json.data.length > 0) {
            scheduleItems = json.data;
          }
        }

        if (scheduleItems.length === 0) {
          const { data } = await supabase
            .from("schedule_items")
            .select("*")
            .order("start_time", { ascending: true });
          if (data) scheduleItems = data as ScheduleItem[];
        }

        if (scheduleItems.length > 0) {
          // Check if today matches any date in schedule
          const todayEvents = scheduleItems.filter(
            (item) => item.date === todayIso || item.day === "dia1"
          );

          const candidateList = todayEvents.length > 0 ? todayEvents : scheduleItems;

          // Find current event (start_time <= currentTime <= end_time)
          const activeCurrent = candidateList.find(
            (item) => item.start_time <= currentTime && item.end_time > currentTime
          );

          // Find next event (start_time > currentTime)
          const activeNext = candidateList.find(
            (item) => item.start_time > currentTime
          );

          // If no active in time window, pick highlights or first event
          const fallbackCurrent =
            candidateList.find((i) => i.is_highlight) || candidateList[0];
          const fallbackNext =
            candidateList.find((i) => i.id !== fallbackCurrent?.id) || null;

          setCurrentEvent(activeCurrent || fallbackCurrent || null);
          setNextEvent(activeNext || fallbackNext || null);

          // Set active day label
          const selectedDayKey = (activeCurrent || fallbackCurrent)?.day || "dia1";
          const dayNameMap: Record<string, string> = {
            dia0: "Dia Zero (Sexta 05/02)",
            dia1: "1º Dia (Sábado 06/02)",
            dia2: "2º Dia (Domingo 07/02)",
            dia3: "3º Dia (Segunda 08/02)",
            dia4: "4º Dia (Terça 09/02)",
            dia5: "5º Dia (Quarta 10/02)",
          };
          setActiveDayLabel(dayNameMap[selectedDayKey] || "1º Dia (Sábado 06/02)");
        }
      } catch (err) {
        console.error("Error loading schedule for dashboard:", err);
      }

      // Fetch company data if profile has company_id
      if (profile.company_id) {
        const { data: companyData } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profile.company_id)
          .single();

        if (companyData) setCompany(companyData);

        // Fetch announcements for this company (global or company-specific)
        const { data: announcementsData } = await supabase
          .from("announcements")
          .select("id, title, content, priority, created_at, profiles(full_name, role)")
          .or(`target_company_id.is.null,target_company_id.eq.${profile.company_id}`)
          .order("created_at", { ascending: false })
          .limit(5);

        if (announcementsData) setAnnouncements(announcementsData as unknown as Announcement[]);
      } else {
        // Global announcements only
        const { data: announcementsData } = await supabase
          .from("announcements")
          .select("id, title, content, priority, created_at, profiles(full_name, role)")
          .is("target_company_id", null)
          .order("created_at", { ascending: false })
          .limit(5);

        if (announcementsData) setAnnouncements(announcementsData as unknown as Announcement[]);
      }

      setDataLoading(false);
    }

    loadDashboardData();
  }, [profile]);

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-fsy-watermark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-600 dark:text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin text-[#4361EE]" />
          <p className="font-bold text-sm">Carregando seu perfil...</p>
        </div>
      </div>
    );
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "Olá";
  const companyName = company?.name ?? profile?.company_id ?? null;
  const roomLabel = profile?.room ?? null;

  return (
    <div className="min-h-screen pb-24 sm:pb-12 bg-fsy-watermark text-slate-900 dark:text-slate-100">
      {/* Global Modular Header with Theme Toggle & Notifications */}
      <Header />

      {/* No Company Assigned Yet — friendly onboarding state */}
      {!profile?.company_id && !dataLoading && (
        <div className="max-w-2xl mx-auto mt-8 mx-4 px-4">
          <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-8 text-center space-y-3">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFD166] border-2 border-slate-900">
                <Users className="h-8 w-8 text-slate-900" />
              </div>
            </div>
            <h2 className="font-heading text-2xl font-black text-slate-900 dark:text-white">
              Bem-vindo ao FSY, {firstName}!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Você ainda não foi designado a uma companhia. A equipe de coordenação irá te designar em breve. Enquanto isso, você já pode ver a programação completa!
            </p>
            <a
              href="/schedule"
              className="inline-flex items-center gap-2 mt-2 rounded-2xl bg-[#4361EE] text-white px-5 py-2.5 text-sm font-black border-2 border-slate-900 shadow-brutal-sm hover:bg-blue-600 transition-colors"
            >
              <Clock className="h-4 w-4" />
              Ver Programação
            </a>
          </div>
        </div>
      )}

      {/* Main Bento Grid */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
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
              companyName={companyName}
              counselors={company?.counselors ?? null}
              companyMotto={company?.motto ?? null}
              announcements={announcements}
            />
          </motion.div>

          {/* 5. Memories Card */}
          <motion.div variants={itemVariants} className="md:col-span-12">
            <MemoriesCard />
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
