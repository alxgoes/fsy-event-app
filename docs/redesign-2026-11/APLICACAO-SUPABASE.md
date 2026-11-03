# Aplicação no Supabase — 02/11/2026

Projeto confirmado: **FSY**, `vhbmnnpgftrrovjtvbzo`, região `sa-east-1`, estado `ACTIVE_HEALTHY`. Execução autorizada pelo responsável nesta conversa, após a verificação da troca de cargos e do redesign.

## Cargos

O esquema já contém os sete cargos: jovem, consultor, mídia, equipe multidisciplinar, logística, coordenação e casal diretor. O servidor consulta o perfil protegido em cada requisição, sem conceder permissões por metadados editáveis do token. Os gatilhos `protect_profile_role` e `keep_enabled_administrator` estão habilitados; o último inclui logística entre os três cargos de gestão equivalentes.

## Migrações aplicadas

- `202611020001_profile_photo_review.sql`: campos e análise da foto, bucket privado e proteção de alterações. O cadastro começa sem foto publicada, mesmo quando os metadados de entrada tentam indicar uma foto aprovada. Fotos anteriores ao novo fluxo são preservadas pelo backfill.
- `202611020002_registration_authorization_adjustments.sql`: ajustes privados das autorizações e RPCs exclusivas do servidor. Antes da aplicação, a migração recebeu transação completa, reaplicação segura e ordem de travas compatível com importar/excluir lotes.

As tabelas de inscrições e dispositivos das migrações de 31/10 já existiam. Sua presença, colunas, RLS forçada e funções foram confirmadas pelo catálogo; DDL antigo não foi repetido.

O histórico remoto de migrações estava ausente. Depois de conferir 13 tabelas, 12 colunas, 14 funções, quatro gatilhos, 16 políticas e as restrições de perfil ativo, foram registradas as oito versões antigas como baselines de um esquema já existente. Isso registra a conferência atual; não reconstrói as datas originais de execução. Os dois IDs gerados pelo serviço para as migrações novas foram alinhados aos nomes locais, preservando seus SQLs registrados. O histórico final contém as dez versões locais, evitando reaplicação futura das regras antigas sobre as proteções novas. [Referência do reparo de histórico](https://supabase.com/docs/reference/cli/supabase-migration-repair).

## Agenda oficial

Foi salva uma cópia completa das 82 atividades anteriores fora do Git, em `_trabalho/logs/retomada-gpt/supabase-schedule-before.json`. Todos os itens antigos mantinham criação/alteração da carga inicial de agosto.

A substituição foi feita em transação, com bloqueio e conferência de que a agenda ainda correspondia à cópia. Foram inseridas **92 atividades** do `officialSchedule.ts`: dia 0 = 8; dia 1 = 18; dia 2 = 17; dia 3 = 20; dia 4 = 20; dia 5 = 9. A comparação integral por conteúdo retornou zero itens faltantes e zero extras. O filtro do jovem deixa 67 atividades visíveis. O primeiro dia mantém Roupa casual; os locais dos dias 1–5 seguem o manual e permanecem em branco até definição.

A sincronização recria os identificadores das atividades. Lembretes pessoais antigos, que usam esses identificadores, precisam ser marcados novamente. A confirmação na gestão agora informa que toda a programação será substituída, inclusive atividades criadas manualmente.

## Conferência posterior

- Contagens preservadas: seis contas Auth, seis perfis, quatro companhias e zero inscrições importadas. Agenda: 82 → 92.
- Bucket `profile-photos` privado, limite de 5 MiB, JPEG/PNG/WebP; nenhuma política pública de objetos do Storage.
- Tabela de ajustes com RLS habilitada e forçada, sem leitura/gravação por anon/authenticated; as duas RPCs novas executam somente com o papel do servidor.
- Três gatilhos de perfil habilitados: criação da foto, proteção do perfil e preservação da última gestão. A trava de importação antecede a meta e os registros.
- Avisos de segurança anteriores sobre funções de consulta do próprio perfil e proteção contra senhas vazadas permaneceram; a tabela privada nova gera apenas a indicação informativa de RLS sem políticas de navegador.

Somente contagens e catálogo foram consultados para perfis/inscrições. Nenhuma planilha real foi aberta, copiada ou enviada. Logs, cópia da agenda e preflight detalhado permanecem fora do repositório. Publicação do site e distribuição do APK são etapas separadas.
