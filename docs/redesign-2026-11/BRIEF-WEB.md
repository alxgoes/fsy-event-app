# Brief — Web app (Next.js) · continuação do redesign nov/2026

Repositório: `D:\Projects\PC\FSY\fsy-event-app` (branch `feat/redesign-simplificacao-2026-11`). Stack: Next 16, React 19, Tailwind 3, Supabase.

## Regras de convivência (obrigatórias)
- Edite **somente** `src/**`, `tests/**`, `supabase/migrations/**` e `docs/redesign-2026-11/**`. Outro agente edita `android/**` ao mesmo tempo.
- **Nenhum comando git de escrita** (commit, checkout, reset, stash, clean, restore). O orquestrador faz os commits.
- Não rode `next dev`/`next start` (o orquestrador usa um servidor de QA na porta 3117). Pode rodar `npm run lint`, `npm run typecheck`,
  `npm test` e, no fim, `npm run build`.
- Leia antes: `docs/redesign-2026-11/ESPECIFICACAO.md`, `DESIGN.md`, `AGENTS.md`. Interface 100 % pt-BR, alvos ≥ 44 px.

## O que já foi feito (não refazer)
- Navegação nova: `src/components/layout/Header.tsx` (topo enxuto + barra inferior Início · Agenda · Avisos · Mais, sino de novidades).
- Páginas novas: `/mais` (`src/components/profile/MorePage.tsx`, perfil estilo rede social + foto), `/fotos`.
- Início reescrito: `src/components/dashboard/YouthDashboard.tsx`. Avisos como feed: `src/app/announcements/page.tsx`.
  Agenda: `src/app/schedule/page.tsx`. Painel do consultor: `src/components/counselor/CounselorPanel.tsx` + `PhotoReviews.tsx`.
- Foto de perfil com aprovação: `src/types/profile-photo.ts`, `src/lib/profile-photo/*`, `src/app/api/profile/photo/**`,
  migração `supabase/migrations/202611020001_profile_photo_review.sql`.
- `CustomizableGrid` virou grade fixa (sem "Personalizar"). Sombras duras/bordas pretas neutralizadas nos tokens.
- Jovem em `/admin` ou `/consultor` vai para `/dashboard` (`src/proxy.ts`). `scheduleVisibleTo()` esconde `dia0` e categoria `Equipe` de jovens.

## Tarefas
1. **Bug de layout no celular (390 px)**: no Início o cartão azul "Momento do evento" e a coluna ficam mais largos que a tela (468 px em 375 px).
   Encontre a causa (provavelmente o SVG de arco absoluto/`w-auto` ou item de grid sem `min-w-0`) e corrija sem perder o arco decorativo.
2. **Gestão (`/admin/**`)**, sem mudar regras de permissão:
   - Uma só navegação: barra lateral (`AdminLayout.tsx`). Tirar os cartões duplicados de "Módulos de Gestão Rápida" de `ExecutiveDashboard.tsx`
     (fica só um resumo de números reais e atividade recente), tirar "Portal Jovem"/"Sair" duplicados (uma vez cada).
   - Um nome por módulo, igual na barra, no título e em qualquer cartão (ex.: "Saúde e inclusão", "Contas e acessos").
   - Remover jargão: "Supabase Live", "Salvo imediatamente no Supabase", banner de SQL Editor em `CounselorAuditManager.tsx`, "Dashboard",
     "Drive & Murais", "cache". Trocar por linguagem simples.
   - Ações destrutivas ("Limpar todo o histórico", "Sincronizar oficial" que sobrescreve a agenda) com confirmação clara do impacto.
   - Cores fora da paleta (#06D6A0, #FFD166, roxos #7209B7/purple-*) → paleta oficial do `tailwind.config.ts`/`DESIGN.md`.
     Números em Inter tabular (`fsy-figure`), nunca serifa; nada de `font-mono` em horários. Menos `font-black`; títulos em `font-heading`.
   - Telas sobrecarregadas (MedicalDashboard ~29 botões, MediaManager ~26): agrupar ações secundárias em menu "Mais ações", sem remover funcionalidades.
3. **Login (`src/app/login/page.tsx`)**: reduzir repetição (FSY aparece 3×, datas/local repetidos); manter Google + e-mail, cadastro e "Esqueci minha senha".
   Placeholder de estaca coerente com a região (não "Ribeirão Preto Leste").
4. **Id de companhia no lugar do nome**: procure qualquer lugar que ainda mostre `company_id` cru (gestão, saúde, avisos, `.toUpperCase()`)
   e mostre o nome; "DIA1" em `ScheduleManager.tsx` → "1º dia".
5. **Datas fixas no código**: usar `src/lib/event/identity.ts` (e constantes de datas) em vez de strings repetidas.
6. **Manifest**: `src/app/manifest.ts` — nome sem "2 2027" duplicado.
7. **Testes**: adicionar testes (padrão `tests/*.test.cjs` com `tests/helpers/route-harness.cjs` e `pg-harness.cjs`) para:
   - a migração de foto: jovem autenticado não consegue alterar `avatar_url`/`avatar_status` direto (trigger), service_role consegue;
   - rotas `/api/profile/photo` e `/reviews`: consultor só modera a própria companhia (404 para outra), jovem recebe 403 em reviews,
     recusa exige motivo, arquivo que não é imagem → 415.
   - `scheduleVisibleTo` esconde `dia0`/`Equipe` para jovem.
8. Rodar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Tudo verde.

## Entrega
Escreva `D:\Projects\PC\FSY\_trabalho\auditorias\RELATORIO-WEB.md` (até 600 palavras): o que mudou com arquivos, resultados honestos
de lint/typecheck/test/build, e o que ficou pendente.
