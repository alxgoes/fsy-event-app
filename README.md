# FSY — Sessão Ribeirão Preto 2

Portal do evento de 2027 para jovens, consultores, saúde, mídia, logística e direção. Preparação da equipe em 05/02; participantes de 06 a 10/02/2027. Interface em português do Brasil.

Next.js App Router, React, TypeScript, Tailwind e Supabase (Auth/Postgres/RLS). O código local desta retomada não representa publicação ou recuperação do banco real.

## Desenvolvimento

Node 22 ou 24 e npm. Copie `.env.example` para `.env.local` e preencha somente com as credenciais do ambiente correto; nunca versione segredos.

```bash
npm ci
npm run dev
```

Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (somente servidor), `NEXT_PUBLIC_SITE_URL`; opcionais `NEXT_PUBLIC_BEHOLD_FEED_ID`, `RESEND_API_KEY`, `EMAIL_FROM`. Sem configuração de envio, o e-mail individual fica indisponível. O host do exemplo é histórico e precisa ser confirmado pelo responsável.

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

Antes de publicar, preservar/exportar banco e Auth, confirmar o projeto externo e conferir as migrações anteriores. As novas migrações são `202610200001_security_hardening.sql` e `202610200002_account_safety.sql`, nessa ordem. Não reaplicar `schema.sql` sobre um banco migrado.

O Next 14 possui advisories conhecidos; há um plano de atualização sem `--force`. Auditoria visual e testes locais não eliminam essa pendência nem comprovam conformidade integral. Aplicativos nativos Android/iOS estão fora desta etapa; instalação PWA usa o navegador.
