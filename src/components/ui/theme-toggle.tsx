"use client";
import { useHydrated } from "@/lib/ui/useHydrated";


import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, useReducedMotion } from "framer-motion";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();
  const reduceMotion = useReducedMotion();

  if (!mounted) {
    return (
      <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 opacity-60 ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <motion.button
      whileHover={reduceMotion ? undefined : { scale: 1.05 }}
      whileTap={reduceMotion ? undefined : { scale: 0.92, y: 1 }}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 shadow-2xs hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0 ${className}`}
      aria-label="Alternar tema claro/escuro"
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[#FFE48A] transition-transform duration-300 rotate-0" />
      ) : (
        <Moon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[#005E7C] dark:text-[#7DE3F4] transition-transform duration-300 -rotate-12" />
      )}
    </motion.button>
  );
}
