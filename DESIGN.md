---
name: FSY Sessão Ribeirão Preto 2
description: Sistema de design oficial FSY 2027 "Rejoice in Christ" para a Sessão Ribeirão Preto 2
colors:
  primary: "#007DA5"
  primary-hover: "#005E7C"
  secondary: "#FFE48A"
  accent: "#FC4E6D"
  success: "#93C742"
  destructive: "#D45311"
  neutral-bg: "#FAF8F5"
  neutral-surface: "#FFFFFF"
  neutral-parchment: "#F5EFCA"
  neutral-text: "#0F172A"
  neutral-muted: "#64748B"
  gold-temple: "#DBBF6B"
typography:
  display:
    fontFamily: "Cinzel, Cormorant Garamond, serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Cinzel, Cormorant Garamond, serif"
    fontSize: "clamp(1.5rem, 3.5vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.05em"
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
  micro:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  card-base:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.2xl}"
    padding: "20px"
---

# Design System: FSY Sessão Ribeirão Preto 2

## Overview

**Creative North Star: "A Flâmula da Juventude"**

O sistema de design do FSY Sessão Ribeirão Preto 2 traduz o tema oficial da juventude para 2027, *"Rejoice in Christ"* (Filipenses 4:4), em uma experiência digital acolhedora, vibrante e funcional. Inspirado nas flâmulas históricas de eventos e na arquitetura sagrada do templo, o sistema equilibra a solenidade serena de proporções clássicas com o entusiasmo juvenil de uma conferência de cinco dias repleta de aprendizado, música e companheirismo.

A interface rejeita deliberadamente o visual frio e asséptico de dashboards corporativos cinzas, assim como sombras pesadas ou estéticas carregadas. Em seu lugar, emprega uma atmosfera banhada em tons de pergaminho (*Parchment* e *Neutral 5*), toques quentes de sol (*Sunshine*), tipografia serifada nobre nos títulos e contrastes nítidos de leitura que garantem acessibilidade plena sob a luz natural do dia.

**Key Characteristics:**
- **Calor Solar & Serenidade:** Fundos suaves com textura sutil e toques de luz que transmitem acolhimento e celebração.
- **Tipografia Nobre com Clareza:** Títulos que ecoam a dignidade do tema (*Cinzel* e *Cormorant Garamond*) combinados com a legibilidade cristalina de *Inter* para dados e horários.
- **Camadas Flutuantes Táteis:** Superfícies elevadas com suavidade, cantos amigáveis e feedback imediato de toque para uso ágil em celulares.
- **Selos Gráficos e Badges 2027:** Uso intencional dos selos e adesivos temáticos para identificar categorias, status e prioridades sem sobrecarregar a visão.

## Colors

A paleta é orientada pelo Guia Oficial FSY 2027, estruturada para oferecer contraste excelente e hierarquia sem confusão cromática.

### Primary
- **Azul Índigo Oceânico** (`#007DA5` / Blue 25): Cor de autoridade e confiança. Utilizada em ações primárias, botões de comando principal, realces do cabeçalho e elementos institucionais chave.

### Secondary
- **Ouro Solar Radiante** (`#FFE48A` / Sunshine): Tom acolhedor e iluminador. Utilizado em badges de destaque, seleções, cartões de companhia e acentos comemorativos.

### Tertiary
- **Coral Vivo Festivo** (`#FC4E6D` / Red 10): Cor de energia e vibração. Utilizada em notificações ativas, alertas de urgência, corações de interação e selos temáticos da juventude.

### Neutral
- **Fundo Pergaminho Quente** (`#F5EFCA` / Parchment & `#FAF8F5`): Superfície base das telas, gerando conforto visual superior ao branco puro e reforçando a sensação tátil de papel editorial.
- **Branco Puro** (`#FFFFFF`): Utilizado exclusivamente para cartões, superfícies elevadas e diálogos para garantir destaque sobre o fundo quente.
- **Grafite Nobre** (`#0F172A` / `#1E293B`): Texto principal, ícones de navegação e linhas estruturais de alto contraste.
- **Cinza Templo** (`#E0E2E2` / Gray 5): Fundo de ícones, divisores sutis e detalhes arquitetônicos.
- **Ouro do Templo** (`#DBBF6B` / Gold 10): Exclusivo para detalhes da estátua do Morôni, portal do templo e insígnias cerimoniais.

### Named Rules
**The No-Shadow-On-Brand Rule.** O identificador, o arco do templo e a tipografia "Rejoice in Christ" nunca devem receber sombras projetadas (*drop shadow*) nem gradientes. A marca vive sempre limpa sobre fundo neutro ou claro.

**The Daylight Contrast Rule.** Todo texto ou dado operacional deve atingir conformidade WCAG AA sobre sua superfície imediata, assegurando leitura perfeita em smartphones sob sol aberto.

## Typography

**Display Font:** Cinzel / Cormorant Garamond (fallback: Georgia, serif)  
**Body Font:** Inter (fallback: system-ui, -apple-system, sans-serif)  
**Label/Mono Font:** Inter Bold com tracking expandido  

**Character:** Um diálogo harmônico entre o passado clássico e a funcionalidade contemporânea. A tipografia serifada traz o peso reverente de escrituras e monumentos, enquanto a sans-serif contemporânea entrega ritmo ágil e densidade para listas de horários e cadastros.

### Hierarchy
- **Display** (Bold 700, `clamp(2rem, 5vw, 3rem)`, `line-height: 1.15`, `letter-spacing: -0.02em`): Manchetes de boas-vindas, versículos lema e aberturas de tela.
- **Headline** (Bold 700, `clamp(1.5rem, 3.5vw, 2rem)`, `line-height: 1.2`): Títulos de seções principais, nomes de companhias e títulos de módulos.
- **Title** (SemiBold 600, `1.125rem` / 18px, `line-height: 1.35`): Nomes de eventos na programação, títulos de avisos e cartões de alerta.
- **Body** (Regular 400, `0.875rem` / 14px, `line-height: 1.5`): Descrições de atividades, prontuários, comunicados e textos de apoio (comprimento ideal: 55–70 caracteres por linha).
- **Label** (Bold 700, `0.75rem` / 12px, `letter-spacing: 0.05em`, Caixa Alta): Badges de status, dias da semana, horários, categorias e tags de papel.

### Named Rules
**The Scripture Voice Rule.** Passagens bíblicas e citações temáticas utilizam Cormorant Garamond com proporções elegantes e subtis, nunca fontes sans-serif genéricas.

## Layout

O layout segue um grid flexível de 12 colunas no desktop, convertendo-se em uma coluna única estrita e ergonômica no mobile.

- **Espaçamento e Ritmo:** Base modular de 4px e 8px (`gap-4` / 16px no mobile; `gap-6` / 24px no desktop).
- **Contêiner Central:** Largura máxima de 1280px (`max-w-7xl`), centralizado com recuo horizontal de 16px (`px-4`) em smartphones e 32px (`px-8`) em computadores.
- **Thumb-Zone Navigation:** Ações críticas, botões de confirmação e abas de alternância de dias ficam posicionados na zona natural de alcance do polegar.
- **Sticky App Bar:** Cabeçalho fixo com leve desfoque de fundo (`backdrop-blur-md`), mantendo a identidade, o alternador de temas e o sino de notificações sempre acessíveis.

## Elevation & Depth

O sistema utiliza a filosofia de **Camadas Flutuantes**: superfícies limpas e leves, sem sombras pretas duras ou traços pesados de brutalismo escuro. A profundidade é comunicada através de desfoques suaves, bordas de 1px em tons neutros claros e elevação sutil em repouso.

### Shadow Vocabulary
- **Camada Sutil** (`box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)`): Cartões em repouso e divisores de seção.
- **Camada Flutuante** (`box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`): Cartões ativos, modais de diálogo, popovers de notificações e cards de destaque ("Acontecendo Agora").
- **Realce de Toque** (`box-shadow: 0 4px 14px 0 rgba(0, 125, 165, 0.25)`): Botões primários em foco ou hover, criando uma aura luminosa no tom azul oficial.

### Named Rules
**The Soft Flight Rule.** Elementos interativos levitam sutilmente no hover ou foco (translação de -2px no eixo Y), reforçando a sensação tátil sem rigidez.

## Shapes

- **Cantos Arredondados Amigáveis:**
  - Cartões mestres e contêineres: `rounded-2xl` (24px) ou `rounded-3xl` (32px), criando uma silhueta calorosa e acolhedora.
  - Botões e campos de entrada: `rounded-lg` (12px) a `rounded-xl` (16px).
  - Badges, pílulas e seletores: `rounded-full` (formato cápsula).
- **Moldura em Arco (*Arch Frame*):** Inspirada no arco arquitetônico do templo do logo 2027, a forma arqueada é reutilizada em cartazes, avatares temáticos e headers de cartões cerimoniais.

## Components

### Buttons
- **Shape:** Cantos arredondados de 12px (`rounded-lg`), altura confortável para toque (mínimo de 36px no desktop, 44px em alvos móveis).
- **Primary:** Fundo Azul Oceânico (`#007DA5`), texto branco, peso semibold. Hover com escurecimento suave (`#005E7C`) e aura azul sutil.
- **Secondary:** Fundo Ouro Solar (`#FFE48A`), texto preto grafite (`#0F172A`).
- **Outline / Ghost:** Fundo transparente com borda de 1px neutra e hover em fundo pergaminho.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (24px) com borda refinada de 1px (`border-slate-200/80` no modo claro).
- **Background:** Branco puro (`#FFFFFF`) para criar contraste luminoso sobre a base de pergaminho (`#FAF8F5`).
- **Internal Padding:** 20px a 24px (`p-5` ou `p-6`).

### Badges & Stickers
- **Pílulas de Status:** Formato cápsula de 20px de altura com tipografia compacta de 10px a 11px em negrito caixa alta.
- **Estilo Adesivo Oficial:** Badges inspirados nos 8 selos oficiais (amarelo solar, oval rosa, flâmula azul, carimbo verde de alimentação/saúde).

### Inputs / Fields
- **Style:** Altura de 40px, fundo branco ou neutro suave, borda de 1px (`#CBD5E1`), cantos de 12px.
- **Focus:** Anel de foco suave em Azul Oceânico (`ring-3 ring-primary/20`) e borda primária.

### Navigation & Header
- Barra superior modular adesiva (`sticky top-0`) com acesso direto ao perfil, notificações e alternância de temas.

## Do's and Don'ts

### Do:
- **Do** manter a paleta base em tons quentes de pergaminho (`#FAF8F5` / `#F5EFCA`) com cartões brancos e texto em grafite de alto contraste.
- **Do** reservar o tom Gold 10 (`#DBBF6B`) estritamente para elementos do templo, ícones sagrados e coroamentos honoríficos.
- **Do** priorizar a legibilidade móvel com alvos de toque de pelo menos 44x44px.
- **Do** aplicar animações fluidas com Framer Motion (transições de primavera com amortecimento de 24).
- **Do** incluir indicações imediatas de restrições alimentares e alergias severas nos cards da equipe médica e consultores.

### Don't:
- **Don't** aplicar gradientes ou sombras projetadas (*drop shadows*) na marca oficial do FSY, no templo ou na tipografia "Rejoice in Christ".
- **Don't** utilizar fundos cinzas frios ou paletas genéricas corporativas de dashboards convencionais.
- **Don't** inventar selos ou alterar as proporções do arco do templo.
- **Don't** inserir avisos ou disclaimers declarando que a aplicação é o site institucional geral da Igreja.
- **Don't** quebrar a proteção de dados: prontuários e alergias confidenciais nunca devem ser expostos fora da equipe autorizada.
