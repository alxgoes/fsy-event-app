"use client";

import React from "react";

export function HeroCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800/80 p-6 sm:p-8 shadow-brutal-md animate-pulse min-h-[220px] flex flex-col justify-between">
      <div className="space-y-3">
        <div className="h-6 w-36 rounded-xl bg-slate-300 dark:bg-slate-700" />
        <div className="h-10 w-3/4 max-w-sm rounded-2xl bg-slate-300 dark:bg-slate-700" />
        <div className="h-4 w-1/2 rounded-lg bg-slate-300 dark:bg-slate-700" />
      </div>
      <div className="flex gap-2.5 pt-4">
        <div className="h-10 w-36 rounded-2xl bg-slate-300 dark:bg-slate-700" />
        <div className="h-10 w-28 rounded-2xl bg-slate-300 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export function DailyThemeSkeleton() {
  return (
    <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800/80 p-6 shadow-brutal-md animate-pulse min-h-[220px] flex flex-col justify-between">
      <div className="space-y-3">
        <div className="h-5 w-28 rounded-xl bg-slate-300 dark:bg-slate-700" />
        <div className="h-7 w-full rounded-xl bg-slate-300 dark:bg-slate-700" />
        <div className="h-4 w-4/5 rounded-lg bg-slate-300 dark:bg-slate-700" />
      </div>
      <div className="h-10 w-full rounded-2xl bg-slate-300 dark:bg-slate-700" />
    </div>
  );
}

export function HappeningNowSkeleton() {
  return (
    <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800/80 p-6 shadow-brutal-md animate-pulse min-h-[260px] flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded-xl bg-slate-300 dark:bg-slate-700" />
          <div className="h-6 w-20 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
        <div className="h-8 w-2/3 rounded-xl bg-slate-300 dark:bg-slate-700" />
        <div className="h-4 w-1/2 rounded-lg bg-slate-300 dark:bg-slate-700" />
      </div>
      <div className="h-14 w-full rounded-2xl bg-slate-300 dark:bg-slate-700" />
    </div>
  );
}

export function MyCompanySkeleton() {
  return (
    <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800/80 p-6 shadow-brutal-md animate-pulse min-h-[260px] flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-40 rounded-xl bg-slate-300 dark:bg-slate-700" />
          <div className="h-6 w-16 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
        <div className="h-8 w-3/4 rounded-xl bg-slate-300 dark:bg-slate-700" />
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>
      </div>
      <div className="h-12 w-full rounded-2xl bg-slate-300 dark:bg-slate-700" />
    </div>
  );
}

export function FeaturedPhotosSkeleton() {
  return (
    <div className="rounded-3xl border-2 border-slate-900 dark:border-slate-700 bg-slate-200/80 dark:bg-slate-800/80 p-6 shadow-brutal-md animate-pulse min-h-[320px] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-48 rounded-xl bg-slate-300 dark:bg-slate-700" />
        <div className="h-6 w-24 rounded-full bg-slate-300 dark:bg-slate-700" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 h-52">
        <div className="rounded-2xl bg-slate-300 dark:bg-slate-700 h-full w-full" />
        <div className="rounded-2xl bg-slate-300 dark:bg-slate-700 h-full w-full" />
        <div className="rounded-2xl bg-slate-300 dark:bg-slate-700 h-full w-full hidden sm:block" />
        <div className="rounded-2xl bg-slate-300 dark:bg-slate-700 h-full w-full hidden sm:block" />
      </div>
    </div>
  );
}

export function DashboardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-12">
      <div className="md:col-span-12 lg:col-span-8">
        <HeroCardSkeleton />
      </div>
      <div className="md:col-span-6 lg:col-span-4">
        <DailyThemeSkeleton />
      </div>
      <div className="md:col-span-6 lg:col-span-5">
        <HappeningNowSkeleton />
      </div>
      <div className="md:col-span-6 lg:col-span-7">
        <MyCompanySkeleton />
      </div>
      <div className="md:col-span-12">
        <FeaturedPhotosSkeleton />
      </div>
    </div>
  );
}
