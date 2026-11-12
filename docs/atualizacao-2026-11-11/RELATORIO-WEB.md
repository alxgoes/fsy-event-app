# Relatório Web — Atualização 11/11/2026

## 1. Arquivos Criados e Alterados

- **Banco de Dados (`supabase/migrations/`)**
  - `supabase/migrations/202611110001_company_whatsapp_links.sql`: Tabela `public.company_whatsapp_links` com `CHECK` estrito (`^https://chat\.whatsapp\.com/[A-Za-z0-9]{16,32}$`), `ENABLE/FORCE ROW LEVEL SECURITY`, `REVOKE ALL` de `PUBLIC`, `anon` e `authenticated` e `GRANT ALL` apenas a `service_role`.
- **Contratos, Rotas e Serviços (`src/`)**
  - `src/types/company-whatsapp.ts`: Interface `CompanyWhatsappLink`, schema Zod `companyWhatsappUpdateSchema` e normalizador `normalizeWhatsappInvite`.
  - `src/app/api/companies/whatsapp/route.ts`: `GET` e `PUT` autenticados com escopo por cargo/companhia, limite de taxa, validação de origem e registro em `counselor_audit_logs` sem gravar o link ou código de convite.
  - `src/services/offlineCache.ts` e `src/services/companyWhatsappService.ts`: Busca e cache offline particionado por conta e companhia (`company_whatsapp`).
  - `src/app/api/companies/route.ts`, `src/app/api/announcements/route.ts`, `src/app/api/profile/photo/reviews/route.ts`, `src/app/api/profile/photo/company/route.ts`, `src/app/api/admin/counselor-audit/route.ts`: Endurecimento do escopo de consultor.
- **Interface e Enquadramento (`src/components/`, `scripts/visual-qa/`)**
  - `src/components/counselor/CompanyWhatsappDialog.tsx`: Diálogo de adição, troca e remoção (com confirmação) do link do grupo.
  - `src/components/dashboard/YouthDashboard.tsx`, `src/components/profile/MorePage.tsx`, `src/components/counselor/CounselorPanel.tsx`, `src/components/admin/CompanyManager.tsx`, `src/components/ui/dialog.tsx`, `src/components/media/PhotoGallery.tsx`, `src/components/media/InstagramFeed.tsx`, `src/components/dashboard/MemoriesCard.tsx`.
  - `scripts/visual-qa/fixtures.json` e `scripts/visual-qa/verify.cjs`.
- **Testes Automatizados (`tests/`)**
  - `tests/company-whatsapp.test.cjs`, `tests/counselor-scope.test.cjs`, `tests/native-api-parity.test.cjs`.

## 2. Correções no Escopo de Consultor

- **`CounselorPanel.tsx`**: Removida a renderização de `<PhotoReviews />` quando o consultor não possui `company_id`, exibindo apenas o estado vazio explicativo.
- **`/api/companies` (`PUT`)**: Normalização de `company_id` e `body.id` com `trim()`, impedindo que consultor sem companhia ou de outra companhia altere lemas (`403`).
- **`/api/companies/whatsapp` (`GET`/`PUT`)**: Consultor lê apenas a própria companhia (ou `[]` se não designado) e recebe `404` ao tentar editar outra companhia.
- **`/api/announcements`, `/api/profile/photo/reviews` e `/api/profile/photo/company`**: Filtragem garantida tanto na consulta quanto sobre as linhas retornadas, impedindo vazamento entre companhias mesmo sob mocks estáticos.
- **`/api/admin/counselor-audit` (`POST`)**: Consultor sem `company_id` passa a ser recusado com `403`, e consultor designado tem `company_id` fixado pela sessão do servidor.

## 3. Achados de Enquadramento (Antes / Depois)

- **Antes**:
  - Em `CompanyManager.tsx` (`/admin/companies`), botões de ação do cabeçalho, botões de editar/excluir cartão, seletor de cores e rodapé do modal usavam `min-h-[36px]`/`min-w-[36px]` (< 44 px) e não quebravam linha em 320 px com fonte a 200%.
  - Em `MorePage.tsx` e `CounselorPanel.tsx`, seletores `radiogroup` com `grid-cols-3` fixo em `rounded-full` comprimiam rótulos ("Automático", "Importante") em 320 px com fonte a 200%.
  - Em `ui/dialog.tsx`, faltava `max-h-[calc(100dvh-2rem)] overflow-y-auto` no `DialogContent` e recuo `pr-11` no `DialogHeader` para evitar colisão do título com o botão de fechar (44×44 px).
- **Depois**:
  - Todos os controles interativos em `/admin/companies`, `/consultor`, `/mais`, `/fotos` e diálogos têm `min-h-11` (≥ 44×44 px), `flex-wrap` e `whitespace-normal break-words [overflow-wrap:anywhere]`, crescendo em altura sem truncar nem vazar horizontalmente de 320 px a 1280 px (fonte 100% e 200%, claro e escuro).

## 4. Resultado dos Comandos de Verificação

- `npm run lint`: **Passou** (código 0, 0 erros, 0 avisos).
- `npm run typecheck`: **Passou** (código 0, `tsc --noEmit -p .` limpo).
- `npm test`: **Passou** (código 0, 227/227 testes aprovados com `--test-concurrency=1`, incluindo RLS em PGlite, WhatsApp, escopo de consultor e paridade com `PortalApiClient.kt`).
- `npm run build`: **Passou** (código 0, build de produção Next.js concluído com 1 worker).

## 5. Pontos Dependentes de Ação Externa

- Aplicar a migração `supabase/migrations/202611110001_company_whatsapp_links.sql` no projeto Supabase de produção antes ou durante o deploy da atualização.
