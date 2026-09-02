# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Jovens (Participantes):** Jovens de 14 a 18 anos vivenciando a conferência presencial de 5 dias. Precisam de acesso ágil à programação em tempo real, detalhes de sua companhia, quartos e comunicados importantes.
- **Consultores (Líderes de Companhia):** Jovens adultos que coordenam e apoiam suas companhias. Precisam de visão rápida dos jovens sob sua responsabilidade, alertas específicos e agenda das atividades.
- **Equipe Médica e Multidisciplinar:** Profissionais de saúde responsáveis pela integridade física e bem-estar dos participantes, com acesso estritamente confidencial a prontuários médicos, alergias graves, medicamentos contínuos e restrições alimentares.
- **Equipe de Logística e Transporte:** Coordenadores de embarques e desembarques dos ônibus por estaca, alojamentos e fluxo de materiais.
- **Coordenação e Casal Diretor:** Liderança geral responsável pela emissão de avisos urgentes e globais, acompanhamento da operação e supervisão completa do evento.

## Product Purpose

Centralizar e orquestrar todas as operações, comunicações e experiências dos 5 dias do evento FSY Sessão Ribeirão Preto 2 em uma aplicação web responsiva, rápida e confiável, conectando todos os participantes com seus respectivos níveis de acesso e privacidade.

## Positioning

Uma plataforma de evento sob medida para a Sessão Ribeirão Preto 2, que une a identidade visual acolhedora e reverente do tema oficial FSY 2027 ("Rejoice in Christ" / Filipenses 4:4) a uma arquitetura operacional robusta com controle de acesso rigoroso por perfil (RBAC), segurança médica estrita e sincronização em tempo real.

## Operating Context

Evento presencial de 5 dias em regime de retiro/acampamento. A maior parte dos acessos é feita em dispositivos móveis, em condições variadas de iluminação externa e conexão de rede, exigindo carregamento ultrarrápido, interface intuitiva para toques e alta legibilidade sob a luz do sol.

## Capabilities and Constraints

- **Stack Técnica:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion e Supabase (Auth, Postgres, RLS).
- **Controle de Acesso (RBAC):** Proteção rígida via middleware e RLS. Jovens não acessam painéis administrativos; prontuários médicos são blindados para uso exclusivo da equipe médica e direção.
- **Diretriz Institucional:** A aplicação atende à Sessão Ribeirão Preto 2 e nunca deve reivindicar ser o portal oficial global da Igreja.
- **Design Fiel ao Brand Guide:** Aplicação rigorosa das diretrizes de cores e tipografia oficiais de 2027, em modo claro de alto contraste, sem sombras projetadas ou gradientes no identificador/logo.

## Brand Commitments

- **Tema e Lema:** "REJOICE IN CHRIST" (Filipenses 4:4).
- **Cores Primárias Oficiais:** Neutral 5 (`#EFEFE7`), Parchment (`#F5EFCA`), Sunshine (`#FFE48A`), Yellow 10 (`#FFB81C`), Gold 10 (`#DBBF6B`), Gray 5 (`#E0E2E2`).
- **Cores Secundárias Oficiais:** Tons de Vermelho/Rosa (`#FDA192`, `#FC4E6D`), Laranja/Âmbar (`#F68D2E`, `#D45311`), Verde Lima/Folha (`#D3E952`, `#BED21E`, `#93C742`, `#6DB344`) e Azul Céu/Mar (`#B0EEFC`, `#7DE3F4`, `#01B6D1`, `#007DA5`).
- **Tipografia:** Estética clássica inspirada na família McKay, utilizando Cinzel (títulos display), Cormorant Garamond (subtítulos e destaques serifados) e Inter (corpo de texto e interface de dados).

## Evidence on Hand

- `docs/brand-guide-2027.md`: Guia completo de estilo visual oficial do tema 2027.
- `src/data/officialSchedule.ts`: Programação detalhada de cada um dos 5 dias de conferência com horários, categorias e locais.
- `supabase/schema.sql`: Modelagem completa de dados (perfis, companhias, prontuários, avisos, logística de ônibus) e políticas de RLS.
- `src/middleware.ts`: Regras de autorização e controle de rotas por papel de usuário.

## Product Principles

1. **Equilíbrio e Clareza Operacional:** Cada perfil de usuário (jovem, consultor, médico, coordenador) encontra instantaneamente o que precisa, sem ruído desnecessário.
2. **Reverência e Celebração Alegre:** A interface reflete o acolhimento, beleza e serenidade do tema espiritual de forma sofisticada e sem exageros ornamentais.
3. **Privacidade e Confidencialidade Absoluta:** Dados de saúde, fichas médicas e contatos de emergência possuem proteção irrestrita e acesso imediato em caso de necessidade.
4. **Resiliência Mobile-First:** Experiência pensada primariamente para smartphones, com navegação por polegar, contrastes fortes e feedback tátil em botões e avisos.

## Accessibility & Inclusion

- Contraste elevado em conformidade com WCAG AA para uso em ambientes externos e luz solar.
- Elementos táteis generosos para interação rápida em dispositivos móveis.
- Destaque claro e imediato para restrições alimentares e alergias severas, zelando pela segurança de todos os participantes.
