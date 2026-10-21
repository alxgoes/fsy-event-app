# Contrato web/Supabase necessário para o app iOS

O app usa as políticas RLS publicadas (migrações 001–004), sem nova migração. O root cadastrou, com confirmação humana específica, o retorno OAuth descrito no item 1. A administração nativa usa as mesmas APIs do site com autenticação Bearer (commit df9e30d; publicado em produção). As limitações restantes estão identificadas abaixo.

## O que o app usa hoje sem mudança

| Uso | Endpoint | Autorização |
| --- | --- | --- |
| Entrar, cadastrar, renovar, sair | Supabase Auth `/auth/v1/token?grant_type=password|refresh_token`, `/signup`, `/logout?scope=local` | chave publicável + JWT da pessoa |
| Perfil próprio | `GET /rest/v1/profiles?id=eq.<uid>` | `profiles_self_read` |
| Companhia | `GET /rest/v1/companies?id=eq.<id>` | leitura autenticada |
| Programação | `GET /rest/v1/schedule_items` | leitura autenticada |
| Avisos | `GET /rest/v1/announcements?select=…,profiles!author_id(full_name,role)` | `announcements_scoped_read` (igual a GET /api/announcements) |
| Próprias curtidas | `GET /rest/v1/announcement_likes?user_id=eq.<uid>` | `announcement_likes_own_read` |
| Instagram (galeria) | `GET https://fsy-event-app.vercel.app/api/instagram` | público, sem token |
| Administração nativa | `/api/admin/*`, `/api/companies`, `/api/schedule`, `/api/logistics`, `/api/announcements`, `/api/media`, `/api/medical/*`, `/api/inclusion/*`, `/api/users` | Bearer validado pelo Auth; cargo, suspensão e escopo conferidos no banco (seção 7) |
| Recuperar senha | `POST https://fsy-event-app.vercel.app/api/auth/recover` | público; requisição nativa não envia `Origin`, aceita por `isSameOriginRequest` |

Diferença conhecida: o autor do aviso só aparece quando o RLS de `profiles` permite (própria pessoa, gestão, saúde, consultor da companhia). A API web usa service_role e mostra todos os autores.

## 1. Google OAuth — Redirect URL (configuração do Supabase, sem código)

O app usa PKCE com `ASWebAuthenticationSession` (sessão efêmera do sistema):

- `GET https://vhbmnnpgftrrovjtvbzo.supabase.co/auth/v1/authorize?provider=google&redirect_to=fsyrp2://auth-callback&code_challenge=<S256>&code_challenge_method=s256`
- retorno `fsyrp2://auth-callback?code=<code>` → `POST /auth/v1/token?grant_type=pkce` com `{auth_code, code_verifier}`.

**Configurado pelo root em 20/10/2026:** `fsyrp2://auth-callback` foi acrescentado em Supabase → Authentication → URL Configuration → Redirect URLs após confirmação humana específica. A lista passou de quatro para cinco URLs, preservando as anteriores e a Site URL. O humano concluiu o login Google e voltou ao app; root observou o Início nativo e a sessão preservada após reabrir. Em outro projeto, é necessário repetir essa configuração; sem ela o retorno vai para o portal. O OAuth do Google segue em modo **Teste**: só e-mails de teste cadastrados entram. O callback do Google continua sendo o do Supabase.

## 2. Curtir aviso pelo app

O suporte Bearer em `getCurrentIdentity()` e no proxy também atende `POST /api/announcements/like`, com a mesma regra de companhia e resposta `{ success, is_liked, likes_count }`. Nenhuma migração ou escrita direta em `announcement_likes` foi liberada. A interface nativa de avisos ainda exibe as curtidas em modo de leitura; habilitar a ação nela é trabalho separado da substituição administrativa.

## 3. Push remoto (APNs) — não implementado

Lembretes atuais são **locais**. Avisos novos em tempo real exigiriam: chave APNs (.p8) de um Team pago, tabela `device_push_tokens (user_id, token, environment, updated_at)` com RLS própria, gravação via API autenticada, envio pelo servidor ao publicar aviso (respeitando o escopo da companhia) e remoção do token no logout. Nada disso existe; o app não registra token APNs.

## 4. Realtime — não usado

O app atualiza ao abrir, ao voltar ao primeiro plano (após 30 s), ao entrar e ao puxar para atualizar. Telas administrativas ativas também atualizam a cada 60 segundos e após uma escrita confirmada; os formulários mantêm seus rascunhos. Supabase Realtime exigiria publicação das tabelas e revisão das políticas para `postgres_changes`; fica para uma decisão posterior.

## 5. Universal Links — não usado

Links internos usam o esquema `fsyrp2://` com allowlist. Universal Links (`https://fsy-event-app.vercel.app/...` abrindo o app) exigiriam `/.well-known/apple-app-site-association` publicado pelo portal com o Team ID e o Bundle ID definitivos.

## 6. Embed ambíguo announcements → profiles

Comprovado pelo app em 20/10/2026: `GET /rest/v1/announcements?select=…,profiles(full_name,role)` → **HTTP 300 `PGRST201`**. Depois da migração 001, `announcement_likes` (PK `(announcement_id, user_id)`, FKs para `announcements` e `profiles`) é um segundo caminho além de `announcements.author_id`. O app iOS passou a usar `profiles!author_id(...)`.

Corrigido no web (commit 4b77a59): `src/app/api/announcements/route.ts` usa `profiles!author_id(full_name, role)` e `src/components/admin/AnnouncementsManager.tsx` usa `profiles!author_id(full_name)`. A chave da resposta continua `profiles`. Sem migração ou mudança de RLS.

## 7. Administração nativa — mesmas APIs, sem painel web

Contrato em `src/types/native-auth.ts`, parser/allowlist em `src/lib/auth/bearer.ts`, identidade em `src/lib/supabase/server.ts`. Publicado no commit **df9e30d**, CI 39534915761 aprovado e deployment Production 7216515468 concluído.

- O iPhone envia `Authorization: Bearer <access_token>` em HTTPS, sem cookies e sem identidade em query/URL. Somente a chave pública Supabase pode existir no app; `service_role` permanece exclusivamente no servidor.
- O proxy aceita Bearer somente nos prefixos de API permitidos. `getCurrentIdentity()` e `getCurrentUserAndRole()` validam o token no Auth e consultam o perfil protegido, incluindo suspensão, em cada requisição. Cargo informado no corpo ou em metadados não concede permissão.
- Authorization presente e inválida (inclusive vazia) falha fechada; nunca reaproveita uma sessão de cookie de outra pessoa. A autenticação por cookie continua atendendo o site.
- As regras de acesso, companhia, matriz de gestão de contas e proteção do último administrador continuam nos handlers existentes. A ausência de Origin no cliente nativo é aceita; Origin de outro site continua bloqueada.
- Respostas privadas usam `private, no-store` e `Vary: Cookie, Authorization`.
- `GET /api/admin/overview` fornece contagens para Logística, Coordenação e Casal Diretor, sem conteúdo de prontuário.
- A ponte intermediária `POST/DELETE /api/auth/native-session`, seus cookies WebKit e o marcador de user agent foram removidos: a entrega administrativa final será SwiftUI com chamadas às APIs.

Dados administrativos e de saúde devem permanecer apenas em memória no app e ser descartados ao sair/trocar de conta. As escritas só mostram sucesso após confirmação do servidor. Sem fila de alterações administrativas offline.
