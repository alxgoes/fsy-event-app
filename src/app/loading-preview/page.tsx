"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { VoluteLoader } from "@/components/ui/VoluteLoader";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Play, Sparkles, RefreshCw, CheckCircle2, Shield, Calendar, Users, Music2, FolderOpen, Camera, AlertCircle } from "lucide-react";
import { GooeyButton } from "@/components/ui/GooeyButton";
import { GooeyPillTabs } from "@/components/ui/GooeyPillTabs";
import { SuccessCheck, ShakeBox } from "@/components/ui/TransitionsMicro";

export default function LoadingPreviewPage() {
  const [size, setSize] = useState<number>(96);
  const [rate, setRate] = useState<number>(1);
  const [variant, setVariant] = useState<"default" | "brand" | "gold">("default");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [readyContentVisible, setReadyContentVisible] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("Todas");
  const [testShake, setTestShake] = useState<number>(0);
  const [testSuccess, setTestSuccess] = useState<boolean>(false);

  const handleSimulateLoad = () => {
    setIsSimulating(true);
    setReadyContentVisible(false);

    // Simulate real network fetch and data synchronization
    setTimeout(() => {
      setIsSimulating(false);
      setReadyContentVisible(true);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-fsy-watermark text-slate-900 dark:text-slate-100 p-4 sm:p-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Bar */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white/90 dark:bg-slate-900/90 border-2 border-slate-900/10 dark:border-slate-800 shadow-lg backdrop-blur-md">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[#FFE48A] px-2 py-0.5 text-xs font-black text-amber-950 uppercase border border-amber-400">
                FSY 2027
              </span>
              <h1 className="text-xl sm:text-2xl font-black font-heading tracking-tight text-slate-900 dark:text-white">
                Showcase & Teste do Novo Loading
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
              Animação de Volute SVG com traço dinâmico e rotação contínua (versões Light #131316 e Dark #f5f5f7).
            </p>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <ThemeToggle />
            <button
              onClick={handleSimulateLoad}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#007DA5] hover:bg-[#005E7C] text-white font-black text-xs shadow-md transition-all cursor-pointer"
            >
              <Play className="h-4 w-4" />
              <span>Simular Abertura</span>
            </button>
          </div>
        </header>

        {/* Interactive Controls & Live Demos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Controls Card */}
          <div className="md:col-span-4 rounded-3xl bg-white/90 dark:bg-slate-900/90 border-2 border-slate-900/10 dark:border-slate-800 p-6 shadow-md backdrop-blur-md space-y-5">
            <h2 className="font-heading text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#007DA5]" />
              Controles Interativos
            </h2>

            {/* Size Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Tamanho do Ícone</span>
                <span className="text-[#007DA5] font-black">{size}px</span>
              </div>
              <input
                type="range"
                min="24"
                max="140"
                step="4"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full cursor-pointer accent-[#007DA5]"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>24px (inline)</span>
                <span>64px (médio)</span>
                <span>96px (destaque)</span>
                <span>140px</span>
              </div>
            </div>

            {/* Speed Multiplier */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span>Taxa de Velocidade (--rate)</span>
                <span className="text-[#007DA5] font-black">{rate}x</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[0.5, 0.8, 1, 1.5].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRate(r)}
                    className={`py-1.5 rounded-xl text-xs font-black transition-all ${
                      rate === r
                        ? "bg-[#007DA5] text-white shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* Color Palette Variant */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Variante Cromática
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setVariant("default")}
                  className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                    variant === "default"
                      ? "border-[#007DA5] bg-[#007DA5]/10 text-[#007DA5]"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  Padrão (Tema)
                </button>
                <button
                  onClick={() => setVariant("brand")}
                  className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                    variant === "brand"
                      ? "border-[#007DA5] bg-[#007DA5]/10 text-[#007DA5]"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  Azul FSY
                </button>
                <button
                  onClick={() => setVariant("gold")}
                  className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                    variant === "gold"
                      ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  Dourado
                </button>
              </div>
            </div>

            {/* Simulation button */}
            <button
              onClick={handleSimulateLoad}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Simular Ready Check FSY</span>
            </button>
          </div>

          {/* Direct Visual Preview Panels */}
          <div className="md:col-span-8 space-y-6">
            {/* Embedded LoadingScreen Showcase */}
            <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border-2 border-slate-900/10 dark:border-slate-800 p-6 shadow-md backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Visualização do LoadingScreen Integrado
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  Responsivo & Acessível
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden p-6 bg-slate-50 dark:bg-slate-950 flex items-center justify-center min-h-[360px]">
                <LoadingScreen
                  fullScreen={false}
                  loaderSize={size}
                  rate={rate}
                  variant={variant}
                  title="Preparando o FSY 2027"
                  message="Sincronizando atividades, comunicados e companhia..."
                  submessage="Verificando dados da sua sessão em tempo real"
                />
              </div>
            </div>

            {/* Scale Comparison Card */}
            <div className="rounded-3xl bg-white/90 dark:bg-slate-900/90 border-2 border-slate-900/10 dark:border-slate-800 p-6 shadow-md backdrop-blur-md">
              <h3 className="font-heading text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider mb-4">
                Comportamento em Escalas (24px, 48px, 64px, 96px)
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <VoluteLoader size={24} rate={rate} variant={variant} />
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400">24px (Botão/Tag)</span>
                </div>

                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <VoluteLoader size={48} rate={rate} variant={variant} />
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400">48px (Card)</span>
                </div>

                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <VoluteLoader size={64} rate={rate} variant={variant} />
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400">64px (Painel)</span>
                </div>

                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <VoluteLoader size={96} rate={rate} variant={variant} />
                  <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400">96px (Tela Cheia)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ready Check Simulation Modal */}
        <AnimatePresence>
          {isSimulating && (
            <LoadingScreen
              key="simulation-screen"
              fullScreen={true}
              rate={rate}
              variant={variant}
              title="Simulação: Sincronizando o FSY"
              message="Verificando perfil, companhia, cronograma e fotos..."
              submessage="A tela só será aberta após todos os módulos estarem prontos"
            />
          )}
        </AnimatePresence>

        {/* Result of Simulation (Demonstrating Instant Full-Data Render) */}
        {readyContentVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/40 p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="font-heading text-lg font-black text-emerald-950 dark:text-emerald-200">
                  Ready Check Concluído com Sucesso!
                </h3>
                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Todo o conteúdo foi validado antes da renderização. Zero itens pipocando ou saltos no layout!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 shadow-sm flex items-center gap-3">
                <Users className="h-5 w-5 text-[#007DA5]" />
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">Companhia</p>
                  <p className="text-xs font-bold text-slate-500">100% Sincronizada</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 shadow-sm flex items-center gap-3">
                <Calendar className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">Cronograma</p>
                  <p className="text-xs font-bold text-slate-500">Pronto para Exibição</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 shadow-sm flex items-center gap-3">
                <Shield className="h-5 w-5 text-pink-500" />
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">Permissões</p>
                  <p className="text-xs font-bold text-slate-500">Validadas no Contexto</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ================================================================= */}
        {/* NEW SHOWCASE: LIQUID GOOEY & TACTILE PILL BUTTONS (USER REQUEST) */}
        {/* ================================================================= */}
        <section className="p-6 sm:p-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 border-2 border-slate-900/10 dark:border-slate-800 shadow-xl backdrop-blur-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#007DA5]/10 text-[#007DA5] dark:text-cyan-400 border border-[#007DA5]/20 px-2.5 py-0.5 text-xs font-black uppercase">
                  Liquid Gooey + Neo-Brutal
                </span>
                <h2 className="text-lg sm:text-xl font-black font-heading tracking-tight text-slate-900 dark:text-white">
                  Botões Cápsula Táteis & Transições Líquidas
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                Mescla do estilo do site (cápsula da foto em anexo) com as físicas elásticas de Liquid Gooey e micro-transições do Transitions.dev.
              </p>
            </div>

            <GooeyButton
              href="/admin/media"
              variant="primary"
              size="sm"
              icon={<Camera className="h-4 w-4" />}
              iconColor="text-white"
            >
              Testar Galeria de Mídia
            </GooeyButton>
          </div>

          {/* 1. Exact button from user's attached photo */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              1. Botão Exato da Foto Enviada (Fundo Escuro, Borda Sólida, Sombra Tátil & Ícone Neon)
            </p>
            <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-center gap-4">
              <GooeyButton
                variant="tactile-dark"
                icon={<Music2 className="h-4 w-4" />}
                iconColor="text-[#FC4E6D]"
                onClick={() => alert("Interação de clique com física de mola elástica (Gooey)! ✨")}
              >
                Hino e Álbum da Juventude 2027
              </GooeyButton>
            </div>
          </div>

          {/* 2. Palette Variants respecting FSY 2027 */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              2. Variantes de Cores Oficiais FSY 2027
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
              <GooeyButton
                variant="primary"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                iconColor="text-white"
              >
                Azul FSY (#007DA5)
              </GooeyButton>

              <GooeyButton
                variant="gold"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                iconColor="text-amber-900"
              >
                Ouro FSY (#FFE48A)
              </GooeyButton>

              <GooeyButton
                variant="coral"
                size="sm"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                iconColor="text-white"
              >
                Coral Neon (#FC4E6D)
              </GooeyButton>

              <GooeyButton
                variant="outline"
                size="sm"
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                iconColor="text-[#007DA5]"
              >
                Contorno Tátil
              </GooeyButton>

              <GooeyButton
                variant="tactile-dark"
                size="sm"
                icon={<FolderOpen className="h-3.5 w-3.5" />}
                iconColor="text-cyan-400"
              >
                Pasta Google Drive
              </GooeyButton>
            </div>
          </div>

          {/* 3. Liquid Gooey Pill Tabs (P13 Transitions.dev) */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              3. Barra de Abas Líquida (GooeyPillTabs — P13 do Transitions.dev com Borracha Elástica)
            </p>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
              <GooeyPillTabs
                tabs={[
                  { id: "Todas", label: "Todas", count: 48 },
                  { id: "Espirituais", label: "Espirituais", count: 12 },
                  { id: "Companhias", label: "Companhias", count: 18 },
                  { id: "Bailes", label: "Bailes", count: 10 },
                  { id: "Geral", label: "Geral", count: 8 },
                ]}
                activeTab={activeTab}
                onChange={(tab) => setActiveTab(tab)}
                variant="brand"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aba selecionada no momento: <strong className="text-slate-900 dark:text-white">{activeTab}</strong>. Note como o indicador desliza com amortecimento de mola líquida.
              </p>
            </div>
          </div>

          {/* 4. Micro-transitions: P10 (Success Check) & P12 (Shake on Error) */}
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
              4. Micro-transições do Transitions.dev (P10 Success Check & P12 Error Shake)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Test Shake */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">P12 — Tremor Físico ao Errar Campo:</p>
                <ShakeBox shakeTrigger={testShake}>
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border-2 border-red-400 text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Link do Google Drive inválido ou não preenchido!</span>
                  </div>
                </ShakeBox>
                <GooeyButton
                  variant="coral"
                  size="sm"
                  onClick={() => setTestShake((c) => c + 1)}
                >
                  Disparar Tremor (P12)
                </GooeyButton>
              </div>

              {/* Test Success Check */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">P10 — Traçado Vetorial com Salto Suave:</p>
                <div className="min-h-[42px] flex items-center">
                  {testSuccess ? (
                    <SuccessCheck label="Foto publicada e sincronizada!" />
                  ) : (
                    <span className="text-xs text-slate-400">Clique no botão abaixo para simular o sucesso.</span>
                  )}
                </div>
                <GooeyButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTestSuccess(false);
                    setTimeout(() => setTestSuccess(true), 100);
                  }}
                >
                  Desenhar Check de Sucesso (P10)
                </GooeyButton>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
