# Dependências — 20/10/2026

A consulta real `npm audit --json` encontrou 25 pacotes sinalizados (2 críticos, 18 altos, 5 moderados) antes da reorganização. A CLI shadcn foi movida de produção para desenvolvimento, preservando sua faixa e versões previamente travadas; ela não é importada pelo runtime. Isso reduz o conjunto instalado com `--omit=dev`, mas não corrige por si só os advisories.

O Next 14.2.35 permanece na implementação. A consulta do registro encontrou a linha 15 até 15.5.28 e o audit sugeriu atualização principal; **não foi aplicado `npm audit fix --force`**. O resultado não deve ser apresentado como ambiente pronto para publicação irrestrita. Há advisories críticos de otimização de imagens e específicos de hospedagem Windows, além de DoS/cache; a aplicabilidade varia conforme a implantação. As rotas já possuem autorização no servidor, mas isso não corrige o framework.

## Migração delimitada recomendada

1. Em checkout isolado, selecionar a versão corrigida da linha suportada consultando novamente o [registro de avisos oficial](https://github.com/vercel/next.js/security/advisories) e a [política de suporte](https://nextjs.org/support-policy).
2. Atualizar Next e eslint-config-next juntos. Conferir compatibilidade de React, Supabase SSR e Node 22/24 antes de instalar, sem `--force`.
3. Tornar `cookies()` assíncrono em `src/lib/supabase/server.ts` e `/auth/callback`. Migrar `params` das rotas dinâmicas de contas/inclusão para Promise e aguardar antes do acesso. Adaptar os mocks de teste para o novo contrato.
4. Se a versão escolhida remover `next lint`, usar ESLint diretamente e migrar sua configuração; manter a execução obrigatória por `npm run lint`.
5. Rodar testes negativos, RLS local, lint, build, recuperação e QA autenticado. Comparar cookies, redirecionamentos, cache e geração estática.
6. Atualizar dependências transitivas compatíveis, repetindo audit somente após alterações. Não adicionar overrides de versão principal para ocultar achados.
7. Publicar apenas com snapshot do banco/Auth, migrações verificadas e possibilidade de retorno. Atualização de framework não recupera o Supabase indisponível.

Esta etapa entrega diagnóstico e roteiro de migração, conforme a pendência “planejar sem --force” do checkpoint. A migração principal e a ausência de advisories permanecem pendentes.
