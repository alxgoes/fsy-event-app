> **Atualização 1.2.0 (novembro/2026):** veja [REDESIGN-2026-11.md](REDESIGN-2026-11.md). O conteúdo abaixo é histórico da 1.1.0: reordenação, aba Perfil e rotação de avisos foram removidas; a navegação atual é Início · Agenda · Avisos · Mais.

# Matriz de Paridade Nativa Android — FSY Sessão Ribeirão Preto 2 (2027)

> **Checkpoint verificado em 31/10/2026:** o conjunto nativo compila em release assinado, com 7 testes JVM aprovados e lint sem erros. As linhas abaixo inventariam código; não provam execução das telas em aparelho. Não houve aparelho/emulador conectado, teste visual nativo nem entrega real de push. As referências antigas a "aguardando compilação" ficam superadas por este checkpoint. A autorização é por cargo real do backend, e a ordenação Android é local por conta. Veja [BUILD-E-ENTREGA.md](BUILD-E-ENTREGA.md) para evidências e limites.

Este documento inventaria todos os módulos, rotas, tabelas, formulários, ações e controles de acesso (RBAC) existentes no portal Web (`src/app/**`, `src/components/**`) e no aplicativo nativo iOS (`ios/FSY/**`), mapeando sua implementação **100% nativa em Kotlin / Jetpack Compose** no Android (`android/app/src/main/java/br/com/fsyrp2/app/**`) e distinguindo claramente o que está **Implementado em Código**, **Compilado**, **Testado** ou **Com Limitação Externa**.

> **Regra de Ouro:** Nenhuma funcionalidade interna usa `WebView`, `iframe` ou redirecionamento para páginas do portal web. O portal `https://fsy-event-app.vercel.app` é consumido **exclusivamente** como backend JSON/binário autenticado via `Authorization: Bearer <access_token>`, compartilhando o mesmo projeto Supabase (`vhbmnnpgftrrovjtvbzo`), as mesmas contas, permissões RLS e validação de papéis no servidor.

---

## 1. Matriz de Papéis (RBAC) e Portões de Acesso

Espelho exato de `src/lib/auth/permissions.ts`, `ios/FSY/Core/AdminModels.swift` e `Models.kt` (`UserRole` / `AdminModule.canAccess`). A interface nativa organiza a navegação por cargo, e **cada leitura e escrita é autorizada novamente no servidor**.

| Papel (`wireValue`) | Rótulo (`pt-BR`) | Dia Zero (`dia0`) | Painel do Conselheiro | Módulos Administrativos Nativos |
| :--- | :--- | :--- | :--- | :--- |
| `jovem` | Jovem Participante | Não (`dia1` a `dia5`) | Não | Nenhum |
| `consultor` | Conselheiro(a) | Sim (Equipe) | Sim (Sua companhia, lema, jovens, avisos) | Avisos (escopo da própria companhia) e Inclusão (`/api/inclusion*`) |
| `logistica` | Logística | Sim (Equipe) | Sim | Todos os 11 módulos administrativos |
| `coordenador` | Coordenador(a) | Sim (Equipe) | Sim | Todos os 11 módulos administrativos |
| `casal_diretor` | Casal Diretor | Sim (Equipe) | Sim | Todos os 11 módulos administrativos |

> **Permissões granulares (`profile.permissions`):** Qualquer membro da equipe com permissões explícitas atribuídas em `profiles.permissions` (`users`, `companies`, `schedule`, `logistics`, `announcements`, `media`, `medical`, `inclusion`, `counselor_audit`, `registrations`) recebe acesso nativo ao módulo correspondente em `AdminModule.canAccess`.

---

## 2. Módulos de Autenticação, Sessão e Segurança

| Funcionalidade | Origem Web / iOS | Endpoint / Contrato | Arquivos Android Nativos | Isolamento & Segurança | Estado & Evidência Atual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Entrar com e-mail e senha** | `/login` · `LoginView.swift` | `POST /auth/v1/token?grant_type=password` | `AuthScreen.kt` + `PortalApiClient.signInWithPassword` + `FsyAppState.signIn` | Sessão criptografada AES-256-GCM no Android Keystore (`KeystoreSessionStore.kt`). Funciona nativamente para todas as contas autorizadas. | **Implementado em código** (`AuthScreen.kt`, `PortalApiClient.kt`); compilação/teste aguardando slot pesado. |
| **Criar conta (Cadastro)** | `/login` · `LoginView.swift` | `POST /auth/v1/signup` (`full_name`, `unit`) | `AuthScreen.kt` + `PortalApiClient.signUpWithPassword` | Todo cadastro inicia como `jovem` pelo trigger do banco. | **Implementado em código** (`AuthScreen.kt`, `PortalApiClient.kt`); compilação/teste aguardando slot pesado. |
| **Recuperar senha** | `/login` · `LoginView.swift` | `POST /api/auth/recover` | `AuthScreen.kt` + `PortalApiClient.requestPasswordRecovery` | Resposta neutra em `pt-BR`; sem expor existência da conta. | **Implementado em código** (`AuthScreen.kt`, `PortalApiClient.kt`); compilação/teste aguardando slot pesado. |
| **Entrar com Google (OAuth PKCE)** | `/login` · `AuthClient.swift` | `GET /auth/v1/authorize?provider=google&redirect_to=fsyrp2://auth-callback` → `POST /auth/v1/token?grant_type=pkce` | `PkceAuthHelper.kt` + `DeepLinkParser.kt` + `FsyAppState.buildGoogleOAuthUri` | Usa exatamente `fsyrp2://auth-callback` já cadastrado na allowlist do Supabase em 20/10/2026 (`docs/ios/CONTRATO-WEB.md:28`). | **Implementado em código + Limitação externa conhecida:** OAuth Google no Google Cloud está em modo **Teste** (apenas e-mails de teste cadastrados entram, conforme `CONTRATO-WEB.md:28`). |
| **Renovação automática de sessão** | `AppModel.validToken` | `POST /auth/v1/token?grant_type=refresh_token` | `FsyAppState.withValidSession` (single-flight `Mutex`) | Evita corrida em renovações simultâneas; falha 400/401/403 limpa a sessão imediatamente. | **Implementado em código** (`FsyAppState.kt`); compilação/teste aguardando slot pesado. |
| **Troca de conta e Logout limpo (AN1)** | `AppModel.signOut` / `adopt` | `POST /auth/v1/logout` + `DELETE /api/notifications/devices?deviceId=<id>` | `FsyAppState.performImmediateLogoutCleanup` + `PushTokenManager.cleanupOnLogoutOrAccountSwitch` | Captura `boundDeviceId` **antes** de `keyStore.clearSession()` (correção AN1 revisada com Opus), incrementa `sessionGeneration`, cancela alarmes/notificações, reseta widgets Glance e executa `FirebaseMessaging.deleteToken()` mesmo offline. | **Implementado em código e revisado (AN1)** (`FsyAppState.kt`, `PushTokenManager.kt`, `KeystoreSessionStore.kt`); compilação/teste aguardando slot pesado. |

---

## 3. Experiência do Participante e Equipe (Abas Principais e Galeria)

| Aba / Tela | Origem Web / iOS | Leituras e Escritas (API / PostgREST) | Arquivos Android Nativos | Paridade de Interação e Motion | Estado & Evidência Atual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Início (`inicio`)** | `/portal` · `HomeView.swift` | `GET /rest/v1/profiles`, `companies`, `schedule_items`, `GET /api/announcements`, `GET /api/instagram`, `GET /api/media` | `HomeScreen.kt` + `ReorderableCardList.kt` (`pageKey = "dashboard"`) | Cartões reordenáveis por conta (`next-activity`, `announcements`, `company`, `gallery`) com autoscroll medido pelo viewport visível, `FsyHeroBanner` e atalhos para Conselheiro/Admin. | **Implementado em código** (`HomeScreen.kt`, `ReorderableCardList.kt`); compilação/teste aguardando slot pesado. |
| **Agenda (`agenda`)** | `/portal` · `ScheduleView.swift` | `GET /rest/v1/schedule_items?order=date.asc,start_time.asc` | `ScheduleScreen.kt` + `EventCalendar.kt` (`America/Sao_Paulo`) | Seletor de dias (`dia0` para equipe; `dia1`..`dia5` para todos), filtro por categoria, destaque "AGORA", botão "Lembrar-me 10 min antes" (alarme local, distinto de presença) e solicitação contextual de `POST_NOTIFICATIONS`. | **Implementado em código** (`ScheduleScreen.kt`, `EventCalendar.kt`); compilação/teste aguardando slot pesado. |
| **Avisos (`avisos`)** | `/portal` · `AnnouncementsView.swift` | `GET /api/announcements`, `POST /api/announcements/like` | `AnnouncementsScreen.kt` | Filtros (*Todos*, *Urgentes*, *Sessão Geral*, *Minha Companhia*), curtida otimista e autenticada (`POST /api/announcements/like`) com `fsyPressScale` e `haptics.confirm()`, foco via deep link `fsyrp2://portal/announcements/<uuid>`. | **Implementado em código** (`AnnouncementsScreen.kt`); compilação/teste aguardando slot pesado. |
| **Galeria & Instagram** | `/portal` · `InstagramGalleryView.swift` | `GET /api/instagram` + `GET /api/media` | `GalleryScreen.kt` + `FsyCommonComponents.kt` (`RemotePublicImage`) | Alternância entre feed `@fsybrasiloficial` e Fotos da Sessão (Google Drive), diálogo nativo com zoom por gesto (`detectTransformGestures`) e abertura externa explícita (`CustomTabsIntent`). | **Implementado em código** (`GalleryScreen.kt`); compilação/teste aguardando slot pesado. |
| **Perfil (`perfil`)** | `ProfileView.swift` | `GET /rest/v1/profiles`, `GET/POST/PATCH/DELETE /api/notifications/devices` | `ProfileScreen.kt` | Dados do participante/equipe, preferências de canais e horário silencioso (`America/Sao_Paulo`), permissão contextual `POST_NOTIFICATIONS` e botões de saída segura. | **Implementado em código** (`ProfileScreen.kt`); compilação/teste aguardando slot pesado. |

---

## 4. Fluxo do Conselheiro (`consultor` e Gestores)

| Funcionalidade | Origem Web / iOS | Endpoint / Contrato | Arquivos Android Nativos | Detalhes de Paridade | Estado & Evidência Atual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Painel da Companhia & Lema** | `CounselorPanel.tsx` · `CounselorPanelView.swift` | `GET /rest/v1/companies?id=eq.<cid>`, `PUT /api/companies` (`{ id, motto, previous_motto }`) | `CounselorScreen.kt` | Exibe companhia vinculada, sala, link do Google Drive e edição nativa do lema/grito de guerra (auditado em `counselor_audit_logs`). | **Implementado em código** (`CounselorScreen.kt`, `PortalApiClient.kt`); compilação/teste aguardando slot pesado. |
| **Indicadores do Conselheiro** | `CounselorPanel.tsx` (`consultor-metrics`) | Contagens e dados da companhia (`youth-count`, `company-room`, `company-motto`) | `CounselorScreen.kt` com `ReorderableCardSection(pageKey = "consultor-metrics")` | Reordenação isolada por conta (`fsy:layout:v1:{userId}:consultor-metrics`). | **Implementado em código** (`CounselorScreen.kt`); compilação/teste aguardando slot pesado. |
| **Mural de Avisos da Companhia** | `CounselorPanel.tsx` (`consultor-announcements`) | `POST /api/announcements` (`company_id`), `DELETE /api/announcements?id=<id>` | `CounselorScreen.kt` com `ReorderableCardSection(pageKey = "consultor-announcements")` | Publicação e exclusão nativa de comunicados exclusivos da companhia. | **Implementado em código** (`CounselorScreen.kt`); compilação/teste aguardando slot pesado. |
| **Quadro de Jovens da Companhia** | `CounselorPanel.tsx` | `GET /rest/v1/profiles?company_id=eq.<cid>&role=eq.jovem` | `CounselorScreen.kt` | Busca por nome, unidade ou quarto entre os jovens alocados na companhia. | **Implementado em código** (`CounselorScreen.kt`); compilação/teste aguardando slot pesado. |

---

## 5. Módulos Administrativos Nativos (`/admin/**` e `ios/FSY/UI/Admin/**`)

| Módulo | Cargos Autorizados | Endpoints Consumidos | Arquivos Android Nativos | Ações Implementadas em Compose | Estado & Evidência Atual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Visão Geral (`overview`)** | Gestores | `GET /api/admin/overview` | `AdminHubScreen.kt` | Indicadores reordenáveis (`admin-metrics`) e atalhos de módulos reordenáveis (`admin-modules`), mais cartão direto para Inscrições FSY. | **Implementado em código** (`AdminHubScreen.kt`); compilação/teste aguardando slot pesado. |
| **2. Contas e Permissões (`accounts`)** | Gestores / `users` | `GET /api/admin/accounts`, `PATCH/DELETE /api/admin/accounts/[id]`, `POST .../password`, `.../recover`, `.../send-email`, `GET .../events` | `AdminCoreModulesScreens.kt` (`AccountsAdminModuleView`) | `SecureScreenEffect` (`FLAG_SECURE`). Busca, filtro por papel, paginação, edição de papel/quarto/ônibus/permissões/suspensão, definição de senha, envio de recuperação, envio de e-mail institucional, exclusão confirmada e histórico de auditoria. | **Implementado em código** (`AdminCoreModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **3. Companhias (`companies`)** | Gestores / `companies` | `GET/POST/PUT/DELETE /api/companies` | `AdminCoreModulesScreens.kt` (`CompaniesAdminModuleView`) | Listagem com conselheiros vinculados, criar/editar/excluir companhia (nome, lema, sala, cor hex, link Google Drive). | **Implementado em código** (`AdminCoreModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **4. Cronograma (`schedule`)** | Gestores / `schedule` | `GET/POST/PUT/DELETE /api/schedule` | `AdminCoreModulesScreens.kt` (`ScheduleAdminModuleView`) | Criar, editar e excluir atividades (`dia0`..`dia5`, horários, local, categoria, descrição) com atualização automática dos lembretes locais e widgets. | **Implementado em código** (`AdminCoreModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **5. Logística (`logistics`)** | Gestores / `logistics` | `GET/POST/PUT/DELETE /api/logistics` | `AdminCoreModulesScreens.kt` (`LogisticsAdminModuleView`) | Criar, editar e excluir ônibus/rotas (identificação, local de partida, previsão de chegada, responsável e telefone). | **Implementado em código** (`AdminCoreModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **6. Mural de Avisos (`announcements`)** | Gestores / `consultor` / `announcements` | `GET/POST/PUT/DELETE /api/announcements` | `AdminCoreModulesScreens.kt` (`AnnouncementsAdminModuleView`) | Publicar, editar e excluir comunicados (com opção urgente que dispara push FCM no servidor). | **Implementado em código** (`AdminCoreModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **7. Mídias (`media`)** | Gestores / `media` | `GET /api/media?all=true`, `POST/PUT/DELETE /api/media` | `AdminCoreModulesScreens.kt` (`MediaAdminModuleView`) | Criar, editar, alternar visibilidade (`visible`) e excluir álbuns/links do Google Drive. | **Implementado em código** (`AdminCoreModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **8. Saúde (`medical`)** | Gestores / `medical` | `GET/POST/PUT/DELETE /api/medical`, `GET/POST/PUT/DELETE /api/medical/appointments` | `AdminSensitiveModulesScreens.kt` (`MedicalAdminModuleView`) | `SecureScreenEffect` (`FLAG_SECURE`), somente em memória. Indicadores reordenáveis (`medical-metrics`), CRUD completo de Fichas Médicas e de Consultas/Atendimentos. | **Implementado em código** (`AdminSensitiveModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **9. Inclusão (`inclusion`)** | Gestores / `consultor` / `inclusion` | `GET/POST /api/inclusion`, `GET/PATCH/DELETE /api/inclusion/[id]`, `POST .../decision`, `POST/PATCH .../interviews*` | `AdminSensitiveModulesScreens.kt` (`InclusionAdminModuleView`) | `SecureScreenEffect` (`FLAG_SECURE`), somente em memória. Criar caso, listar/registrar entrevistas, registrar decisão com confirmação humana obrigatória (`human_confirmed = true`) e controle otimista de `version`. | **Implementado em código** (`AdminSensitiveModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **10. Auditoria de Conselheiros (`counselor_audit`)** | Gestores / `counselor_audit` | `GET /api/admin/counselor-audit` | `AdminCoreModulesScreens.kt` (`CounselorAuditAdminModuleView`) | Visualização da trilha de auditoria de edições de lemas e avisos de conselheiros. | **Implementado em código** (`AdminCoreModulesScreens.kt`); compilação/teste aguardando slot pesado. |
| **11. Inscrições FSY (`registrations`)** | Gestores / `registrations` | `GET/POST /api/admin/registrations`, `POST .../preview`, `GET .../[id]`, `DELETE .../batches/[batchId]`, `GET .../[id]/authorization-pdf`, `POST .../authorization-pdf-batch`, `GET .../export-xlsx`, `GET .../template-pdf` | `RegistrationsAdminScreen.kt` | `SecureScreenEffect` (`FLAG_SECURE`). Métricas, filtros e paginação; upload `.xlsx` de 34 colunas via SAF -> Preview de diffs/avisos -> Commit (`upsert` / `replace_all`); exclusão escopada de lote por UUID; modal de detalhe das 34 colunas; download privado via `FileProvider` de PDF individual, ZIP paginado (até 50 PDFs/parte), Excel `.xlsx` e modelo em branco. | **Implementado em código** (`RegistrationsAdminScreen.kt`); compilação/teste aguardando slot pesado. |

---

## 6. Notificações Nativas, Lembretes Locais e Widgets Glance

| Subsistema | Arquivos Android Nativos | Regras de Funcionamento e Privacidade | Estado & Evidência Atual |
| :--- | :--- | :--- | :--- |
| **Canais de Notificação** | `NotificationHelper.kt` | 4 canais (`fsy_announcements_urgent`, `fsy_announcements`, `fsy_schedule_reminders`, `fsy_personal_reminders`) com `VISIBILITY_PRIVATE` e versão pública estática `"FSY RP2: novo aviso"`. | **Implementado em código** (`NotificationHelper.kt`); compilação/teste aguardando slot pesado. |
| **Push Remoto (FCM HTTP v1 Data-Only)** | `FsyFirebaseMessagingService.kt` + `PushTokenManager.kt` + `KeystoreSessionStore.kt` | Processa exclusivamente payload `data` (`type = "fsy_announcement"`). Valida `targetUserId == activeUserId`, `deviceId == boundDeviceId` e `bindingGeneration == boundGeneration` antes de buscar o aviso autenticado em `GET /api/announcements`. Trata HTTP 409 (`TOKEN_BOUND_TO_OTHER_ACCOUNT`) com rotação única (`deleteToken` + `getToken` + novo `deviceId`). | **Implementado em código** (`FsyFirebaseMessagingService.kt`, `PushTokenManager.kt`); compilação/teste aguardando slot pesado. |
| **Lembretes Locais da Agenda** | `ScheduleReminderScheduler.kt` + `ScheduleReminderReceiver.kt` | Funciona 100% offline via `AlarmManager.setWindow` (10 min antes das atividades, sem exigir permissão de alarme exato restrita), respeita horário silencioso em `America/Sao_Paulo`, replaneja em `BOOT_COMPLETED` / alterações de horário e cancela tudo no logout. | **Implementado em código** (`ScheduleReminderScheduler.kt`, `ScheduleReminderReceiver.kt`); compilação/teste aguardando slot pesado. |
| **Widgets Nativos (Glance / AppWidget)** | `FsyGlanceWidgets.kt` (`NextActivityWidget`, `EventCalendarWidget`, `WidgetSyncWorker`) | Widgets responsivos ("Próximas atividades" 2×2, 4×2, 4×4 com barra azul de 3 dp para "AGORA"; "Calendário do evento" 4×2 para 06–10 fev 2027). Sem sessão ativa, exibem `"Entre no app FSY para ver sua agenda"`. Tocar abre `fsyrp2://agenda`. | **Implementado em código** (`FsyGlanceWidgets.kt`); compilação/teste aguardando slot pesado. |

