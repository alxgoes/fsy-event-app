-- Run after both migrations. Every synthetic row is rolled back, including on failure.
-- This script does not print participant or staff identities.
BEGIN;
DO $$
DECLARE
  actor uuid;
  case_data jsonb;
  record_id uuid;
  test_case_id uuid;
  interview_id uuid;
  before_version integer;
  failed_as_expected boolean;
  contacts jsonb := '{"parent":{"name":"Responsável de teste","phone":"","relationship":"Responsável","ward":""},"bishop":{"name":"Contato de teste","phone":"","relationship":"","ward":""}}'::jsonb;
BEGIN
  SELECT id INTO actor FROM public.profiles
  WHERE role::text IN ('medico','coordenador','casal_diretor','logistica') ORDER BY id LIMIT 1;
  ASSERT actor IS NOT NULL, 'Teste precisa de um perfil de equipe já existente.';

  ASSERT NOT has_function_privilege('authenticated','public.mutate_inclusion(text,uuid,jsonb,uuid,uuid)','EXECUTE'), 'RPC não pode ser chamada diretamente pelo navegador.';
  ASSERT NOT has_table_privilege('authenticated','public.inclusion_cases','INSERT'), 'Escritas diretas devem estar bloqueadas.';
  ASSERT NOT has_table_privilege('authenticated','public.medical_appointments','UPDATE'), 'Agendamentos devem usar API protegida.';

  case_data := public.mutate_inclusion('create',actor,jsonb_build_object(
    'new_record',jsonb_build_object('full_name','[TESTE TRANSACIONAL INCLUSAO]'),
    'needs','Necessidade fictícia para validar o fluxo.','support_plan','','contacts',contacts));
  test_case_id := (case_data->>'id')::uuid;
  record_id := (case_data->>'medical_record_id')::uuid;
  ASSERT case_data->>'phase' = 'triagem', 'Caso inicia em triagem.';
  ASSERT (SELECT user_id IS NULL FROM public.medical_records WHERE id = record_id), 'Novo participante não exige conta de login.';
  ASSERT (SELECT emergency_contact_name = 'Responsável de teste' FROM public.medical_records WHERE id = record_id), 'Contatos devem ser compartilhados com a ficha.';

  failed_as_expected := false;
  BEGIN
    PERFORM public.mutate_inclusion('create',actor,jsonb_build_object('medical_record_id',record_id,'needs','Teste duplicidade','contacts',contacts));
  EXCEPTION WHEN unique_violation THEN failed_as_expected := true;
  END;
  ASSERT failed_as_expected, 'Não permitir dois acompanhamentos da mesma ficha.';

  failed_as_expected := false;
  BEGIN
    DELETE FROM public.medical_records WHERE id = record_id;
  EXCEPTION WHEN foreign_key_violation THEN failed_as_expected := true;
  END;
  ASSERT failed_as_expected, 'Ficha com inclusão não pode ser apagada.';

  before_version := (case_data->>'version')::integer;
  case_data := public.mutate_inclusion('update',actor,jsonb_build_object('version',before_version,'phase','contato'),test_case_id);
  ASSERT (case_data->>'version')::integer > before_version, 'Atualização avança a versão.';
  failed_as_expected := false;
  BEGIN
    PERFORM public.mutate_inclusion('update',actor,jsonb_build_object('version',before_version,'phase','analise'),test_case_id);
  EXCEPTION WHEN serialization_failure THEN failed_as_expected := true;
  END;
  ASSERT failed_as_expected, 'Versão antiga deve gerar conflito.';

  case_data := public.mutate_inclusion('interview_create',actor,jsonb_build_object(
    'version',(case_data->>'version')::integer,'scheduled_at','2027-02-01T15:00:00-03:00',
    'participants','Equipe e responsável fictícios','status','agendada','summary',''),test_case_id);
  SELECT id INTO interview_id FROM public.inclusion_interviews WHERE inclusion_interviews.case_id = test_case_id;
  case_data := public.mutate_inclusion('interview_update',actor,jsonb_build_object(
    'version',(case_data->>'version')::integer,'scheduled_at','2027-02-01T15:00:00-03:00',
    'participants','Equipe e responsável fictícios','status','realizada','summary','Resumo fictício da conversa e das necessidades de apoio.'),test_case_id,interview_id);
  case_data := public.mutate_inclusion('interview_create',actor,jsonb_build_object(
    'version',(case_data->>'version')::integer,'scheduled_at','2027-02-02T15:00:00-03:00',
    'participants','Equipe e contato fictícios','status','realizada','summary','Segunda conversa fictícia para validar múltiplas entrevistas.'),test_case_id);
  ASSERT (SELECT count(*) FROM public.inclusion_interviews i WHERE i.case_id = (case_data->>'id')::uuid) = 2, 'Preservar múltiplas entrevistas.';
  ASSERT case_data->>'decision' IS NULL, 'Entrevistas não podem gerar decisão automática.';

  failed_as_expected := false;
  BEGIN
    PERFORM public.mutate_inclusion('decision',actor,jsonb_build_object(
      'version',(case_data->>'version')::integer,'decision','participacao_com_apoio',
      'reason','Justificativa fictícia de teste.','support_plan','Apoio fictício.','confirmed_by_human',false),test_case_id);
  EXCEPTION WHEN invalid_parameter_value THEN failed_as_expected := true;
  END;
  ASSERT failed_as_expected, 'Decisão exige confirmação humana.';
  case_data := public.mutate_inclusion('decision',actor,jsonb_build_object(
    'version',(case_data->>'version')::integer,'decision','participacao_com_apoio',
    'reason','Justificativa fictícia registrada pela equipe.','support_plan','Apoio fictício combinado com o responsável.','confirmed_by_human',true),test_case_id);
  ASSERT case_data->>'phase' = 'concluido' AND case_data->>'decision' = 'participacao_com_apoio', 'Decisão deve persistir com fase concluída.';
  ASSERT (case_data->>'decided_by')::uuid = actor AND case_data->>'decided_at' IS NOT NULL, 'Decisão registra autor e data do servidor.';
  ASSERT (SELECT count(*) FROM public.inclusion_history h WHERE h.case_id = (case_data->>'id')::uuid AND action = 'decision') = 1, 'Decisão deve estar no histórico.';

  failed_as_expected := false;
  BEGIN
    PERFORM public.mutate_inclusion('update',actor,jsonb_build_object('version',(case_data->>'version')::integer,'support_plan',''),test_case_id);
  EXCEPTION WHEN check_violation THEN failed_as_expected := true;
  END;
  ASSERT failed_as_expected, 'Decisão com apoio não pode perder o plano.';

  before_version := (case_data->>'version')::integer;
  UPDATE public.medical_records SET full_name = '[TESTE TRANSACIONAL INCLUSAO ALTERADO]',
    emergency_contact_name = 'Responsável alterado em teste',
    emergency_contact_alt_phone = '{"contact2":{"name":"Contato preservado"},"contact3":{"name":"Outro contato preservado"},"bishop":{"name":"Bispo de teste"}}'
  WHERE id = record_id;
  SELECT to_jsonb(c) INTO case_data FROM public.inclusion_cases c WHERE c.id = test_case_id;
  ASSERT (case_data->>'version')::integer > before_version, 'Edição da ficha invalida versão do caso.';
  ASSERT case_data->>'full_name' = '[TESTE TRANSACIONAL INCLUSAO ALTERADO]', 'Nome deve permanecer sincronizado.';
  ASSERT case_data->'contacts'->'parent'->>'name' = 'Responsável alterado em teste', 'Contato deve permanecer sincronizado.';
  case_data := public.mutate_inclusion('update',actor,jsonb_build_object('version',(case_data->>'version')::integer,'contacts',contacts),test_case_id);
  ASSERT (case_data->>'version')::integer = (SELECT version FROM public.inclusion_cases WHERE id = test_case_id), 'RPC retorna versão final após trigger.';
  ASSERT (SELECT emergency_contact_alt_phone::jsonb->'contact2'->>'name' FROM public.medical_records WHERE id = record_id) = 'Contato preservado', 'Sincronização não pode perder contatos adicionais.';
  ASSERT (SELECT emergency_contact_alt_phone::jsonb->'contact3'->>'name' FROM public.medical_records WHERE id = record_id) = 'Outro contato preservado', 'Sincronização preserva terceiro contato.';

  case_data := public.mutate_inclusion('archive',actor,jsonb_build_object('version',(case_data->>'version')::integer),test_case_id);
  ASSERT case_data->>'phase' = 'arquivado' AND case_data->>'decision' = 'participacao_com_apoio', 'Arquivamento preserva decisão e histórico.';
  ASSERT (SELECT count(*) FROM public.inclusion_history h WHERE h.case_id = (case_data->>'id')::uuid) >= 8, 'Operações devem deixar histórico.';
  RAISE NOTICE 'Testes transacionais de inclusão concluídos; ROLLBACK removerá todos os dados de teste.';
END;
$$;
ROLLBACK;
