# Checkpoint de execução — 20/10/2026

Executor até aqui: Claude Opus 5.5 (Claude Code). Interrompido a pedido do usuário para economizar cota. Branch: `feat/retomada-seguranca-ux-2026-10` (base `84b22b9`). Nada foi enviado ao GitHub, publicado na Vercel nem aplicado em Supabase real.

## Sessões e subagentes

- Nenhum subagente Claude foi criado.
- Servidores locais de QA (`next dev -p 3100` e `scripts/visual-qa/fake-supabase.mjs`) foram encerrados neste checkpoint.
- Superpowers estava disponível nesta sessão (hook de SessionStart) e foi usado: `executing-plans` e `test-driven-development`. Ledger local (ignorado pelo git): `.superpowers/sdd/plano-implementacao-2026-10-20/progress.md`.

## Verificação no checkpoint

- `npm test` (novo script = `node --test tests/*.test.cjs`): **110/110 aprovados**.
- `npx tsc --noEmit -p .`: sem erros. `npm run lint`: sem avisos.
- `npm run build`: **não executado** nesta sessão (pendente).
- RLS testada em Postgres embutido (PGlite, `tests/database-rls.test.cjs`), não em Supabase real.

## Commits

1. `91a0aea` plano aprovado versionado.
2. `374c133` segurança: guard `requireIdentity` + matriz `src/lib/auth/permissions.ts`; todas as APIs (mídia, cadastro, companhias, agenda, avisos, curtidas, logística, auditoria) autorizam cargo e derivam autoria da sessão; avisos com escopo da companhia; middleware falha fechado sem env e bloqueia mutação de origem cruzada; `/auth/callback` sem redirecionamento aberto; migração `supabase/migrations/202610200001_security_hardening.sql` (trigger sem promoção por e-mail, perfis com leitura mínima, campos protegidos, escrita só pelo servidor, `announcement_likes` com migração das curtidas legadas, `user_layout_preferences`, `admin_account_events`, RPCs transacionais de companhia/agenda).
3. `7364814` contas: recuperação pública (`/api/auth/recover`, `/auth/confirm`, `/redefinir-senha`), login com campos FSY e sem desvio "demo"; `/api/admin/accounts` (listar Auth+perfis, editar, cargo pela matriz, suspender/reativar, excluir com confirmação e preservação de vínculos, link de recuperação, senha administrativa só direção, e-mail individual via Resend), proteção do último administrador, `profiles.suspended_at` respeitado no guard e nas políticas; `/api/users` PUT aplica a matriz.
4. Commit deste checkpoint (WIP): interface `AccountsManager` em `/admin/users`; `CustomizableGrid` + `usePageLayout` + `src/lib/layout/order.ts` aplicados ao `/dashboard`; nova `PhotoGallery` (grade + lightbox acessível, Drive como origem) substituindo carrossel/palco preto; remoção de código morto (DraggableGrid, MagneticCarousel, NeonBorder, DriveGallery, MediaEmbed, FeaturedPhotosSection, UserManager); API do Instagram com legenda integral, miniatura de vídeo, `feedId` validado e sem curtidas; `src/lib/media/caption.ts`; Supabase falso de QA visual em `scripts/visual-qa/` (somente dev, dados fictícios).

## Pendências reais (próximos passos, em ordem)

1. **Instagram UI quebrada temporariamente**: `src/components/media/InstagramFeed.tsx` ainda usa o contrato antigo (`likesCount`, `timestamp`) e o botão de curtida local. Reescrever usando `src/types/instagram.ts` e `tokenizeCaption`: "Ver mais/Ver menos" com `aria-expanded`, `whitespace-pre-line`, região de leitura rolável no detalhe, imagem `object-contain`, link ao post original, sem curtidas. Ajustar `MemoriesCard` ao estilo suave da galeria.
2. Rodar `npm run build` com variáveis fictícias e corrigir o que surgir.
3. Aplicar `CustomizableGrid` nas demais telas: `/consultor` (CounselorPanel), `/admin` (ExecutiveDashboard), `/admin/medical` (avaliar), e registrar cobertura tela a tela; ordenação administrativa de conteúdo onde existir (nenhuma coluna de ordem encontrada até agora).
4. Varredura de formulários: trocar classes próprias de `<input>/<select>/<textarea>` nos componentes admin, consultor e avisos por `Input`/`Textarea`/`NativeSelect`/`Field` (`src/components/ui/field*.tsx`).
5. Correções funcionais ainda abertas: métrica médica em `ExecutiveDashboard` (`youth_medical_profiles` → `medical_records`, contagem real de avisos), `/schedule` cargos antigos do Dia Zero, fuso UTC/local em `scheduleService`, recálculo periódico da atividade atual, "Sincronizado em tempo real" enganoso, `CounselorAuditManager` ainda envia `role` em query.
6. Dependências: Next 14.2.35 com advisories; `shadcn` em dependências de produção. Planejar sem `--force`.
7. Auditoria Impeccable real (linha de base estática: 16 achados; detector por URL precisa de puppeteer — instalado só no scratchpad desta sessão) e meta 20/20.
8. Atualizar `implementation_plan.md`, `walkthrough.md`, README e escrever `docs/manual-funcional-e-design.md` por último.

## Depende do usuário (acesso externo)

- Painel Supabase do projeto usado pela Vercel: o host `vhbmnnpgftrrovjtvbzo.supabase.co` do `.env.example` **não resolve em DNS** (20/10). Confirmar se o projeto está pausado/removido/trocado e retomar ou baixar backup. Não há CLI Supabase/Vercel nem `.env.local` nesta máquina.
- Depois do banco disponível: aplicar migrações na ordem (002 já aplicada em set/2026, conferir) → `202610200001`; antes, exportar dados/Auth.
- Supabase Auth: incluir `https://fsy-event-app.vercel.app/redefinir-senha` e `/auth/confirm` nas Redirect URLs; opcionalmente template de recuperação com `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/redefinir-senha`.
- Vercel: `NEXT_PUBLIC_SITE_URL`, e para e-mail individual `RESEND_API_KEY` + `EMAIL_FROM` (sem eles a API responde 503).
- Decisão de domínio: logística deve continuar acessando saúde/inclusão? (preservado como estava).

## Decisões tomadas (rulings) e custo se erradas

- Matriz de contas: casal_diretor > coordenador > logística > demais; gerir só cargo inferior (direção gere todos); suspender/excluir/definir senha só direção. Ajuste em `RANK`/`ROLE_GROUPS`.
- Escrita direta do navegador revogada em todas as tabelas de conteúdo (nenhum componente escrevia direto).
- Ônibus/motoristas restritos a gestores; `GET /api/media` exige sessão.
- E-mail via Resend HTTP; recuperação com cliente implícito + leitura de tokens no `#hash`, e `/auth/confirm` para `token_hash`.
- Exclusão física recusada quando há registros de inclusão/atendimentos/fotos vinculados (sugere suspensão).
- Layout salvo com `breakpoint = 'all'` (uma ordem para celular e desktop).
- Testes de `permissions.ts` foram escritos após o código (desvio de TDD).
