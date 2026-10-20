# Requisições, concorrência e custos — 20/10/2026

Escopo: leituras do painel do jovem feitas no navegador (agenda, companhia, fotos, avisos). Implementação da camada: Claude Opus 5.5. Integração e validação global: GPT-6.1-Sol, após handoff.

## O que mudou

- `src/lib/requests/core.ts` (sem dependências): `createLimiter` (teto de tarefas simultâneas, fila FIFO curta e limitada, timeout que conta fila + execução, cancelamento por `AbortSignal`) e `createRequestCache` (deduplicação em voo por chave, cache curto opcional por TTL, `invalidate(prefixo)`, `clear()`).
- `src/lib/requests/client.ts`: instância **por aba** — 4 leituras simultâneas, fila de 24, timeout de 12 s, até 50 entradas. `sessionScope()` devolve o id da conta da sessão (ou `anon`) e escuta `onAuthStateChange` (evento local do supabase-js, sem WebSocket) para descartar o cache e abortar buscas em voo quando a conta muda. `fetchJson` (com `cache: "no-store"`, pois o TTL é controlado aqui) e `allowsDirectFallback`.
- Serviços (contratos públicos e armazenamento offline mantidos):
  - chave sempre `recurso:<conta>:<companhia|dia>`; TTL: agenda 60 s, fotos 60 s, companhia 60 s, avisos 20 s;
  - curtir aviso chama `invalidateRequests("announcements:")`;
  - removidos os cache busters `?_t=Date.now()` de fotos e avisos;
  - a consulta direta ao Supabase só acontece quando a API responde **5xx**. Com 401/403/404/429, rede indisponível, timeout ou cancelamento, vai direto ao armazenamento offline (e, na agenda, à agenda oficial estática). Antes, qualquer falha (inclusive autorização negada e "sem rede") disparava uma segunda chamada ao banco;
  - consultas diretas e `fetch` recebem o sinal de cancelamento (`abortSignal`). Os quatro serviços aceitam `AbortSignal` opcional, sem alterar seus retornos. O efeito do `YouthDashboard` cria um controlador e o aborta no cleanup, preservando a proteção contra atualização após desmontagem.
- Fora do navegador (`typeof window === "undefined"`) não há cache nem fila: evita guardar dados de um usuário na memória de uma instância serverless compartilhada.

## O que deliberadamente não entra na fila nem no cache

- Login, recuperação de senha, escritas (curtir, salvar layout), escrita clínica e urgências: vão direto, sem fila. A fila só atende leituras destes quatro serviços.
- Dados médicos/inclusão, autorização e tokens: nunca guardados por esta camada. A autorização continua sendo decidida pelo servidor a cada requisição; o escopo da conta na chave serve só para **separar** dados, não para autorizar.
- Falhas não ficam em cache (sem cache negativo): a próxima chamada tenta de novo.

## Testes (reais, locais)

- `node --test tests/request-core.test.cjs` → 9/9: deduplicação em paralelo; contas diferentes não compartilham; teto de concorrência com fila escoando; fila cheia recusa na hora; timeout na fila não inicia a tarefa e timeout em execução aborta o sinal e libera a vaga; falha entregue a todos e não cacheada; cancelar um assinante não aborta os demais, cancelar todos aborta a busca; TTL/invalidação por prefixo/sem TTL só deduplica; `clear()` aborta em voo e resposta atrasada da sessão anterior não volta ao cache.
- `node --test tests/request-services.test.cjs` → 8/8: uma requisição para chamadas paralelas iguais, URL sem `_t`; 401/403 sem consulta direta ao banco; sem rede usa offline sem Supabase; 5xx faz um único fallback deduplicado; troca de conta descarta cache; curtida invalida avisos; companhia deduplicada, cancelável e isolada por conta; agenda/fotos deduplicadas com contrato mantido.
- `tsc` restrito aos arquivos alterados e `eslint` nesses arquivos: sem erros. Build, lint e suíte globais **não** foram rodados aqui (o Sol está migrando Next/ESLint em paralelo).

## Medição local (simulada, não é produção)

Cenário: painel montado duas vezes ao mesmo tempo (ex.: StrictMode em dev ou dois componentes) e reaberto segundos depois — 12 chamadas de serviço. Rede e Supabase simulados, contando chamadas:

| Cenário | Antes (HEAD) | Depois |
| --- | --- | --- |
| API respondendo 200 | 9 à API + 3 diretas ao Supabase | 3 à API + 1 direta (companhia) |
| API respondendo 401 | 9 à API + 12 diretas ao Supabase | 6 à API + 0 diretas por avisos/fotos/agenda (1 da companhia, que é leitura direta por desenho) |

No 401 a terceira abertura repete as chamadas porque falhas não são cacheadas, de propósito.

## Limitações honestas

- A fila e o cache são **por aba/instância**. Não existe fila global entre usuários; 300 jovens abrindo o app ao mesmo tempo continuam gerando, cada um, as suas requisições. O ganho é cortar duplicatas e cascatas dentro de cada aba.
- O supabase-js fala HTTP com o PostgREST, que já usa pool de conexões no lado do Supabase (https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers). Ter um cliente HTTP singleton **não prova** menos conexões no Postgres; não adicionamos driver Postgres nem WebSocket.
- O cache curto pode mostrar um aviso novo com até 20 s de atraso (60 s para agenda/fotos/companhia) na mesma aba, salvo quando o próprio usuário curte (invalidação imediata).
- Nada aqui elimina cotas ou custos; reduz chamadas desnecessárias.

## Requisições de API x cotas

- No Supabase, as requisições à API REST não são o item cobrado por contagem nos planos atuais; o que tem cota é tráfego de saída (egress), usuários ativos mensais do Auth, tamanho do banco e do Storage e o compute da instância (CPU/memória/conexões). Menos chamadas repetidas reduzem egress e carga de compute, não "requisições cobradas". Conferir os números do plano no painel antes de prometer limites.
- Na Vercel, cada chamada a `/api/*` é uma invocação de função (com tempo de execução e tráfego contabilizados no plano). A deduplicação no navegador reduz invocações; cada invocação ainda faz sua própria verificação de sessão.

## Sugestões para outros donos (não editadas por mim)

1. **Integrado:** `YouthDashboard.tsx` repassa `AbortController.signal` aos quatro serviços e cancela no cleanup. Um teste adicional cancela as quatro leituras em voo e comprova sinais abortados, sem fallback remoto extra.
2. Rotas `/api/*` (Backend): avaliar `Cache-Control: private, max-age=0` explícito nas leituras autenticadas, para nenhum proxy guardar resposta por usuário.
3. `src/services/offlineCache.ts`: a varredura de chaves legadas roda a cada chamada; pode ser feita uma vez por aba (custo só local).
4. Outros serviços/telas administrativas que leem listas grandes podem adotar `cachedRequest` com chave por conta — **exceto** dados médicos/inclusão, que devem continuar sem cache.
5. O coordenador confirmou o projeto restaurado e online e verificou contagens (Auth 6, perfis 6, companhias 4, agenda 82, fotos 4, avisos 0), sem recriar dados. O coordenador confirmou aplicação atômica de 001–003, allowlist/grants e leitura isolada do jovem, sem alterar registros. Concorrência real entre conexões independentes ainda não foi exercitada. Este lote usa apenas fixtures locais.

## Arquivos alterados nesta tarefa

- `src/lib/requests/core.ts` (novo)
- `src/lib/requests/client.ts` (novo)
- `src/services/scheduleService.ts`
- `src/services/companyService.ts`
- `src/services/mediaService.ts`
- `src/services/announcementsService.ts`
- `tests/request-core.test.cjs` (novo)
- `tests/request-services.test.cjs` (novo)
- `docs/requisicoes-e-custos.md` (este)

## Integração final

O Sol integrou `AbortSignal` opcional e cleanup do painel. **145/145 testes globais serializados** passaram, incluindo 18 da camada/serviços (os 17 originais e o cancelamento do painel); lint, tipos e build final Next 16 também passaram. O teste PWA foi confirmado separadamente após mudar o cache para v3. A confirmação visual final ficou na CI por instrução do usuário para poupar o Mac. Sem novo agente ou revisão Astra.
