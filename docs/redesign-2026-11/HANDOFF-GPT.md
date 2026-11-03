# Passagem para o GPT — FSY Sessão Ribeirão Preto 2 · redesign nov/2026

Você vai **terminar** um trabalho já quase pronto. Leia este arquivo inteiro antes de agir.
Orquestração anterior: Claude (planejamento, revisão) + Codex (execução). Data desta passagem: 02/11/2026.

## 1. Onde está tudo
- Repositório: `D:\Projects\PC\FSY\fsy-event-app` — GitHub `alxgoes/fsy-event-app`.
- Branch de trabalho: **`feat/redesign-simplificacao-2026-11`** (criada a partir de `feat/android-inscricoes-2027`, que está 6 commits à frente de `main`).
- **Nada foi commitado ainda.** Todo o trabalho está no working tree desta branch.
- Pasta de trabalho fora do repo: `D:\Projects\PC\FSY\_trabalho\` (logs, capturas, auditorias, `ESTADO-ORQUESTRACAO.md`).
- Ferramentas: `D:\Projects\PC\FSY\_ferramentas\` (Android SDK em `android-sdk\`, cache Gradle em `gradle-home\`, `qa-dev.cjs`).
- Leia também: `docs/redesign-2026-11/ESPECIFICACAO.md` (decisões do responsável), `BRIEF-WEB.md`, `BRIEF-ANDROID.md`,
  `BRIEF-INSCRICOES.md`, `RELATORIO-WEB.md`, `RELATORIO-INSCRICOES.md`, `CONTRATO-AJUSTES-INSCRICOES.md`, `DESIGN.md`, `AGENTS.md`.

## 2. Regras que não podem ser quebradas
1. **Planilha de inscrições = dados pessoais de menores.** A planilha oficial fica fora do repo (pasta Downloads do usuário).
   Nunca a copie para o repositório, nunca a envie a serviços externos, nunca imprima nomes/CPF/RG/telefones em logs.
   Para desenvolver e testar, use só `tests/fixtures/inscricoes-2027-sintetica.xlsx` (fictícia). O `.gitignore` bloqueia `*.xlsx/*.xls/*.csv`
   exceto `tests/fixtures/*-sintetica.xlsx` — **não altere isso**. Antes de cada commit rode `git status` e confirme que nenhuma planilha/PDF real entrou.
2. **Jovem nunca vê que existe gestão/consultor**: nenhum menu, botão, texto, módulo, atividade interna ("Equipe" / dia 0) ou página de "acesso negado".
   Jovem que abre `/admin` ou `/consultor` cai em `/dashboard` (`src/proxy.ts`). No Android, idem.
3. Interface 100 % pt-BR, sem jargão técnico. Alvos de toque ≥ 44 px (web) / 48 dp (Android). `DESIGN.md` é a autoridade visual.
4. Não publicar em produção (Vercel / APK distribuído / migrações) sem o "ok" explícito do responsável em cada etapa.
5. Logística continua com acesso a Saúde/inclusão (decisão do responsável em 02/11/2026). Não mude permissões.

## 3. O que já está pronto (verificado)
**Web (Next.js 16)** — lint, typecheck, **197 testes** e `npm run build` aprovados (o build foi rodado fora do sandbox).
- Navegação nova: topo enxuto + barra inferior **Início · Agenda · Avisos · Mais** (`src/components/layout/Header.tsx`).
- Início reescrito (`YouthDashboard.tsx`): cartão "Agora / A seguir" vivo, agenda do dia, minha companhia, 2 avisos, faixa de fotos.
- Avisos em formato de feed social com curtida animada; Agenda abre no dia atual; páginas novas `/mais` e `/fotos`.
- **Foto de perfil com aprovação do consultor**: API `src/app/api/profile/photo/**`, contrato `src/types/profile-photo.ts`,
  migração `supabase/migrations/202611020001_profile_photo_review.sql` (bucket privado `profile-photos`, trigger impede o usuário de trocar a foto direto).
- Painel do consultor reescrito com "Fotos para aprovar" (`src/components/counselor/CounselorPanel.tsx`, `PhotoReviews.tsx`).
- Gestão simplificada (uma navegação, nomes consistentes, sem jargão, "Mais ações"), login enxuto, sem "Personalizar" em nenhuma tela.
- **Inscrições/autorizações**: importador tolerante (cabeçalho AC com redação nova, duplicatas resolvidas pela inscrição aprovada mais recente,
  sobrenome vazio vira aviso, homônimos separados); edição dos dados da autorização com prévia do PDF, selo "Editado", desfazer;
  migração `202611020002_registration_authorization_adjustments.sql`. Com a planilha real (testada só localmente) importa **259 inscritos, 0 bloqueios**.
- **Calendário oficial**: `src/data/officialSchedule.ts` — dias 1–5 do Manual da Equipe FSY 2027 (págs. 9–15), dia 0 mantido;
  **1º dia = "Roupa casual"** (confirmado pelo responsável; o manual diz camiseta, mas não será usada). Locais em branco (manual não traz).

**Android (Kotlin/Compose, `android/`)** — `compileDebugKotlin` e `testDebugUnitTest` aprovados; 85 capturas Robolectric geradas.
Tela Mais (perfil social + foto), Início novo, cache offline, remoção do reordenar, correções de categorias/cadastro etc.
O job do Codex que revisava as capturas foi interrompido/sem rede; veja a tarefa A abaixo.

## 4. O que falta fazer (em ordem)

### A. Terminar o Android
1. `git diff --stat -- android` para ver o estado. Continue o `BRIEF-ANDROID.md` (não recomece).
2. Gradle precisa de internet (dependências do lint). Se rodar no Codex com sandbox, use rede liberada:
   `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high -c sandbox_workspace_write.network_access=true -s workspace-write --add-dir D:/Projects/PC/FSY/_ferramentas --add-dir D:/Projects/PC/FSY/_trabalho -C D:/Projects/PC/FSY/fsy-event-app "<tarefa>"`
   (ou rode o Gradle direto no terminal). Comandos:
   ```bash
   export JAVA_HOME="C:/Program Files/Java/jdk-21" GRADLE_USER_HOME=/d/Projects/PC/FSY/_ferramentas/gradle-home
   cd /d/Projects/PC/FSY/fsy-event-app/android
   ./gradlew --no-daemon :app:compileDebugKotlin
   ./gradlew --no-daemon testDebugUnitTest
   ./gradlew --no-daemon assembleDebug lintDebug
   ```
   Uma tarefa Gradle por vez. O disco C: está quase cheio: mantenha caches no D:. Não instale emulador (não há hipervisor).
3. Revise os PNGs de `android/app/build/outputs/visual-qa/` (claro/escuro, 360 dp, fonte 200 %, jovem sem nada de gestão, Mais,
   foto pendente, revisão do consultor). Corrija o que estiver quebrado. Copie os finais para `D:\Projects\PC\FSY\_trabalho\capturas\android-depois\`.
4. Confirme no código: jovem não vê itens `Equipe`/`dia0` da agenda (mesma regra de `scheduleVisibleTo()` do web), nem entradas de gestão.
5. versionName 1.2.0 / versionCode +1. Escreva `D:\Projects\PC\FSY\_trabalho\auditorias\RELATORIO-ANDROID.md`.
6. Tela de Inscrições do Android (`ui/screens/admin/RegistrationsAdminScreen.kt`): alinhar ao novo contrato de ajustes
   (`docs/redesign-2026-11/CONTRATO-AJUSTES-INSCRICOES.md`) — editar dados da autorização e baixar PDF, só para gestão.

### B. Verificação final do web
```bash
cd /d/Projects/PC/FSY/fsy-event-app
npm run lint && npm run typecheck && npm test && npm run build
```
`npm run build` baixa fontes do Google: rode com internet (fora do sandbox). Para ver as telas logadas sem conta real, há um ambiente de QA:
`node D:/Projects/PC/FSY/_ferramentas/qa-dev.cjs` (Supabase falso + contas fictícias de `scripts/visual-qa/fixtures.json`; jovem = pessoa 5,
consultor = 4, casal diretor = 1; o cookie sai de `scripts/visual-qa/session.mjs` → `sessionCookie('5')`, nome `sb-127-auth-token`, abra em
`http://127.0.0.1:3117`). Atenção: o service worker do PWA guarda JS antigo — limpe-o (`navigator.serviceWorker.getRegistrations()` → `unregister`) ao testar.

### C. Banco de produção (Supabase) — só com o "ok" do responsável
Projeto `vhbmnnpgftrrovjtvbzo`. O responsável tem o plugin do Supabase no Claude Code e acesso ao painel.
1. Conferir quais migrações já estão aplicadas (as de 20/10 foram; confirmar `202610310001_registrations_and_authorizations` e `202610310002_push_device_tokens`).
2. Aplicar, em ordem, as que faltarem + as novas `202611020001_profile_photo_review.sql` e `202611020002_registration_authorization_adjustments.sql`
   (SQL Editor do painel ou CLI). São idempotentes/aditivas. Conferir depois: bucket `profile-photos` privado existe; RLS ativa nas tabelas novas.
3. Atualizar `schedule_items` com o calendário oficial: botão **"Sincronizar oficial"** em Gestão › Agenda (substitui a agenda inteira —
   avisar o responsável que edições feitas pela gestão serão perdidas) ou chamar `admin_replace_schedule` com os itens de `officialSchedule.ts`.
   Bancos antigos marcam a preparação da equipe como "Logística"; o filtro do jovem já trata isso.

### D. Commits (só depois de A e B verdes, e com o "ok" do responsável)
Commits separados, mensagens em pt-BR, terminando com a linha de coautoria que o responsável usar:
1. `feat(web): navegação em 4 abas, Início, Avisos, Agenda e Mais` (src/components/layout, dashboard, app/{announcements,schedule,mais,fotos})
2. `feat: foto de perfil com aprovação do consultor` (api/profile, lib/profile-photo, types/profile-photo, migração 202611020001, counselor)
3. `refactor(gestao): navegação única, nomes e linguagem simples`
4. `feat(inscricoes): importação tolerante e ajustes editáveis das autorizações` (+ migração 202611020002, fixture sintética, testes)
5. `feat(agenda): calendário oficial do Manual da Equipe 2027`
6. `feat(android): redesign 1.2.0 …`
7. `docs: especificação, briefs e relatórios do redesign`
Antes de cada commit: `git status` e `git diff --cached --stat`; garantir que nenhuma planilha real, `.env*`, `local.properties`,
`keystore.properties` ou `.jks` entrou. Depois: push da branch e PR para `main` (descrição em pt-BR com o que mudou e como testar).

### E. Depois (com o responsável)
- Publicar na Vercel após o PR aprovado.
- Instalar o APK no Galaxy S25: ativar Depuração sem fio no celular, `adb pair`/`adb connect` com
  `D:\Projects\PC\FSY\_ferramentas\android-sdk\platform-tools\adb.exe`, `adb install -r app-debug.apk` (ou release assinado com o keystore
  descrito em `android/keystore.properties`, que não vai para o Git).

## 5. Pegadinhas conhecidas
- Codex: `gpt-6.1-sol` exige CLI ≥ 0.166. No sandbox não há rede por padrão (fontes do Google, Maven); use `network_access=true` ou rode fora.
- `codex exec resume` não herda `-c sandbox_workspace_write.network_access=true` — passe de novo.
- Lint do projeto proíbe `setState` síncrono dentro de `useEffect` (use `startTransition` ou derive o valor).
- `CustomizableGrid` virou grade fixa de propósito (sem personalização) — não reintroduza drag & drop.
- `scheduleVisibleTo(role, items)` em `src/services/scheduleService.ts` é a regra única de visibilidade da agenda para jovens.

## Fechamento — cargos, commits e Supabase (02/11/2026)

Pedido seguinte do responsável autorizou os commits de tudo e as mudanças no Supabase. A troca de cargo já existia no site; foram corrigidas a atualização do modal/sessão e a oferta de ações para contas sem perfil. Android ganhou seleção dos sete cargos em português, ações conforme API, janela de conta com limites finitos e revalidação ao retomar/a cada minuto ativo. Próprio cargo e última gestão permanecem protegidos; logística mantém autoridade administrativa equivalente.

Validação final: web lint/typecheck/build e 205 testes aprovados; Android 51 testes, assembleDebug e lintDebug aprovados (0 erros,52 avisos). 90 PNGs finais e APK1.2.0-debug(3) gerados. Código e documentos registrados em sete commits locais na branch `feat/redesign-simplificacao-2026-11`.

Supabase FSY `vhbmnnpgftrrovjtvbzo`: aplicadas `202611020001` e `202611020002`; bucket privado, gatilhos, RLS/ACL e RPCs conferidos. Histórico alinhado às dez versões locais, com oito baselines de estrutura já existente e sem repetir DDL antigo. Agenda inicial82 substituída pela oficial92, com backup externo e comparação integral faltantes0/extras0; 67 itens visíveis ao jovem. ContasAuth6/perfis6/companhias4/inscrições0 preservados. Detalhes: `APLICACAO-SUPABASE.md`.

Pendente: publicação do site, push/PR, distribuição/instalação do APK e validações físicas (prévia PDF bem-sucedida, OAuth/FCM, Photo Picker, TalkBack/Doze/launcher/háptica). Nenhuma planilha real foi aberta ou enviada nesta retomada. Logs e backup da agenda estão fora do Git.
