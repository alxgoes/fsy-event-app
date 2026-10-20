"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { HeroCard } from "./HeroCard";
import { HappeningNowCard } from "./HappeningNowCard";
import { MyCompanyCard } from "./MyCompanyCard";
import { MemoriesCard } from "./MemoriesCard";
import { DailyThemeCard } from "./DailyThemeCard";
import { PhotoGallery } from "@/components/media/PhotoGallery";
import type { MediaPhoto } from "@/types/media";
import { useProfile } from "@/lib/supabase/useProfile";
import { Users, WifiOff } from "lucide-react";
import { DashboardGridSkeleton } from "./DashboardSkeletons";
import { ScrollIndicator, ScrollSection } from "@/components/ui/scroll-indicator";
import { CustomizableGrid } from "@/components/layout/CustomizableGrid";

const YOUTH_SECTIONS: ScrollSection[] = [
  { id: "intro", title: "Início", level: 2 },
  { id: "now", title: "Programação", level: 2 },
  { id: "company", title: "Companhia", level: 2 },
  { id: "photos", title: "Galeria", level: 2 },
];
import {
  getSchedule,
  calculateActiveAndNextEvents,
  ScheduleItem,
} from "@/services/scheduleService";
import { getAnnouncements, Announcement } from "@/services/announcementsService";
import { getCompany, CompanyData } from "@/services/companyService";
import { getFeaturedPhotos } from "@/services/mediaService";

export function YouthDashboard() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();

  const [currentEvent, setCurrentEvent] = useState<ScheduleItem | null>(null);
  const [nextEvent, setNextEvent] = useState<ScheduleItem | null>(null);
  const [activeDayLabel, setActiveDayLabel] = useState<string>("Em Breve • FSY 2027");
  const [isPreEvent, setIsPreEvent] = useState<boolean>(true);
  const [daysRemaining, setDaysRemaining] = useState<number>(0);

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [featuredPhotos, setFeaturedPhotos] = useState<MediaPhoto[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  useEffect(() => {
    if (!profileLoading && !profile) {
      router.push("/login");
    }
  }, [profileLoading, profile, router]);

  useEffect(() => {
    if (!profile) return;

    let isMounted = true;

    // Safety timeout: never hang loading skeletons for more than 2 seconds
    const safetyTimeout = setTimeout(() => {
      if (isMounted) setDataLoading(false);
    }, 2000);

    async function loadAllServices() {
      if (!profile) return;

      const now = new Date();
      const eventStartDate = new Date("2027-02-06T08:00:00");
      const eventEndDate = new Date("2027-02-10T23:59:59");
      const isBeforeEvent = now < eventStartDate;

      if (isMounted) {
        setIsPreEvent(isBeforeEvent);
        if (isBeforeEvent) {
          const diffMs = eventStartDate.getTime() - now.getTime();
          const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          setDaysRemaining(diffDays);
          setActiveDayLabel("Em Breve • 06 a 10 Fev 2027");
        }
      }

      // 1. Fetch Schedule via Service
      const schedulePromise = getSchedule().then(({ data, fromCache }) => {
        if (!isMounted) return;
        if (fromCache && !navigator.onLine) setIsOfflineMode(true);
        if (data.length > 0) {
          const { currentEvent: curr, nextEvent: nxt, activeDayLabel: label } =
            calculateActiveAndNextEvents(data, now);
          setCurrentEvent(curr);
          setNextEvent(nxt);
          if (!isBeforeEvent && now <= eventEndDate) {
            setActiveDayLabel(label);
          }
        }
      });

      // 2. Fetch Company via Service
      const companyPromise = profile.company_id
        ? getCompany(profile.company_id).then(({ data }) => {
            if (isMounted && data) setCompany(data);
          })
        : Promise.resolve();

      // 3. Fetch Announcements via Service
      const announcementsPromise = getAnnouncements(profile.company_id).then(
        ({ data }) => {
          if (isMounted) setAnnouncements(data);
        }
      );

      // 4. Fetch Media via Service
      const mediaPromise = getFeaturedPhotos().then(({ data }) => {
        if (isMounted) setFeaturedPhotos(data);
      });

      await Promise.allSettled([
        schedulePromise,
        companyPromise,
        announcementsPromise,
        mediaPromise,
      ]);

      if (isMounted) {
        clearTimeout(safetyTimeout);
        setDataLoading(false);
      }
    }

    loadAllServices();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [profile]);

  const firstName = profile?.full_name?.split(" ")[0] ?? "Olá";
  const companyName = company?.name ?? profile?.company_id ?? null;
  const roomLabel = profile?.room ?? null;

  return (
    <div className="min-h-screen pb-24 sm:pb-12 bg-fsy-watermark text-slate-900 dark:text-slate-100">
      {/* Global Modular Header with Theme Toggle & Notifications */}
      <Header />

      {/* Offline Status Badge */}
      {isOfflineMode && (
        <div className="mx-auto max-w-7xl px-4 sm:px-8 pt-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-1.5 text-xs font-bold shadow-sm border border-slate-700 w-fit">
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            <span>Modo Offline • Exibindo dados salvos em cache</span>
          </div>
        </div>
      )}

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

      {/* Main Grid Content: Skeletons while loading, Bento Grid when ready */}
      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-6">
        {dataLoading ? (
          <DashboardGridSkeleton />
        ) : (
          <>
            {/* Precision Scroll Indicator (Desktop) */}
            <div className="fixed right-3 top-1/2 -translate-y-1/2 z-30 hidden xl:flex h-56 items-center pointer-events-auto">
              <ScrollIndicator sections={YOUTH_SECTIONS} />
            </div>
            <CustomizableGrid
              pageKey="dashboard"
              version={1}
              className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-12"
              items={[
                {
                  id: "hero",
                  label: "Boas-vindas",
                  className: "md:col-span-12 lg:col-span-8",
                  content: (
                    <div data-section-index="0" className="h-full">
                      <HeroCard userName={firstName} companyName={companyName ?? "Aguardando designação"} sessionDay={activeDayLabel} room={roomLabel} />
                    </div>
                  ),
                },
                { id: "theme", label: "Tema do dia", className: "md:col-span-6 lg:col-span-4", content: <DailyThemeCard /> },
                {
                  id: "now",
                  label: "Acontecendo agora",
                  className: "md:col-span-6 lg:col-span-5",
                  content: (
                    <div data-section-index="1" className="h-full">
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
                        nextEvent={nextEvent ? { title: nextEvent.title, startTime: nextEvent.start_time, location: nextEvent.location } : undefined}
                      />
                    </div>
                  ),
                },
                {
                  id: "company",
                  label: "Minha companhia",
                  className: "md:col-span-6 lg:col-span-7",
                  content: (
                    <div data-section-index="2" className="h-full">
                      <MyCompanyCard
                        currentUserId={profile?.id || null}
                        companyName={companyName}
                        counselors={company?.counselors ?? null}
                        companyMotto={company?.motto ?? null}
                        announcements={announcements}
                      />
                    </div>
                  ),
                },
                {
                  id: "photos",
                  label: "Galeria de fotos",
                  className: "md:col-span-12",
                  content: (
                    <div data-section-index="3">
                      <PhotoGallery photos={featuredPhotos} />
                    </div>
                  ),
                },
                { id: "instagram", label: "Instagram do FSY", className: "md:col-span-12", content: <MemoriesCard /> },
              ]}
            />
          </>
        )}
      </main>
    </div>
  );
}
