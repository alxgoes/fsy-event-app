# Contratos de Inscrições FSY 2027, Fichas de Autorização (PDF), Exportação Excel e Distribuição Android

Este documento especifica os contratos TypeScript e endpoints HTTP criados por **Gemini Argon 4** para consumo imediato pela interface administrativa (`/admin/inscricoes`, `/instalar`, `/admin`) construída por **Claude Opus 5.5** e pelos aplicativos nativos (`ios/FSY` e `android/`).

---

## 1. Arquivos de Tipos e Constantes Canônicas

1. **[`src/lib/event/identity.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/lib/event/identity.ts)**
   - `EVENT_NAME = "FSY Sessão Ribeirão Preto 2"`
   - `EVENT_SHORT_NAME = "FSY Ribeirão Preto 2 — 2027"`
   - `EVENT_DATES = "06 a 10 de fevereiro de 2027"`
   - `EVENT_VALIDITY_SHORT = "06 a 10/02/2027"`
   - `STAFF_DAY_DATE = "05 de fevereiro de 2027"`
   - `EVENT_VENUE = "Ipê Park Hotel"`
   - `EVENT_CITY = "São José do Rio Preto"`
   - `EVENT_STATE = "SP"`
   - `EVENT_CITY_UF = "São José do Rio Preto / SP"`
   - `EVENT_LOCATION_FULL = "Ipê Park Hotel — São José do Rio Preto / SP"`

2. **[`src/types/layout.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/types/layout.ts)**
   - Exporta `LAYOUT_PAGES`, `LayoutPageKey`, `LayoutPageSchema`, `CardLayoutState` e reexporta `resolveOrder`, `moveTo`, `moveBy`, `isDefaultOrder`, `cacheKey(userId, pageKey)` e `isForeignLayoutKey` diretamente de [`src/lib/layout/order.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/lib/layout/order.ts).
   - `LAYOUT_PAGES["admin-modules"].cardIds` inclui `"registrations"` ao final para o novo card de Inscrições & Autorizações no painel executivo.

3. **[`src/types/registrations.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/types/registrations.ts)**
   - Define `REGISTRATION_EXCEL_COLUMNS` (as 34 colunas exatas `A1..AH1` das abas `Consultor`, `Participante` e `Todas`), `RegistrationRecord`, `RegistrationPreviewSummary`, `RegistrationPreviewDiffSummary`, `RegistrationImportBatchSummary`, `RegistrationListResponse`, `CommitRegistrationImportRequest`, `CommitRegistrationImportResponse`, `DeleteRegistrationBatchResponse`, `ExportRegistrationsXlsxQuery`.

4. **[`src/types/authorizations.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/types/authorizations.ts)**
   - Define `MAX_AUTHORIZATION_PDF_BATCH_SIZE = 50`, `AuthorizationPdfPayload` (sempre página única original, com auto-fit `9pt..6pt` + `hasOverflowWarning` / `overflowFields` / `warnings`), `AuthorizationPdfBatchRequest`, `AuthorizationPdfBatchProgressInfo`, `AuthorizationPdfBatchManifestEntry`.

5. **[`src/types/app-distribution.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/types/app-distribution.ts)**
   - Define `AppDistributionManifest`, `PlatformReleaseStatus`, `AndroidApkSignatureMetadata`.

---

## 2. Regras Arquiteturais e de Segurança

- **Controle de Acesso (`userManagers`)**: Todos os endpoints em `/api/admin/registrations/**` exigem `requireIdentity("userManagers")` (perfis ativos `coordenador`, `casal_diretor` ou `logistica`), aceitando sessão Web via cookies ou `Authorization: Bearer <token>` nativo.
- **Cabeçalhos de Resposta**: Todas as respostas de `/api/admin/registrations/**` incluem:
  - `Cache-Control: private, no-store, max-age=0`
  - `Vary: Cookie, Authorization`
- **Isolamento Estrito**: A importação de inscrições grava exclusivamente em `registration_import_batches`, `registration_import_previews` e `event_registrations`. **NUNCA** altera `profiles`, `medical_records`, `companies`, `auth.users` ou `inclusion_cases`.

---

## 3. Endpoints HTTP (`/api/admin/registrations/**`)

### 3.1. `GET /api/admin/registrations`
Retorna a revisão atual (`currentRevision`), listagem paginada e filtrada de inscrições do lote ativo (ou de `batchId` específico), métricas agregadas e histórico de lotes.
- **Query Params (`RegistrationListFilterParams`)**:
  - `batchId?: string` (opcional; padrão = lote ativo atual)
  - `roleCategory?: "Participante" | "Consultor" | "all"`
  - `status?: string`
  - `stakeName?: string`
  - `wardName?: string`
  - `hasHealthAlert?: "true" | "false"`
  - `hasIssues?: "true" | "false"`
  - `search?: string` (busca por nome, nome de preferência, e-mail, CPF, RG, estaca, ala ou responsável)
  - `page?: number` (padrão `1`)
  - `pageSize?: number` (padrão `50`, máx `250`)
- **Response `200 OK`**: `RegistrationListResponse`

### 3.2. `POST /api/admin/registrations/preview`
Recebe o arquivo `.xlsx` via `multipart/form-data` (campo `file`) ou binário bruto, valida as 3 abas (`Consultor`, `Participante`, `Todas`) e as 34 colunas (`A1..AH1`), calcula nomes normalizados em Title Case `pt-BR`, computa o diff (`diffSummary: { insertCount, updateCount, unchangedCount, deleteCountOnReplaceAll }`) contra a `baseRevision` atual, vincula ao autor (`createdByUserId`) e persiste um preview temporário com expiração (`expiresAt`).
- **Request**: `FormData` com `file: File` (`.xlsx`, máx 10 MB).
- **Response `200 OK`**: `RegistrationPreviewSummary`
  - Se `canCommit === false` (ex.: planilha vazia com 0 linhas válidas, cabeçalhos incompatíveis ou duplicatas conflitantes), a UI deve exibir `issues` e bloquear o botão de confirmação.

### 3.3. `POST /api/admin/registrations`
Confirma e aplica atomicamente um `previewId` previamente validado, exigindo `expectedRevision` e `idempotencyKey`.
- **Request JSON**: `CommitRegistrationImportRequest`
  ```json
  {
    "previewId": "uuid-do-preview",
    "mode": "upsert",
    "expectedRevision": 0,
    "idempotencyKey": "uuid-idempotencia-cliente",
    "useNormalizedNames": true
  }
  ```
- **Respostas**:
  - `200 OK`: `CommitRegistrationImportResponse`
  - `409 Conflict`: Preview expirado, pertence a outro administrador ou `expectedRevision` / `baseRevision` diverge da `currentRevision` atual do banco.

### 3.4. `GET /api/admin/registrations/batches`
Lista os lotes de importação registrados (`{ currentRevision: number, batches: RegistrationImportBatchSummary[] }`).

### 3.5. `DELETE /api/admin/registrations/batches/[batchId]`
Remove atomicamente um lote de importação específico identificado por UUID (`batchId`).
- **Regras de Segurança**:
  - `batchId === "all"` ou IDs não-UUID são recusados com `400 Bad Request`.
  - Excluir o lote ativo limpa os inscritos daquele lote e define `activeBatch: null` — **NUNCA** promove automaticamente um lote histórico anterior, evitando ressuscitar pessoas desatualizadas.
- **Response `200 OK`**: `DeleteRegistrationBatchResponse`

### 3.6. `GET /api/admin/registrations/export-xlsx`
Exporta a tabela administrativa em formato `.xlsx` seguindo exatamente o modelo oficial de **3 abas (`Consultor`, `Participante`, `Todas`) e 34 colunas (`A1..AH1`)**:
- Nomes exportados na versão revisada/normalizada (`useNormalizedNames=true` por padrão, ou `false` para bruto).
- Campos de documento e telefone (`CPF`, `RG/CIN/Passaporte`, `Telefone`, `Telefone para contato 1/2`, `Telefone do Responsável`, datas) gravados explicitamente como células de texto (`inlineStr`) para preservar zeros à esquerda.
- Prevenção contra injeção de fórmulas (`=`, `+`, `-`, `@`, `\t`, `\r` neutralizados e sem tags `<f>`).
- **Query Params**: `batchId?`, `roleCategory?`, `useNormalizedNames?` (`"true"` | `"false"`), `search?`
- **Response `200 OK`**:
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="inscricoes-fsy-rp2-2027.xlsx"`

### 3.7. `GET /api/admin/registrations/[id]/authorization-pdf`
Gera em memória a `FICHA AUTORIZACAO.pdf` (estritamente 1 página original) preenchida para um inscrito específico, com redução automática de fonte (`9pt..6pt`) e cabeçalhos de aviso caso algum texto ultrapasse o limite físico do campo (`X-Authorization-Overflow-Warning: 1` e `X-Authorization-Overflow-Fields`).
- **Query Params**:
  - `useNormalizedNames?: "true" | "false"` (padrão `"true"`)
  - `download?: "1" | "0"` (padrão `"1"`)
- **Response `200 OK`**:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="ficha-autorizacao-<slug-nome>.pdf"`

### 3.8. `POST /api/admin/registrations/authorization-pdf-batch`
Gera em memória um arquivo `.zip` contendo até **`MAX_AUTHORIZATION_PDF_BATCH_SIZE = 50` PDFs** individuais nomeados + `manifesto-autorizacoes.json` (com `progress: AuthorizationPdfBatchProgressInfo` e `entries: AuthorizationPdfBatchManifestEntry[]`).
- **Request JSON**: `AuthorizationPdfBatchRequest`
  ```json
  {
    "registrationIds": ["uuid-1", "uuid-2"],
    "batchId": "uuid-opcional",
    "roleCategory": "Participante",
    "partIndex": 1,
    "partSize": 50,
    "useNormalizedNames": true
  }
  ```
- **Limites e Paginação**:
  - Se `registrationIds.length > 50` ou `partSize > 50`, retorna `400 Bad Request` informando o limite máximo de 50 PDFs por pacote ZIP.
  - Quando usado por filtro (`batchId` / `roleCategory`), `partIndex` (`1..totalParts`) e `partSize` (`<= 50`) permitem baixar partes de 50 em 50 (ex.: Parte 1: 1–50, Parte 2: 51–100).
- **Cabeçalhos de Progresso na Response `200 OK`**:
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="fichas-autorizacao-fsy-rp2-2027-parte-1-de-N.zip"`
  - `X-Batch-Part-Index`, `X-Batch-Part-Count`, `X-Batch-Total-Eligible`, `X-Batch-Part-Size`, `X-Batch-Overflow-Warning-Count`

### 3.9. `GET /api/admin/registrations/template-pdf`
Baixa a `FICHA AUTORIZACAO.pdf` original em branco (`276.809` bytes).
- **Response `200 OK`**:
  - `Content-Type: application/pdf`
  - `Content-Disposition: attachment; filename="FICHA AUTORIZACAO.pdf"`

---

## 4. Distribuição Nativa (`GET /api/app-release`)

- **Endpoint**: `GET /api/app-release` (público para exibição na página `/instalar`)
- **Response `200 OK`**: `AppDistributionManifest` (`src/types/app-distribution.ts`)

---

## 5. Nota S-4 para Claude Opus 5.5 (`ExecutiveDashboard.tsx` -> `GET /api/admin/overview`)

- O endpoint [`src/app/api/admin/overview/route.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/app/api/admin/overview/route.ts) já existe no backend, protegido por `requireIdentity("auditReaders")` (`coordenador`, `casal_diretor`, `logistica`), e retorna o contrato `AdminOverview` ([`src/types/native-auth.ts`](file:///C:/Users/user/Videos/FSY/fsy-event-app/src/types/native-auth.ts)) com campos em `snake_case`:
  ```ts
  export interface AdminOverview {
    total_youth: number;
    youth_with_company: number;
    youth_with_room: number;
    total_companies: number;
    total_counselors: number;
    medical_records: number;
    total_announcements: number;
    total_photos: number;
    recent_announcements: Pick<Announcement, "id" | "title" | "priority" | "category" | "created_at">[];
    generated_at: string;
  }
  ```
- Para concluir a correção **S-4**, `src/components/admin/ExecutiveDashboard.tsx` deve remover a leitura direta de `supabase.from("medical_records").select("user_id")` no navegador e obter a contagem `medical_records` (e demais métricas agregadas) via `GET /api/admin/overview`.

---

## 6. Hardening de Segurança Inscrições (`A1..A3`, `M1..M5`, `B1..B3`)

- **A1 (`admin_delete_registration_batch`)**: Exclusão estritamente escopada a `WHERE batch_id = p_batch_id`. Jamais executa `DELETE` sem cláusula `WHERE` e jamais promove lote antigo quando o lote ativo é excluído (`active_batch_id` passa a `NULL`).
- **A2 (Idempotency Fingerprint)**: `admin_commit_registration_preview` valida `source_preview_id`, `imported_by_user_id`, `import_mode`, `expected_revision` e `use_normalized_names`; divergência retorna `409 IDEMPOTENCY_KEY_REUSED`.
- **A3 (Menor Privilégio PostgREST)**: `REVOKE ALL` para `PUBLIC`, `anon` e `authenticated` nas 4 tabelas de inscrições; acesso exclusivo via `service_role` atrás de `requireIdentity("userManagers")`.
- **M1 (Scrubbing de Previews)**: No commit, `rows_json`, `summary_json.sampleRows` e `summary_json.nameChanges` são limpos; previews expirados não comitados são expurgados automaticamente e limitados a 3 ativos por operador.
- **M2 (503 Estrito)**: `503 REGISTRATIONS_NOT_MIGRATED` ocorre apenas para `42P01`/`PGRST205` nas tabelas do módulo; erros de coluna (`42703`) propagam `500`.
- **M3 / M4 (Normalização PT-BR + Duplicata Provável)**: Preserva numerais romanos (`II`, `III`, `IV`) e caixa mista intencional (`McDonald`, `MacArthur`), expõe `nameChanges` completo no resumo do preview e emite warning `PROBABLE_DUPLICATE_PERSON` quando nome similar + mesma data de nascimento aparecem com `dedupKey` distinto ou mudança de papel (`Participante` vs `Consultor`).
- **M5 (Manifesto Honesto)**: `signingSchemes` permanece `[]` até que metadados reais de assinatura do APK sejam injetados no build, e URLs de loja são validadas por `parsed.hostname === "play.google.com"`.
- **B1 / B2 / B3**: Rota de detalhe `GET /api/admin/registrations/[id]`, projeção enxuta na listagem (`projection=minimal|default|full`), paridade total de filtros em `GET /api/admin/registrations/export-xlsx` e cabeçalhos HTTP puramente ASCII com `Content-Disposition` RFC 5987 (`filename*=UTF-8''...`).

---

## 7. Notificações Push Escopadas (FCM HTTP v1 — Projeto `fsy-ribeirao-preto-2-2027`)

- **Migração**: [`supabase/migrations/202610310002_push_device_tokens.sql`](file:///C:/Users/user/Videos/FSY/fsy-event-app/supabase/migrations/202610310002_push_device_tokens.sql)
  - Tabela `public.push_device_tokens` com `RLS FORCE` e `REVOKE ALL` para `PUBLIC, anon, authenticated`.
  - RPCs atômicas `public.register_user_push_device` e `public.revoke_user_push_devices` escopadas estritamente ao `p_user_id` autenticado.
  - **Proibição de Delete Cross-Account por `deviceId`**: O servidor nunca apaga nem modifica registros de outra conta com base apenas em `deviceId` ou `fcmToken` informado pelo cliente.
  - **Colisão Cross-Account de `fcmToken` (`409 TOKEN_BOUND_TO_OTHER_ACCOUNT`)**: Se um `fcmToken` ainda estiver vinculado a outra conta ativa, `POST /api/notifications/devices` retorna `409 Conflict` com `{ code: "TOKEN_BOUND_TO_OTHER_ACCOUNT", requiresTokenRotation: true }`, instruindo o SDK Android (`FirebaseMessaging.getInstance().deleteToken()` + `getToken()`) a rotacionar o token antes de tentar novamente.
- **Payload Redigido (`buildSafeAnnouncementPushPayload`)**:
  - **Nenhum título nem conteúdo livre** do comunicado é enviado pelo FCM (prevenção total contra vazamento de PII/saúde na tela bloqueada ou no transporte push).
  - Campos enviados em `data`: `type` (`"fsy_announcement"`), `announcementId`, `priority`, `category` (allowlist), `scope` (`"global" | "company"`), `deepLink` (`fsyrp2://portal/announcements/<id>`), `lockscreenTitle` (`"FSY RP2: novo aviso"`), `genericBody` (`"Abra o aplicativo e autentique-se para visualizar o comunicado."`), `requiresAuthFetch` (`"true"`), `targetUserId`, `deviceId` e `bindingGeneration`.
- **Proteção contra Late-Arrival Pós-Logout (`shouldDisplayPushOnClient`)**:
  - O cliente Android valida que `targetUserId == currentUserId`, `deviceId == currentDeviceId` e `bindingGeneration == currentBindingGeneration` antes de exibir qualquer notificação e busca o detalhe autenticado em `GET /api/announcements`.
- **Resiliência e Deduplicação em `POST /api/announcements`**:
  - Suporta `Idempotency-Key` e janela de deduplicação de 60s por conteúdo/autor para evitar avisos duplicados em retries.
  - Aplica `AbortSignal.timeout` e classificação oficial de erros FCM HTTP v1 (`UNREGISTERED`, `INVALID_ARGUMENT`, `SENDER_ID_MISMATCH`, `QUOTA_EXCEEDED`, `UNAVAILABLE`, `INTERNAL`), garantindo que falhas ou timeouts do FCM jamais derrubem `POST /api/announcements` após persistir o comunicado.

