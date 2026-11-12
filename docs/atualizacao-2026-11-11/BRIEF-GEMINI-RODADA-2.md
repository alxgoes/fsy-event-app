# Brief Gemini — rodada 2 (11/11/2026): atualizador automático + ajustes da revisão

Repositório `D:\Projects\PC\FSY\fsy-event-app`, branch `feat/whatsapp-fotos-enquadramento-2026-11`. As rodadas WEB e ANDROID já terminaram
(web: 227 testes; Android 1.2.2 (5): 64 testes). Nesta rodada você pode editar `android/**`, `docs/android/**`, `src/**`, `tests/**` e `scripts/**`.
**Nenhum git de escrita. Não publique nada** (nada de `gh release`, deploy, upload): o script de publicação deve existir e ser testável em modo
simulação (`-Simular`), mas não o execute de verdade. Não toque em `android/keystore.properties` nem em arquivos `.jks`. pt-BR, sem jargão.

## Parte A — Atualização automática
Implementar integralmente `docs/atualizacao-2026-11-11/ATUALIZACAO-AUTOMATICA.md` (servidor, atualizador interno no Android, script de publicação).
Versão do app passa a **1.3.0**, `versionCode` 6.

## Parte B — Ajustes apontados na revisão do orquestrador
1. **Regex do convite igual nos dois lados**: no Android o validador ficou `[A-Za-z0-9_-]{10,64}`; o contrato (ARQUITETURA.md) e o servidor usam
   `^https://chat\.whatsapp\.com/[A-Za-z0-9]{16,32}$`. Alinhar o Android ao contrato (um link aceito no app precisa ser aceito no servidor) e ajustar testes.
2. **`has_counselor` depois de salvar** (`src/app/api/companies/whatsapp/route.ts`, PUT): para a gestão a resposta calcula `computeHasCounselor(company, [])`
   (sem perfis) e pode marcar "Sem consultor designado" errado até recarregar. Calcular com os perfis reais da companhia, como no GET. Teste.
3. **Inscrições no Android** (`RegistrationsAdminScreen.kt`): trocar "conselheiros" por **"consultores"** (termo do evento) em todo o app;
   botão "Parte 1/3" sem contexto → rótulo claro (ex.: "Parte 1 de 3 · trocar"), ou seletor com título "Qual parte baixar"; "(Rev #0)" e
   "108 part. / 12 cons." → linguagem simples ("Importada em dd/mm · 108 participantes e 12 consultores"); "Ficha em Branco" → "Ficha em branco".
4. Rodar de novo a matriz de enquadramento (320–412 dp × fonte 1.0/1.3/2.0) incluindo as telas novas do atualizador.

## Verificação obrigatória
Web: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`.
Android (uma tarefa Gradle por vez; `JAVA_HOME="C:/Program Files/Java/jdk-21"`, `GRADLE_USER_HOME=/d/Projects/PC/FSY/_ferramentas/gradle-home`):
`./gradlew --no-daemon :app:compileDebugKotlin` · `testDebugUnitTest` · `assembleDebug lintDebug`.
Atenção ao tempo: você tem ~55 min. Se estiver acabando, priorize deixar tudo compilando e os testes verdes, e escreva o relatório dizendo o que faltou.

## Entrega
`docs/android/RELATORIO-ATUALIZADOR.md` (até 450 palavras): o que foi feito nas partes A e B, resultado honesto de cada comando, o que só dá para
confirmar em aparelho real. Copiar capturas novas para `D:\Projects\PC\FSY\_trabalho\capturas\android-2026-11-11\`.
