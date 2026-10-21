# FSY — Sessão Ribeirão Preto 2

Portal do evento de 2027 para jovens, consultores, saúde, mídia, logística e direção. Preparação da equipe em 05/02; participantes de 06 a 10/02/2027. Interface em português do Brasil.

Tema da sessão: **Alegrar-se em Cristo**.

Next.js 16.4.2 (App Router), React 19.3.1, TypeScript, Tailwind e Supabase (Auth/Postgres/RLS). O código local desta retomada não representa publicação ou recuperação do banco real.

## Desenvolvimento

Node 22 ou 24 e npm. Copie `.env.example` para `.env.local` e preencha somente com as credenciais do ambiente correto; nunca versione segredos.

```bash
npm ci
npm run dev
```

Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (somente servidor), `NEXT_PUBLIC_SITE_URL`; opcionais `NEXT_PUBLIC_BEHOLD_FEED_ID`, `RESEND_API_KEY`, `EMAIL_FROM`. Sem configuração de envio, o e-mail individual fica indisponível. O coordenador confirmou Supabase Healthy após retomada, Auth/perfis 6, companhias 4, agenda 82, fotos 4, avisos 0 e `/api/media` publicado 200, sem recriar dados. As migrações 001–003 foram aplicadas e verificadas pelo coordenador, sem alteração das contagens; implantação e checagem pós-deploy ainda ficam com o root; ver [segurança RLS](docs/seguranca-rls-recuperada.md).

## Verificação

```bash
npm run lint
npm test
npm run build
```

Os testes de banco executam migrações e RLS em PGlite com identidades fictícias. Não validam conexão, Auth ou SMTP do projeto real. `scripts/visual-qa/` contém um servidor falso de desenvolvimento; nunca o use como prova de autorização ou em produção.

## Operação e documentação

- [Manual funcional e design](docs/manual-funcional-e-design.md)
- [Plano e posição atual](implementation_plan.md)
- [Resultados reais](walkthrough.md)
- [Plano autorizado](docs/plano-implementacao-2026-10-20.md)
- [Dependências e migração do framework](docs/dependencias-2026-10-20.md)
- [Inclusão](docs/inclusao.md)

Antes de publicar, preservar/exportar banco e Auth, confirmar o projeto externo e conferir as migrações anteriores. A cadeia de segurança é `202610200001_security_hardening.sql` → `202610200002_account_safety.sql` → `202610200003_remote_policy_cleanup.sql`; o coordenador confirmou sua aplicação remota. Não reaplicar `schema.sql` sobre um banco migrado.

A atualização local do Next foi aplicada sem `--force`; a consulta registrada de dependências de produção retornou zero vulnerabilidades. Lint, tipos, 145 testes serializados e build com um worker passaram; a confirmação visual final será feita na CI, sem nota 20/20 presumida. O root cuida da publicação e da checagem após deploy. A primeira versão nativa para iPhone está em [ios/](ios/), com [instruções de execução](docs/ios/README.md) e [estado verificado](docs/ios/ENTREGA.md); o teste autenticado segue pendente. Instalação PWA pelo navegador continua disponível; não há app Android nativo nesta etapa.

Em Mac com 8 GB: uma tarefa pesada por vez; `npm test` limita arquivos a um por vez e o Next usa um worker. A CI executa lint, tipos, testes, audit de produção, build e QA/assert das 56 combinações; guarda artefatos por 7 dias. Sem provedor de e-mail confirmado, não considerar envio/recuperação de produção validados.
