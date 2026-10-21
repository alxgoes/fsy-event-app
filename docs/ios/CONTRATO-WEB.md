# Contrato web/Supabase necessário para o app iOS

O app usa as políticas RLS publicadas (migrações 001–004), sem nova migração. O root cadastrou, com confirmação humana específica, o retorno OAuth descrito no item 1. Os demais contratos abaixo permanecem pendentes ou registram limitações conhecidas.

## O que o app usa hoje sem mudança

| Uso | Endpoint | Autorização |
| --- | --- | --- |
| Entrar, cadastrar, renovar, sair | Supabase Auth `/auth/v1/token?grant_type=password|refresh_token`, `/signup`, `/logout?scope=local` | chave publicável + JWT da pessoa |
| Perfil próprio | `GET /rest/v1/profiles?id=eq.<uid>` | `profiles_self_read` |
| Companhia | `GET /rest/v1/companies?id=eq.<id>` | leitura autenticada |
| Programação | `GET /rest/v1/schedule_items` | leitura autenticada |
| Avisos | `GET /rest/v1/announcements?select=…,profiles!author_id(full_name,role)` | `announcements_scoped_read` (igual a GET /api/announcements) |
| Próprias curtidas | `GET /rest/v1/announcement_likes?user_id=eq.<uid>` | `announcement_likes_own_read` |
| Recuperar senha | `POST https://fsy-event-app.vercel.app/api/auth/recover` | público; requisição nativa não envia `Origin`, aceita por `isSameOriginRequest` |

Diferença conhecida: o autor do aviso só aparece quando o RLS de `profiles` permite (própria pessoa, gestão, saúde, consultor da companhia). A API web usa service_role e mostra todos os autores.

## 1. Google OAuth — Redirect URL (configuração do Supabase, sem código)

O app usa PKCE com `ASWebAuthenticationSession` (sessão efêmera do sistema):

- `GET https://vhbmnnpgftrrovjtvbzo.supabase.co/auth/v1/authorize?provider=google&redirect_to=fsyrp2://auth-callback&code_challenge=<S256>&code_challenge_method=s256`
- retorno `fsyrp2://auth-callback?code=<code>` → `POST /auth/v1/token?grant_type=pkce` com `{auth_code, code_verifier}`.

**Configurado pelo root em 20/10/2026:** `fsyrp2://auth-callback` foi acrescentado em Supabase → Authentication → URL Configuration → Redirect URLs após confirmação humana específica. A lista passou de quatro para cinco URLs, preservando as anteriores e a Site URL. O humano concluiu o login Google e voltou ao app; root observou o Início nativo e a sessão preservada após reabrir. Em outro projeto, é necessário repetir essa configuração; sem ela o retorno vai para o portal. O OAuth do Google segue em modo **Teste**: só e-mails de teste cadastrados entram. O callback do Google continua sendo o do Supabase.

## 2. Curtir aviso pelo app (mudança de código web)

`POST /api/announcements/like` resolve a identidade só por cookie (`createServerClient` + `getCurrentIdentity`), e `announcement_likes` não tem permissão de escrita para `authenticated`. Por isso o app **mostra** "Você curtiu", mas não alterna curtidas.

Contrato proposto (opção A, preferida):

- `getCurrentIdentity()` aceita também `Authorization: Bearer <access_token do Supabase>`: validar com `supabase.auth.getUser(token)` e seguir a mesma leitura de `profiles`/`suspended_at`.
- `src/proxy.ts`: para `/api/*` com `Authorization: Bearer`, validar o token do mesmo modo em vez de exigir cookie.
- Mutação nativa sem `Origin` já passa em `isSameOriginRequest`; manter a regra de recusar `Origin` divergente.
- Resposta inalterada: `{ success, is_liked, likes_count }`.

Opção B: RPC `toggle_announcement_like(p_announcement_id uuid)` `SECURITY DEFINER`, `auth.uid()` como dono, `GRANT EXECUTE TO authenticated`, verificando que o aviso é visível pela mesma regra de `announcements_scoped_read`. Exige nova migração.

## 3. Push remoto (APNs) — não implementado

Lembretes atuais são **locais**. Avisos novos em tempo real exigiriam: chave APNs (.p8) de um Team pago, tabela `device_push_tokens (user_id, token, environment, updated_at)` com RLS própria, gravação via API autenticada, envio pelo servidor ao publicar aviso (respeitando o escopo da companhia) e remoção do token no logout. Nada disso existe; o app não registra token APNs.

## 4. Realtime — não usado

O app atualiza ao abrir, ao voltar ao primeiro plano (após 30 s), ao entrar e ao puxar para atualizar. Supabase Realtime exigiria publicação das tabelas e revisão das políticas para `postgres_changes`; fica para uma decisão posterior.

## 5. Universal Links — não usado

Links internos usam o esquema `fsyrp2://` com allowlist. Universal Links (`https://fsy-event-app.vercel.app/...` abrindo o app) exigiriam `/.well-known/apple-app-site-association` publicado pelo portal com o Team ID e o Bundle ID definitivos.

## 6. Embed ambíguo announcements → profiles

Comprovado pelo app em 20/10/2026: `GET /rest/v1/announcements?select=…,profiles(full_name,role)` → **HTTP 300 `PGRST201`**. Depois da migração 001, `announcement_likes` (PK `(announcement_id, user_id)`, FKs para `announcements` e `profiles`) é um segundo caminho além de `announcements.author_id`. O app iOS passou a usar `profiles!author_id(...)`.

O web usa o embed sem dica em `src/app/api/announcements/route.ts` (`SELECT`) e `src/components/admin/AnnouncementsManager.tsx`. É **muito provável** que esses pontos falhem do mesmo jeito; não verifiquei no site. Correção sugerida, sem migração nem mudança de RLS: `profiles!author_id(full_name, role)` e `profiles!author_id(full_name)`. A chave da resposta continua `profiles`.
