# Acompanhamento de inclusão

Em **Registros & Atendimentos → Inclusão**, a equipe registra o acompanhamento do jovem e as conversas com seus responsáveis.

## Uso

1. Selecione **Novo acompanhamento**. Vincule uma ficha médica existente ou cadastre um participante sem conta de login.
2. Informe necessidades/dificuldades, apoios e contatos do responsável e do bispo/presidente de ramo. Nome e contatos são compartilhados com a ficha médica; os contatos adicionais existentes são preservados.
3. Atualize a fase do processo: triagem, contato, entrevistas ou análise.
4. Registre cada entrevista com data e horário, participantes, situação e resumo da equipe. Uma entrevista realizada exige resumo.
5. Registre a decisão da equipe com justificativa: participação confirmada, participação com apoio ou participação não recomendada. Participação com apoio exige um plano. O sistema não toma essa decisão automaticamente.
6. Consulte o histórico com autor e data. Arquivar preserva o acompanhamento e a decisão; não apaga a ficha médica.

Os perfis atuais `medico`, `coordenador`, `casal_diretor` e `logistica` mantêm o acesso ao painel de saúde. O novo módulo não cria perfil de autenticação para o jovem, não altera sua companhia e não o inscreve automaticamente no evento.

## Persistência e integração

- Tabelas: `inclusion_cases`, `inclusion_interviews`, `inclusion_history`, com vínculo único a `medical_records`.
- Alterações são transacionais e registram a identidade autenticada no servidor.
- Cada acompanhamento tem versão. Se outra pessoa editar o caso ou os contatos da ficha, um formulário antigo recebe conflito e precisa ser recarregado.
- Fichas com inclusão não podem ser apagadas por cascata. A decisão e as entrevistas ficam preservadas.
- Dados de inclusão não são armazenados em localStorage nem no cache do service worker. Salvar e consultar exige conexão.
- Agendamentos médicos usam `medical_appointments`; notificações dos jovens mostram somente seus próprios agendamentos, sem notas internas.

## Migrações

Aplicadas ao projeto Supabase FSY em 09/09/2026, nesta ordem:

1. `supabase/migrations/202609090001_inclusion_workflow.sql`
2. `supabase/migrations/202609090002_private_medical_appointments.sql`

A segunda migração copia o armazenamento legado de agendamentos para a tabela privada, mantendo integralmente o conteúdo original como backup restrito. Nenhum campo legado foi apagado. O registro técnico não aparece nem pode ser alterado pelas APIs de logística.

Em outro ambiente, revise e aplique os SQLs antes de publicar a versão do código. A primeira migração deve ser aplicada uma única vez. Não execute novamente a migração de dados legados em produção como forma de restaurar agendamentos antigos.

## Validação

`npm.cmd run lint` e `npm.cmd run build` aprovados. `node --test tests/*.test.cjs`: 32 testes aprovados, incluindo contratos, permissões, vínculo médico, versões e isolamento de agendamentos.

`supabase/tests/inclusion-workflow.sql` foi executado no banco com sucesso. O teste cria somente registros fictícios em uma transação e termina em `ROLLBACK`: valida criação sem login, duplicidade, FK, entrevistas, decisão humana, histórico, sincronização de contatos, conflito de versão e arquivamento. Não deixa participantes de teste salvos.
