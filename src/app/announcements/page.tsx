"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Header } from "@/components/layout/Header";

interface YouthAnnouncement {
  id: string;
  title: string;
  content: string;
  priority: "urgente" | "importante" | "geral";
  target: string;
  author: string;
  category: string;
  timestamp: string;
}

const ANNOUNCEMENTS_FEED: YouthAnnouncement[] = [
  {
    id: "ann-1",
    title: "Mudança de Local: Ensaio Geral da Noite dos Talentos",
    content: "Atenção a todos os participantes inscritos na Noite dos Talentos: o ensaio das 17h foi transferido do Palco Externo para o Auditório Master climatizado devido ao calor intenso.",
    priority: "urgente",
    target: "Todas as Companhias",
    author: "Coordenação Geral",
    category: "Programação",
    timestamp: "Há 25 minutos",
  },
  {
    id: "ann-2",
    title: "Hidratação Obrigatória & Garrafinhas na Gincana",
    content: "Lembrem-se de abastecer suas garrafas nos bebedouros do Bloco B antes de descer para o campo. Teremos pontos de frutas após a prova da esteira!",
    priority: "importante",
    target: "Todas as Companhias",
    author: "Equipe Médica & Nutrição",
    category: "Saúde",
    timestamp: "Há 2 horas",
  },
  {
    id: "ann-3",
    title: "Companhia 4 (Alma): Reunião Rápida com Consultores",
    content: "Jovens da Cia 4, favor se reunirem na arquibancada do ginásio às 13h15 para alinhamento dos gritos de guerra com o Lucas e a Bia.",
    priority: "geral",
    target: "Cia 4 - Alma",
    author: "Consultores da Cia 4",
    category: "Companhia",
    timestamp: "Hoje às 11:30",
  },
  {
    id: "ann-4",
    title: "Tema da Roupa para o Grande Baile de Sexta",
    content: "Preparem seus trajes no padrão FSY para o baile de amanhã! Teremos cabine de fotos e DJ com a playlist oficial aprovada.",
    priority: "geral",
    target: "Todas as Companhias",
    author: "Casal Diretor da Sessão",
    category: "Baile",
    timestamp: "Ontem",
  },
];

export default function AnnouncementsPage() {
  const [filter, setFilter] = useState<"todas" | "minha_cia" | "urgentes">("todas");

  const filteredAnnouncements = ANNOUNCEMENTS_FEED.filter((a) => {
    if (filter === "urgentes") return a.priority === "urgente";
    if (filter === "minha_cia") return a.target.includes("Cia 4");
    return true;
  });

  return (
    <div className="min-h-screen bg-fsy-watermark text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header />

      <main className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-2xl bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-black text-slate-900 dark:text-white border-2 border-slate-900 dark:border-slate-700 shadow-brutal-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar ao Início</span>
          </Link>

          <div className="inline-flex items-center gap-2 rounded-2xl bg-[#FF6B8B] text-white px-3.5 py-1.5 text-xs font-black border-2 border-slate-900 shadow-brutal-sm">
            <Megaphone className="h-4 w-4" />
            <span>Mural de Comunicados</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setFilter("todas")}
            className={`px-4 py-2 rounded-2xl text-xs font-black border-2 border-slate-900 transition-all ${
              filter === "todas"
                ? "bg-[#4361EE] text-white shadow-brutal-md"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-brutal-sm hover:bg-slate-50"
            }`}
          >
            Todos os Comunicados
          </button>

          <button
            onClick={() => setFilter("minha_cia")}
            className={`px-4 py-2 rounded-2xl text-xs font-black border-2 border-slate-900 transition-all ${
              filter === "minha_cia"
                ? "bg-[#FFD166] text-slate-950 shadow-brutal-md"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-brutal-sm hover:bg-slate-50"
            }`}
          >
            Minha Cia (Cia 4)
          </button>

          <button
            onClick={() => setFilter("urgentes")}
            className={`px-4 py-2 rounded-2xl text-xs font-black border-2 border-slate-900 transition-all ${
              filter === "urgentes"
                ? "bg-[#FF6B8B] text-white shadow-brutal-md"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-brutal-sm hover:bg-slate-50"
            }`}
          >
            Avisos Urgentes
          </button>
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          {filteredAnnouncements.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl border-2 border-slate-900 dark:border-slate-700 p-5 shadow-brutal-md transition-all ${
                item.priority === "urgente"
                  ? "bg-rose-50 dark:bg-rose-950/70 text-slate-900 dark:text-slate-100"
                  : "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-xl px-2.5 py-0.5 text-[10px] font-black uppercase border-2 border-slate-900 ${
                      item.priority === "urgente"
                        ? "bg-[#FF6B8B] text-white animate-pulse"
                        : item.priority === "importante"
                        ? "bg-[#FFD166] text-slate-950"
                        : "bg-[#4361EE] text-white"
                    }`}
                  >
                    {item.priority}
                  </span>

                  <span className="rounded-xl bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-black text-slate-700 dark:text-slate-300 border border-slate-900">
                    {item.category}
                  </span>

                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {item.timestamp}
                  </span>
                </div>

                <span className="text-xs font-black text-[#4361EE] dark:text-blue-400">
                  Para: {item.target}
                </span>
              </div>

              <h3 className="font-heading text-lg sm:text-xl font-black leading-tight mb-2">
                {item.title}
              </h3>

              <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-95">
                {item.content}
              </p>

              <div className="mt-4 pt-3 border-t-2 border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <span>Emitido por: <strong className="text-slate-900 dark:text-white">{item.author}</strong></span>
                <span>Sessão RP 2</span>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
