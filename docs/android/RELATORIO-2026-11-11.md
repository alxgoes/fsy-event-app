# Relatório Android 1.2.2 (5) — 11/11/2026

## 1. Alterações por tela e componente

- **Versão (`app/build.gradle.kts`):** `versionName = "1.2.2"`, `versionCode = 5`.
- **Foto de perfil (`PortalApiClient.kt`, `FsyAppState.kt`, `FriendlyErrors.kt`, `MainActivity.kt`, `FsyControls.kt`, `ProfileAccessAction.kt`, `HomeScreen.kt`, `MoreScreen.kt`, `PhotoReviewsSection.kt`):**
  - Sincronização em `ON_RESUME` (`refreshProfilePhoto(fromImageError = false)` e `refreshCompanyWhatsapp()`).
  - Atualização imediata do estado após enviar, cancelar ou remover foto.
  - Guardas de tentativa única (`photoUrlErrorRetryUsed`, `companyPhotosErrorRetryUsed`, `photoReviewsErrorRetryUsed` e `errorRetries` em `FsyAvatar`) renovam URL assinada expirada uma única vez sem loop infinito.
  - Mapeamento de HTTP 401/403 em `FriendlyErrors` para mensagens claras em `pt-BR`.
- **WhatsApp da companhia (`Models.kt`, `FsyIcons.kt`, `FsyExternal.kt`, `PortalApiClient.kt`, `FsyAppState.kt`, `HomeScreen.kt`, `MoreScreen.kt`, `CounselorScreen.kt`, `AdminCoreModulesScreens.kt`):**
  - Ícone oficial `MessageCircle`, validador canônico `^https://chat\.whatsapp\.com/[A-Za-z0-9_-]{10,64}$`, normalização e bloqueio antes do `Intent.ACTION_VIEW`.
  - **Início e Mais (Jovem):** botão `"Entrar no grupo da companhia"` e linha `"Grupo da companhia no WhatsApp"` (ocultos sem link válido); persistência offline e limpeza no logout.
  - **Painel do Consultor:** cartão `"Grupo do WhatsApp"` abaixo do banner com diálogo de edição/remoção.
  - **Gestão → Companhias:** alerta no topo (`"N companhias sem consultor"`), selo `"Sem consultor designado"` e gestão do link para qualquer companhia.

## 2. Problemas de enquadramento corrigidos

| Tela / Componente | Largura / Fonte | Problema encontrado | Correção aplicada |
| :--- | :--- | :--- | :--- |
| **Gestão → Inscrições (`RegistrationsAdminScreen.kt`)** | 320–360 dp × 1.0–2.0 | Botões de planilha/PDF/ZIP, lotes, busca/filtro, `"Ver dados"`/`"Ficha PDF"` e paginação cortados em `Row`. | Empilhamento em `Column` quando `isCompactActionLayout()` (`width < 380.dp \|\| fontScale >= 1.3f`) e remoção de `height(56.dp)` fixo. |
| **Botões e seletores (`FsyControls.kt`, `FsyNavigation.kt`)** | 320 dp × 1.3–2.0 | `FsySegmentedSelector` e botões truncando rótulos; inicial do `FsyAvatar` deslocada em 200%. | Opções empilhadas quando compacto; padding reduzido; inicial proporcional em `FsyAvatar`. |
| **Agenda (`ScheduleScreen.kt`)** | 320 dp × 2.0 | `"Detalhes"` e `"Lembrar"` lado a lado truncavam `"Lembrar"` (`"Lem..."`). | Empilhamento vertical quando `largeText && hasDescription`. |
| **Consultor (`CounselorScreen.kt`)** | 320 dp × 1.3–2.0 | Botões do WhatsApp, linha `"Lema"` e switch `"Marcar como urgente"` sem quebra/peso. | Botões empilhados no modo compacto e `Modifier.weight(1f)`. |
| **Gestão e Auth (`AdminCoreModulesScreens.kt`, `AdminSensitiveModulesScreens.kt`, `AuthScreen.kt`)** | 320–360 dp × 1.3–2.0 | Pares de botões em `Row` e `height(48.dp)` fixo em Contas, Companhias, Agenda, Logística, Avisos, Mídia, Saúde e Inclusão. | Empilhamento com `isCompactActionLayout()` e `heightIn(min = 48.dp)`. |

## 3. Compilação, testes, build e lint

- `:app:compileDebugKotlin`: **PASS** (`BUILD SUCCESSFUL`).
- `testDebugUnitTest`: **PASS** — **64 testes, 0 falhas, 0 erros** (`ProfilePhotoContractTest` [6], `ProfilePhotoRolesUiTest` [6], `VisualQaTest` [20] cobrindo WhatsApp e matriz 320/360/393/412 dp × fontes 1.0/1.3/2.0 × claro/escuro com `assertNoButtonTextOverflow`).
- `assembleDebug` e `lintDebug`: **PASS** (`BUILD SUCCESSFUL`, 0 erros de lint).
- **Capturas:** 120 PNGs inspecionados e copiados para `D:\Projects\PC\FSY\_trabalho\capturas\android-2026-11-11\`.

## 4. O que não foi possível verificar

Sem aparelho físico ou emulador Android conectado: abertura real do WhatsApp via `Intent.ACTION_VIEW`, Photo Picker nativo, OAuth/FCM em hardware, TalkBack físico e `PdfRenderer` com PDF real permanecem pendentes de teste em dispositivo.
