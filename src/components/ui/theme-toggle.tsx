"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`h-10 w-10 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 opacity-60 ${className}`} />
    );
  }

  const isDark = theme === "dark";

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92, y: 2 }}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-brutal-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${className}`}
      aria-label="Alternar tema claro/escuro"
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
    >
      {isDark ? (
        <Sun className="h-5 w-5 text-[#FFD166] transition-transform duration-300 rotate-0" />
      ) : (
        <Moon className="h-5 w-5 text-[#4361EE] transition-transform duration-300 -rotate-12" />
      )}
    </motion.button>
  );
}
