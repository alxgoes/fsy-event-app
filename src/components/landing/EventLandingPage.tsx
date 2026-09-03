"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  Users,
  Music2,
  ShieldCheck,
  Camera,
  ArrowRight,
  ChevronDown,
  BookOpen,
  Compass,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FsyTempleMark } from "@/components/brand/FsyLogo";
import { useProfile } from "@/lib/supabase/useProfile";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const EVENT_DATE = new Date("2027-02-05T00:00:00");

const DAYS_SCHEDULE = [
  {
    dayId: "dia0",
    name: "Dia Zero",
    date: "Sexta • 05/02",
    title: "Chegada dos Líderes & Preparação",
    description:
      "Acolhimento da equipe de logística, consultores e treinamento final para recepção calorosa das caravanas.",
    highlights: ["Recepção dos Consultores", "Montagem das Companhias", "Devocional de Abertura da Equipe"],
    tag: "Preparação",
  },
  {
    dayId: "dia1",
    name: "1º Dia",
    date: "Sábado • 06/02",
    title: "Chegada das Caravanas & Abertura Oficial",
    description:
      "Check-in dos jovens, divisão em companhias, criação do estandarte, grito de guerra e a grande Sessão de Abertura.",
    highlights: ["Check-in nos Alojamentos", "Conhecendo sua Companhia", "Noite de Abertura FSY 2027"],
    tag: "Boas-Vindas",
  },
  {
    dayId: "dia2",
    name: "2º Dia",
    date: "Domingo • 07/02",
    title: "Dia do Senhor & Noite da Família",
    description:
      "Reunião Sacramental solene, estudo das escrituras, tempo de reflexão espiritual e dinâmicas da Noite da Família.",
    highlights: ["Reunião Sacramental", "Aulas do Evangelho", "Noite da Família com Companhias"],
    tag: "Espiritual",
  },
  {
    dayId: "dia3",
    name: "3º Dia",
    date: "Segunda • 08/02",
    title: "Gincanas, Dança & Noite dos Talentos",
    description:
      "Jogos cooperativos ao ar livre, aula de dança preparatória e a animada Noite de Variedades e Talentos da Juventude.",
    highlights: ["Jogos Cooperativos", "Ensaio de Dança", "Show de Variedades e Talentos"],
    tag: "Diversão & Arte",
  },
  {
    dayId: "dia4",
    name: "4º Dia",
    date: "Terça • 09/02",
    title: "Banquete, Baile & Reunião de Testemunho",
    description:
      "O ápice da sessão: almoço festivo, o tão esperado Baile do FSY e a profunda e inesquecível Reunião de Testemunho.",
    highlights: ["Banquete Festivo", "Baile Oficial FSY", "Reunião de Testemunho ao Pôr do Sol"],
    tag: "Inesquecível",
  },
  {
    dayId: "dia5",
    name: "5º Dia",
    date: "Quarta • 10/02",
    title: "Sessão de Encerramento & Despedidas",
    description:
      "Vídeo de recordações da sessão, devocional final, despedida das companhias e embarque de volta para casa firmes na fé.",
    highlights: ["Vídeo de Melhores Momentos", "Devocional de Despedida", "Retorno das Caravanas"],
    tag: "Legado",
  },
];

const FAQ_ITEMS = [
  {
    question: "O que é o FSY e quem pode participar?",
    answer:
      "O FSY (For the Strength of Youth / Para o Vigor da Juventude) é uma conferência de 5 dias repleta de atividades espirituais, sociais e recreativas para jovens de 14 a 18 anos, organizada para fortalecer a fé em Jesus Cristo em um ambiente alegre e seguro.",
  },
  {
    question: "O que devo levar na minha mala?",
    answer:
      "Roupas adequadas para atividades diárias, roupas para o domingo e para o baile, calçados confortáveis, itens de higiene pessoal, garrafa de água reutilizável, escrituras (físicas ou no aplicativo) e qualquer medicamento de uso contínuo (com receita/aviso prévio à equipe médica).",
  },
  {
    question: "Como funcionam as refeições e restrições alimentares?",
    answer:
      "Todas as refeições são servidas no refeitório oficial com cardápio balanceado e nutritivo. Nossa equipe multidisciplinar e médica acompanha restrições, alergias e celíacos cadastrados no sistema para garantir alimentação segura.",
  },
  {
    question: "Como fico sabendo da minha companhia e quarto?",
    answer:
      "Ao fazer login neste aplicativo oficial, assim que as companhias forem homologadas pela coordenação, seu cartão principal mostrará seu quarto, sua companhia, seus consultores e seus companheiros de equipe.",
  },
  {
    question: "Os pais podem acompanhar as fotos e novidades durante o evento?",
    answer:
      "Sim! A equipe de mídia fará cobertura diária no Instagram oficial (#FSYRibeirao2) e disponibilizará fotos em destaque no mural do evento para que famílias possam acompanhar os melhores momentos.",
  },
];

export function EventLandingPage() {
  const { profile } = useProfile();
  const shouldReduceMotion = useReducedMotion();

  // Active schedule tab
  const [selectedDayIndex, setSelectedDayIndex] = useState(1); // Default to Dia 1
  // Accordion active FAQ
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Countdown State
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    function calculateTimeLeft() {
      const now = new Date().getTime();
      const difference = EVENT_DATE.getTime() - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    }

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors selection:bg-[#FFE48A] selection:text-slate-900">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-[#FAF8F5]/90 dark:bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#007DA5] text-white shadow-sm transition-transform group-hover:scale-105">
              <FsyTempleMark className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                FSY 2027
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#007DA5] dark:text-[#7DE3F4]">
                Ribeirão Preto 2
              </span>
            </div>
          </Link>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            <a href="#o-evento" className="hover:text-[#007DA5] dark:hover:text-[#7DE3F4] transition-colors">
              O Evento
            </a>
            <a href="#experiencias" className="hover:text-[#007DA5] dark:hover:text-[#7DE3F4] transition-colors">
              Experiências
            </a>
            <a href="#programacao" className="hover:text-[#007DA5] dark:hover:text-[#7DE3F4] transition-colors">
              5 Dias
            </a>
            <a href="#faq" className="hover:text-[#007DA5] dark:hover:text-[#7DE3F4] transition-colors">
              Guia & FAQ
            </a>
          </nav>

          {/* Right Action & Theme */}
          <div className="flex items-center gap-3">
            <ThemeToggle />

            {profile ? (
              <Link
                href={
                  profile.role === "casal_diretor" || profile.role === "coordenador"
                    ? "/admin"
                    : profile.role === "consultor"
                    ? "/consultor"
                    : "/dashboard"
                }
              >
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-[#007DA5] px-3.5 py-2 text-xs font-black text-white shadow-sm hover:bg-[#005E7C] transition-colors"
                >
                  <Compass className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Meu Painel ({profile.full_name.split(" ")[0]})</span>
                  <span className="sm:hidden">Painel</span>
                </motion.div>
              </Link>
            ) : (
              <Link href="/login">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="flex items-center gap-2 rounded-xl bg-[#007DA5] px-4 py-2 text-xs font-black text-white shadow-sm hover:bg-[#005E7C] transition-colors"
                >
                  <span>Entrar</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </motion.div>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section id="o-evento" className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24">
        {/* Soft Background Radial Light Orbs */}
        <div className="absolute left-1/2 -top-24 -translate-x-1/2 h-96 w-[600px] rounded-full bg-gradient-to-b from-[#007DA5]/10 via-[#FFE48A]/15 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="mx-auto max-w-7xl px-4 sm:px-8 text-center">
          {/* Scripture Voice Badge */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 px-4 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 shadow-sm mb-6"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#DBBF6B]" />
            <span className="font-serif italic text-xs">Filipenses 4:4</span>
            <span className="text-slate-400">•</span>
            <span className="font-bold uppercase tracking-wider text-[11px] text-[#007DA5] dark:text-[#7DE3F4]">
              Tema Oficial 2027
            </span>
          </motion.div>

          {/* Main Title Lockup */}
          <motion.h1
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-950 dark:text-white leading-[1.1] max-w-4xl mx-auto"
          >
            Regozijai-vos em Cristo
          </motion.h1>

          <motion.p
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mt-4 text-base sm:text-lg md:text-xl font-medium text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            Conferência FSY 2027 • Sessão Ribeirão Preto 2. Cinco dias inesquecíveis de fé, amizades duradouras, música,
            dança e celebração da juventude.
          </motion.p>

          {/* Location & Date Pill */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-6 inline-flex flex-wrap items-center justify-center gap-3"
          >
            <div className="flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-900 px-4 py-2 text-xs font-black text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800 shadow-sm">
              <Calendar className="h-4 w-4 text-[#007DA5]" />
              <span>05 a 10 de Fevereiro de 2027</span>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-[#FFE48A] px-4 py-2 text-xs font-black text-slate-950 border border-amber-300 shadow-sm">
              <MapPin className="h-4 w-4 text-slate-950" />
              <span>Sessão Ribeirão Preto 2</span>
            </div>
          </motion.div>

          {/* 3. Interactive Countdown Bento Box */}
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            className="mt-10 mx-auto max-w-2xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm"
          >
            <div className="flex items-center justify-center gap-2 mb-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Clock className="h-3.5 w-3.5 text-[#FC4E6D]" />
              <span>Contagem Regressiva para o Início da Sessão</span>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-4">
              {/* Days */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[#FAF8F5] dark:bg-slate-800/70 p-3 sm:p-4 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-serif text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none">
                  {timeLeft.days}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                  Dias
                </span>
              </div>

              {/* Hours */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[#FAF8F5] dark:bg-slate-800/70 p-3 sm:p-4 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-serif text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none">
                  {String(timeLeft.hours).padStart(2, "0")}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                  Horas
                </span>
              </div>

              {/* Minutes */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[#FAF8F5] dark:bg-slate-800/70 p-3 sm:p-4 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-serif text-2xl sm:text-4xl font-black text-slate-900 dark:text-white leading-none">
                  {String(timeLeft.minutes).padStart(2, "0")}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                  Minutos
                </span>
              </div>

              {/* Seconds */}
              <div className="flex flex-col items-center justify-center rounded-2xl bg-[#FAF8F5] dark:bg-slate-800/70 p-3 sm:p-4 border border-slate-200/60 dark:border-slate-700/60">
                <span className="font-serif text-2xl sm:text-4xl font-black text-[#007DA5] dark:text-[#7DE3F4] leading-none">
                  {String(timeLeft.seconds).padStart(2, "0")}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                  Segundos
                </span>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/login" className="w-full sm:w-auto">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-[#007DA5] px-6 py-3.5 text-sm font-black text-white shadow-sm hover:bg-[#005E7C] transition-colors cursor-pointer"
                >
                  <span>Acessar Meu Painel</span>
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </Link>
              <a href="#programacao" className="w-full sm:w-auto">
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-6 py-3.5 text-sm font-black text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <Calendar className="h-4 w-4 text-[#007DA5]" />
                  <span>Ver os 5 Dias de Programação</span>
                </motion.div>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. Bento Grid Interativo: A Experiência FSY */}
      <section id="experiencias" className="py-16 md:py-24 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-wider text-[#007DA5] dark:text-[#7DE3F4]">
              Caixas de Experiência
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              O que faz o FSY ser inesquecível?
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Uma conferência planejada em cada detalhe para unir aprendizado do evangelho, companheirismo sadio e
              momentos de alegria genuína.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
            {/* Bento Card 1: Companhias (Grande - 8 cols) */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="md:col-span-8 rounded-3xl bg-gradient-to-br from-[#007DA5] to-[#005E7C] p-6 sm:p-8 text-white shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[260px]"
            >
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md border border-white/20 mb-4">
                  <Users className="h-3.5 w-3.5 text-[#FFE48A]" />
                  <span>Companhias & Consultores</span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Amizades que duram para sempre
                </h3>
                <p className="mt-2 text-sm sm:text-base text-cyan-50 max-w-xl leading-relaxed">
                  Cada jovem é designado para uma companhia liderada por um casal de consultores dedicados. Juntos criam
                  estandartes, gritos de guerra, compartilham metas diárias e tornam-se uma verdadeira família.
                </p>
              </div>

              <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
                <span className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-extrabold backdrop-blur-md">
                  🛡️ Estandartes Oficiais
                </span>
                <span className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-extrabold backdrop-blur-md">
                  ⚡ Grito de Guerra
                </span>
                <span className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-extrabold backdrop-blur-md">
                  🤝 Consultores Capacitados
                </span>
              </div>
            </motion.div>

            {/* Bento Card 2: Música e Baile (4 cols) */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="md:col-span-4 rounded-3xl bg-[#FFE48A] p-6 sm:p-8 text-slate-950 shadow-sm flex flex-col justify-between min-h-[260px]"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-1 text-xs font-black uppercase text-[#FFE48A] mb-4">
                  <Music2 className="h-3.5 w-3.5" />
                  <span>Música & Dança</span>
                </div>
                <h3 className="font-serif text-2xl font-bold tracking-tight text-slate-950">
                  Baile & Noite dos Talentos
                </h3>
                <p className="mt-2 text-xs sm:text-sm font-semibold text-slate-800 leading-relaxed">
                  Aulas de dança para todos os níveis, show de variedades com apresentações dos jovens e o aguardado
                  Baile Oficial FSY.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-950/10 flex items-center justify-between text-xs font-black">
                <span>Álbum Oficial 2027</span>
                <span className="rounded-full bg-slate-950 text-white px-2 py-0.5 text-[10px]">Filipenses 4:4</span>
              </div>
            </motion.div>

            {/* Bento Card 3: Espiritualidade (4 cols) */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="md:col-span-4 rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[240px]"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#FAF8F5] dark:bg-slate-800 px-3 py-1 text-xs font-black uppercase text-[#007DA5] dark:text-[#7DE3F4] border border-slate-200 dark:border-slate-700 mb-4">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Edificação Espiritual</span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Banquete no Evangelho
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Devocionais matinais e noturnos com oradores inspirados, estudo guiado das escrituras e a profunda
                  reunião de testemunhos.
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-black text-[#007DA5] dark:text-[#7DE3F4]">
                <CheckCircle2 className="h-4 w-4" />
                <span>Edificação individual e coletiva</span>
              </div>
            </motion.div>

            {/* Bento Card 4: Segurança & Saúde (4 cols) */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="md:col-span-4 rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between min-h-[240px]"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 px-3 py-1 text-xs font-black uppercase text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 mb-4">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Segurança 24 Horas</span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Equipe Médica no Local
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Atendimento médico de plantão durante os cinco dias, monitoramento confidencial de alergias severas e
                  apoio emocional dedicado.
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-black text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Prontuários e dietas monitoradas</span>
              </div>
            </motion.div>

            {/* Bento Card 5: Mural de Memórias & Redes (4 cols) */}
            <motion.div
              whileHover={shouldReduceMotion ? undefined : { y: -3 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="md:col-span-4 rounded-3xl bg-[#FC4E6D] p-6 sm:p-8 text-white shadow-sm flex flex-col justify-between min-h-[240px]"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-white mb-4 backdrop-blur-md">
                  <Camera className="h-3.5 w-3.5" />
                  <span>Mural de Memórias</span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-white">
                  #FSYRibeirao2
                </h3>
                <p className="mt-2 text-xs sm:text-sm text-pink-50 leading-relaxed">
                  Cobertura diária de fotos e vídeos pelos canais oficiais para registrar momentos memoráveis da
                  sessão.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs font-black">
                <span>Instagram Oficial</span>
                <span className="rounded-full bg-white text-[#FC4E6D] px-2 py-0.5 text-[10px]">Feed Ao Vivo</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 5. A Jornada dos 5 Dias (Timeline Interativa) */}
      <section id="programacao" className="py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="text-center max-w-3xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#007DA5] dark:text-[#7DE3F4]">
              Programação da Sessão
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              A Jornada de 5 Dias
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Cada dia possui um foco temático, momentos inspiradores e atividades dinâmicas desenhadas para transformar vidas.
            </p>
          </div>

          {/* Day Selector Tabs with Spatial Continuity */}
          <div className="flex items-center justify-start md:justify-center overflow-x-auto pb-4 gap-2 scrollbar-none">
            {DAYS_SCHEDULE.map((day, idx) => {
              const isSelected = selectedDayIndex === idx;
              return (
                <button
                  key={day.dayId}
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`relative z-10 flex flex-col items-center justify-center px-4 py-3 rounded-2xl min-w-[120px] transition-colors border ${
                    isSelected
                      ? "text-white border-transparent"
                      : "text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-400"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId={shouldReduceMotion ? undefined : "activeScheduleTab"}
                      className="absolute inset-0 bg-[#007DA5] rounded-2xl -z-10 shadow-sm"
                      transition={{ type: "spring", stiffness: 450, damping: 32 }}
                    />
                  )}
                  <span className="text-xs font-black uppercase tracking-wider">{day.name}</span>
                  <span className={`text-[10px] font-semibold mt-0.5 ${isSelected ? "text-cyan-100" : "text-slate-400"}`}>
                    {day.date.split("•")[1]?.trim() || day.date}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Day Detail Box */}
          <AnimatePresence mode="wait">
            <motion.div
              key={DAYS_SCHEDULE[selectedDayIndex].dayId}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-6 mx-auto max-w-4xl rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 px-2 py-0.5 text-xs font-black uppercase">
                      {DAYS_SCHEDULE[selectedDayIndex].tag}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {DAYS_SCHEDULE[selectedDayIndex].date}
                    </span>
                  </div>
                  <h3 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    {DAYS_SCHEDULE[selectedDayIndex].title}
                  </h3>
                </div>

                <Link href="/schedule">
                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#FAF8F5] dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-[#007DA5] dark:text-[#7DE3F4] border border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                  >
                    <span>Ver Grade de Horários</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </motion.div>
                </Link>
              </div>

              <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                {DAYS_SCHEDULE[selectedDayIndex].description}
              </p>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Destaques Programados:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {DAYS_SCHEDULE[selectedDayIndex].highlights.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-xl bg-[#FAF8F5] dark:bg-slate-800/70 p-3 border border-slate-200/60 dark:border-slate-700/60 text-xs font-bold text-slate-800 dark:text-slate-200"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#007DA5] dark:text-[#7DE3F4] shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* 6. FAQ Interativo Minimalista */}
      <section id="faq" className="py-16 md:py-24 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50">
        <div className="mx-auto max-w-4xl px-4 sm:px-8">
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#007DA5] dark:text-[#7DE3F4]">
              Tire Suas Dúvidas
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
              Perguntas Frequentes
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Orientações práticas para os jovens, pais e líderes antes do embarque.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#FAF8F5] dark:bg-slate-900 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-5 text-left text-sm sm:text-base font-bold text-slate-900 dark:text-white gap-4"
                  >
                    <span className="font-serif text-base sm:text-lg">{item.question}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 text-slate-500"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-800/80">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. Final Call to Action */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[#007DA5] via-[#01B6D1] to-[#005E7C] text-white text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-wider backdrop-blur-md mb-4">
            <Sparkles className="h-3.5 w-3.5 text-[#FFE48A]" />
            <span>Prepare o Seu Coração</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Pronto para viver o FSY 2027?
          </h2>
          <p className="mt-3 text-sm sm:text-base md:text-lg text-cyan-50 max-w-xl mx-auto leading-relaxed">
            Acesse o portal da sessão para conferir sua companhia, seus consultores, horários e interagir com seu grupo.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="w-full sm:w-auto">
              <motion.div
                whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-white text-slate-900 px-6 py-3.5 text-sm font-black shadow-md hover:bg-[#FFE48A] transition-colors cursor-pointer"
              >
                <span>Acessar Portal do Evento</span>
                <ArrowRight className="h-4 w-4" />
              </motion.div>
            </Link>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 py-10 text-xs text-slate-500 dark:text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FsyTempleMark className="h-5 w-5 text-[#007DA5]" />
            <span className="font-bold text-slate-700 dark:text-slate-300">
              FSY Sessão Ribeirão Preto 2 • 2027
            </span>
          </div>
          <p className="text-center sm:text-right font-serif italic text-slate-600 dark:text-slate-400">
            “Regozijai-vos sempre no Senhor; outra vez digo, regozijai-vos.” (Filipenses 4:4)
          </p>
        </div>
      </footer>
    </div>
  );
}
