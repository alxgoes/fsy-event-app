# Atualização 11/11/2026 — arquitetura e contratos (definidos pelo orquestrador)

Branch: `feat/whatsapp-fotos-enquadramento-2026-11` (a partir de `main`). Base: web 216 testes verdes, Android 1.2.1 (4).
Autoridades: `DESIGN.md`, `docs/redesign-2026-11/ESPECIFICACAO.md`. Este arquivo é o contrato entre site, PWA e Android.

## 1. Foto de perfil não funcionava no Android — causa raiz (já corrigida no servidor)
`src/proxy.ts` só aceita `Authorization: Bearer` nas rotas de `BEARER_API_PREFIXES` (`src/types/native-auth.ts`).
`/api/profile` não estava na lista → o app recebia 401 em GET/POST/DELETE `/api/profile/photo` e em `/reviews` e `/company`.
O orquestrador já adicionou `"/api/profile"`. Falta: teste de regressão e garantir que isso não se repita (item 4).

## 2. Link do grupo de WhatsApp da companhia

### Regras
- Cada companhia tem **no máximo um** link de convite. Quem vê: jovens e consultores **daquela companhia** e a gestão
  (coordenador, casal_diretor, logistica = grupo `companyManagers`). Ninguém de outra companhia vê.
- Quem edita (adicionar, trocar, remover): consultor **só da própria companhia** (`profile.company_id`); gestão em qualquer companhia.
  Cargo e companhia vêm sempre do perfil protegido no servidor, nunca do cliente.
- A tabela `companies` é legível por qualquer autenticado, então o link **não** pode morar nela. Vai em tabela própria, só servidor.
- Só aceita convite oficial: `https://chat.whatsapp.com/<código>` (código `[A-Za-z0-9]{16,32}`; aceitar e descartar `?query`,
  `/invite/` e espaços; rejeitar qualquer outro host, `http://`, `wa.me`, encurtadores). Guardar a forma canônica `https://chat.whatsapp.com/<código>`.
- Toda alteração gera registro em `counselor_audit_logs` (mesmo padrão do lema da companhia), **sem gravar o link no log** (só "adicionou/alterou/removeu").

### Banco — migração nova `supabase/migrations/202611110001_company_whatsapp_links.sql` (idempotente, aditiva)
```sql
CREATE TABLE IF NOT EXISTS public.company_whatsapp_links (
  company_id text PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,  -- conferir o tipo real de companies.id
  invite_url text NOT NULL CHECK (invite_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{16,32}$'),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_whatsapp_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_whatsapp_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_whatsapp_links FROM anon, authenticated;   -- nenhuma policy: só service_role
```
Seguir o estilo das migrações existentes (BEGIN/COMMIT, `NOTIFY pgrst, 'reload schema'`).

### Tipos — `src/types/company-whatsapp.ts` (contrato; Zod + interfaces)
```ts
export interface CompanyWhatsappLink {
  company_id: string;
  company_name: string;
  invite_url: string | null;      // null = ainda não cadastrado
  can_edit: boolean;              // calculado no servidor para quem pediu
  updated_at: string | null;
  updated_by_name: string | null; // só para quem pode editar; jovem recebe null
  has_counselor: boolean;         // só gestão usa (alerta "companhia sem consultor")
}
export const companyWhatsappUpdateSchema = z.object({
  company_id: companyIdSchema,
  invite_url: z.string().trim().max(200).nullable(),  // null remove
});
export function normalizeWhatsappInvite(raw: string): string | null  // canônico ou null se inválido
```

### API — `src/app/api/companies/whatsapp/route.ts` (prefixo `/api/companies` já é aceito com Bearer)
- `GET /api/companies/whatsapp` → `{ data: CompanyWhatsappLink[] }`
  - jovem e consultor: lista com 0 ou 1 item (a própria companhia; sem companhia → `[]`).
  - gestão: todas as companhias, ordenadas por nome (inclui as sem link, `invite_url: null`).
  - demais cargos (mídia, médico): `[]`.
- `PUT /api/companies/whatsapp` body `{ company_id, invite_url | null }` → `{ data: CompanyWhatsappLink }`
  - mesma origem (`isSameOriginRequest`), `requireIdentity()`, consultor fora da própria companhia → **404** (não revela existência),
    jovem/mídia/médico → 403, link inválido → 400 com mensagem pt-BR ("Cole o link de convite do grupo, no formato https://chat.whatsapp.com/…").
  - limite simples de tentativas por usuário (`createRateLimiter`).
- Respostas `no-store` (helper `json`). Erros internos via `serverError`.

### Interface (web + PWA)
- **Jovem — Início, cartão "Minha companhia"** (`YouthDashboard.tsx`): quando há link, botão de largura total
  **"Entrar no grupo da companhia"** (ícone de mensagem, `target="_blank" rel="noopener noreferrer"`), abaixo dos consultores.
  Sem link: nada aparece (sem "em breve"). Também aparece em `/mais`, na seção Evento, como linha "Grupo da companhia no WhatsApp".
- **Consultor — `/consultor`**: bloco "Grupo do WhatsApp" logo abaixo do título da companhia: mostra estado (sem link / link cadastrado
  + "Abrir grupo"), botão "Adicionar link" / "Trocar link" abre diálogo com campo, validação imediata, "Salvar" e "Remover link" (com confirmação).
- **Gestão — `/admin/companies`** (`CompanyManager.tsx`): em cada companhia, linha "Grupo do WhatsApp" com o mesmo diálogo de edição;
  selo de alerta **"Sem consultor designado"** nas companhias sem nenhum consultor (`has_counselor=false`) e um resumo no topo
  ("2 companhias sem consultor"). Não bloquear nada: é alerta.
- Estilo: componentes e tokens existentes; botão do jovem em azul primário (não usar verde de marca do WhatsApp nem logotipo de terceiros).

### Android (mesmo contrato)
- `PortalApiClient`: `fetchCompanyWhatsapp(session)` e `saveCompanyWhatsapp(session, companyId, inviteUrl?)`.
- Jovem: botão no cartão "Minha companhia" (Início) e linha em Mais; abre com `Intent.ACTION_VIEW` **somente** se a URL casar com
  `^https://chat\.whatsapp\.com/[A-Za-z0-9]{16,32}$` (validar de novo no app). Guardar no cache offline junto da companhia; limpar no logout.
- Consultor: bloco no painel do consultor com adicionar/trocar/remover. Gestão: no módulo Companhias. Jovem nunca vê controles de edição.

## 3. Escopo do consultor (verificar e cobrir com testes; corrigir se achar furo)
Consultor só enxerga e comanda a companhia em que está designado: jovens, recados, fotos para aprovar, fotos da companhia, lema, link do WhatsApp.
Sem companhia designada → painel vazio com explicação, nenhuma lista. Conferir rotas `/api/announcements` (POST/DELETE), `/api/companies` (PUT lema),
`/api/profile/photo/reviews`, `/api/profile/photo/company`, `/api/companies/whatsapp` e as políticas RLS de `profiles` para consultor.
Gestão (coordenador, casal_diretor, logistica) acessa todas.

## 4. Paridade site ↔ app (para o problema do item 1 não voltar)
Teste automatizado que lê `android/app/src/main/java/**/PortalApiClient.kt`, extrai todo `"$portalBaseUrl/api/..."` e falha se algum caminho
não for coberto por `BEARER_API_PREFIXES` (exceções explícitas: rotas públicas como `/api/auth/recover`, `/api/instagram`, `/api/app-release`).

## 5. Enquadramento (texto fora de caixa/botão)
Nenhum texto pode vazar, cortar ou sobrepor em nenhuma tela. Regras: rótulos de botão quebram linha (máx. 2) e o botão cresce em altura;
em linhas com vários botões, empilhar quando não couber (FlowRow/Column no Android, `flex-wrap` no web); nada de altura fixa em contêiner de texto;
`min-w-0`/`weight(1f)` em textos ao lado de ícones. Larguras a verificar: Android 320, 360, 393, 412 dp × fonte 1.0, 1.3 e 2.0, claro e escuro;
web 320, 360, 390, 768, 1280 px × fonte 100 % e 200 %.
Bug conhecido (Android, Gestão › Inscrições — tela de importar planilha/baixar fichas em PDF): rótulo de um botão sai da caixa em telas estreitas.
