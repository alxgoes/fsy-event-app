# Saneamento das políticas do projeto restaurado — 20/10/2026

## Situação verificada pelo coordenador

O Supabase `vhbmnnpgftrrovjtvbzo` estava pausado; o painel confirmou restauração concluída e estado Healthy. A inspeção SQL remota confirmou 12 tabelas públicas com RLS habilitada, Auth 6, profiles 6, companies 4, schedule_items 82, media_photos 4 e announcements 0. Nenhum dado foi recriado. A API publicada `/api/media` respondeu 200. Isso confirma disponibilidade e as contagens observadas, sem comprovar todas as operações ou a segurança das políticas.

A marca Google foi salva como **FSY Sessão Ribeirão Preto 2**, logo `public/icons/icon-512.png`, projeto `gen-lang-client-0100438624`. OAuth permanece em **Teste**, pendente lançamento geral. Não foi contratado domínio. Registro de recuperação do coordenador, fora do Git: `/Users/alexgoes/Documents/FSY/SUPABASE-RECUPERACAO-2026-10-20.md`.

## Deriva encontrada e risco

RLS habilitada não basta: políticas permissivas se combinam por OR. Foram encontradas políticas extras que as migrações anteriores, baseadas em nomes conhecidos, não eliminavam:

- `medical_records`: `ALL authenticated USING true`, expondo prontuários fora do grupo de saúde/direção.
- `transport_logistics`: política `ALL` para anon/authenticated com filtro de marcador e SELECT permissivo extra. O filtro sozinho não restringia os papéis.
- `announcements`: SELECT true extras, permitindo acesso a avisos de outras companhias.
- `counselor_audit_logs`: políticas históricas de INSERT/DELETE diretos, incluídas preventivamente na mesma limpeza.

Não há evidência de exploração ou perda de registros. A política permissiva é uma exposição confirmada; não inferir acesso indevido efetivo sem auditoria própria.

## Complemento local entregue

`supabase/migrations/202610200003_remote_policy_cleanup.sql`, preparado por Claude e integrado pelo GPT-6.1-Sol, executa em transação depois de `202610200001` e `202610200002`:

1. Remove todas as políticas das quatro tabelas, independentemente de nomes truncados/desconhecidos.
2. Mantém RLS habilitada, revoga acesso público/anônimo e escritas diretas autenticadas; concede SELECT autenticado e acesso do servidor via service_role.
3. Recria nove políticas da allowlist, incluindo a restrição de perfil ativo e a exclusão do armazenamento de atendimentos no transporte.
4. Verifica políticas fora da allowlist e grants excessivos; uma divergência aborta a transação.

| Tabela | Leitura direta autenticada | Escrita |
| --- | --- | --- |
| medical_records | médico, coordenação, casal diretor | somente API autorizada no servidor |
| transport_logistics | logística, coordenação, casal diretor; sem marcador de atendimentos | somente API autorizada no servidor |
| announcements | globais e própria companhia; gestão vê todos | somente API autorizada no servidor |
| counselor_audit_logs | coordenação, casal diretor, logística | somente servidor |

Perfis suspensos não passam na política restritiva. service_role preserva acesso para as APIs, que continuam responsáveis por autenticação, cargo e escopo. A decisão histórica de permitir logística na API médica permanece registrada como pendência de domínio; esta migração não amplia esse acesso no navegador.

A migração não executa DELETE, seed, reset ou recriação de contas. O teste verifica preservação de contagens e idempotência. Não confundir isso com backup remoto: exportação/snapshot e plano de retorno continuam sob controle do coordenador.

## Evidência de testes e aplicação

O handoff do Claude registrou **9/9 testes próprios** de `tests/remote-policy-cleanup.test.cjs` e **22/22 testes anteriores de banco** aprovados localmente. O novo teste reproduz primeiro o vazamento com dados fictícios; depois verifica allowlist exata, reaplicação, anonimato, papéis, suspensão, companhia, ausência de escrita direta, acesso service_role e cadeia completa de migrações. A suíte global serializada confirmou **145/145 testes**, incluindo estes nove casos; logs em `docs/evidencias-next16-2026-10-20/`.

**Confirmação remota posterior do coordenador:** bundle 001–003 comparado por hash com os arquivos e aplicado atomicamente, com status `FSY migrations 202610200001-003 applied`. As contagens anteriores permaneceram iguais; três tabelas novas, 15 políticas `active_profile_required`, nove políticas sensíveis exatas e `unexpected_grants = 0`.

O teste remoto com `SET LOCAL ROLE authenticated` e claims de um jovem real leu somente seu próprio perfil (1), agenda (82), companhias (4), fotos (4), zero eventos administrativos e não tinha UPDATE em medical_records/schedule_items. Nenhum registro foi alterado no teste. Isso comprova os casos executados, sem substituir uma matriz exaustiva de todos os cargos/fluxos.

O coordenador preservou snapshot JSON **privado, fora do Git**, com Auth users/identities e 12 tabelas públicas, além da inspeção de esquema/políticas/funções/grants/constraints. Esse snapshot **não é pg_dump nem backup completo de Storage**. Não versionar esse conteúdo.

O coordenador concluiu a aplicação remota e publicou o código 16b9a54 na main. A Vercel confirmou Production Ready; a CI da main 39492496466 passou. As 26 verificações públicas passaram, incluindo 401 em APIs privadas sem sessão, 403 para mutação de origem externa e Instagram conectado. Na sessão existente, contas e galeria carregaram; a ordem individual foi salva, conferida após recarregar e restaurada. A sequência operacional para futuras alterações é:

- preservar backup/exportação de banco e Auth e conferir histórico/esquema real;
- validar compatibilidade das APIs publicadas com escritas somente servidor e aplicar a cadeia necessária na ordem correta;
- comparar `pg_policies`/grants com a allowlist e confirmar contagens preservadas;
- testar negativamente anon, jovem, companhia alheia e perfil suspenso, e positivamente os grupos permitidos, usando identidades controladas;
- confirmar APIs após aplicação e implantação, sem enviar e-mails nem excluir contas reais como teste.

Não restaurar políticas permissivas antigas para contornar uma incompatibilidade. Uma reversão de código não desfaz banco; qualquer ajuste de política exige correção progressiva revisável, preservando os dados.

## E-mail e implantação

Redirect URLs Supabase foram conferidas pelo coordenador para produção/** e `/auth/callback`. SMTP customizado permanece OFF; o serviço de envio ainda depende de definição/configuração. Sem `RESEND_API_KEY` e `EMAIL_FROM`, a composição/envio individual do portal fica indisponível. Não houve envio real nem validação de entrega. OAuth Google permanece em Teste. O push e a implantação foram concluídos; evidências sem dados pessoais em docs/evidencias-publicacao-2026-10-20/. O usuário informou que ainda não possui serviço de envio. Não contratar nem ativar envio em massa sem a configuração correspondente.
