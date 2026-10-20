-- ==============================================================================
-- 2026-10-20 — Limpeza de deriva de RLS encontrada no Supabase remoto.
-- Executar depois de 202610200001 e 202610200002. Idempotente. Não apaga registros.
--
-- O remoto tinha políticas permissivas criadas fora das migrações (USING true,
-- nomes variáveis/truncados, e transport_private_appointments_backup PERMISSIVE
-- para anon). Como políticas permissivas se somam (OR), uma única sobra reabre
-- tudo; por isso aqui não se remove por nome: TODAS as políticas das quatro
-- tabelas são descartadas e só a allowlist abaixo é recriada.
--
-- As APIs do servidor usam service_role (BYPASSRLS) e não dependem destas
-- políticas. A allowlist cobre apenas leituras diretas do navegador, nunca
-- escrita. Ver docs/seguranca-rls-recuperada.md (ordem de deploy).
-- ==============================================================================
BEGIN;

-- 1. Descarta toda política existente nas tabelas sensíveis --------------------
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('medical_records', 'transport_logistics', 'announcements', 'counselor_audit_logs')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_logistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counselor_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Privilégios: anon nada; navegador autenticado só lê; servidor completo -----
REVOKE ALL ON public.medical_records, public.transport_logistics, public.announcements, public.counselor_audit_logs
  FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.medical_records, public.transport_logistics, public.announcements, public.counselor_audit_logs
  FROM authenticated;
GRANT SELECT ON public.medical_records, public.transport_logistics, public.announcements, public.counselor_audit_logs
  TO authenticated;
GRANT ALL ON public.medical_records, public.transport_logistics, public.announcements, public.counselor_audit_logs
  TO service_role;

-- 3. Suspensão (202610200002): perfil suspenso não passa em nenhuma política ----
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['medical_records', 'transport_logistics', 'announcements', 'counselor_audit_logs']
  LOOP
    EXECUTE format('CREATE POLICY active_profile_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.get_auth_role() IS NOT NULL) WITH CHECK (public.get_auth_role() IS NOT NULL)', t);
  END LOOP;
END $$;

-- 4. Allowlist mínima (somente SELECT) --------------------------------------------
-- Prontuários: equipe de saúde e direção. A logística continua vendo fichas só
-- pela API /api/medical (decisão de domínio pendente); o próprio jovem não lê
-- direto, pois nenhum contrato de API o prevê.
CREATE POLICY medical_records_staff_read ON public.medical_records FOR SELECT TO authenticated
  USING (public.get_auth_role()::text IN ('medico', 'coordenador', 'casal_diretor'));

-- Transporte: equipe operacional; linhas de armazenamento de atendimentos nunca
-- aparecem ao navegador (RESTRICTIVE, somente authenticated).
CREATE POLICY transport_staff_read ON public.transport_logistics FOR SELECT TO authenticated
  USING (public.get_auth_role()::text IN ('logistica', 'coordenador', 'casal_diretor'));
CREATE POLICY transport_private_appointments_backup ON public.transport_logistics
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (coalesce(stake_city, '') <> '__APPOINTMENTS_STORAGE__')
  WITH CHECK (coalesce(stake_city, '') <> '__APPOINTMENTS_STORAGE__');

-- Avisos: mesmo escopo de GET /api/announcements — globais e da própria
-- companhia; gestão (coordenação, direção, logística) vê todos.
CREATE POLICY announcements_scoped_read ON public.announcements FOR SELECT TO authenticated
  USING (
    target_company_id IS NULL
    OR target_company_id = public.get_auth_company()
    OR public.get_auth_role()::text IN ('coordenador', 'casal_diretor', 'logistica')
  );

-- Auditoria de consultores: leitura da gestão; inserção e exclusão só pelo servidor.
CREATE POLICY counselor_audit_staff_read ON public.counselor_audit_logs FOR SELECT TO authenticated
  USING (public.get_auth_role()::text IN ('coordenador', 'casal_diretor', 'logistica'));

-- 5. Verificação: aborta a transação se sobrar algo fora da allowlist ------------
DO $$
DECLARE unexpected text;
BEGIN
  SELECT string_agg(tablename || '.' || policyname, ', ') INTO unexpected
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('medical_records', 'transport_logistics', 'announcements', 'counselor_audit_logs')
    AND (
      (tablename || '.' || policyname) NOT IN (
        'medical_records.active_profile_required', 'medical_records.medical_records_staff_read',
        'transport_logistics.active_profile_required', 'transport_logistics.transport_staff_read',
        'transport_logistics.transport_private_appointments_backup',
        'announcements.active_profile_required', 'announcements.announcements_scoped_read',
        'counselor_audit_logs.active_profile_required', 'counselor_audit_logs.counselor_audit_staff_read'
      )
      OR roles::text[] && ARRAY['anon', 'public']
      OR (permissive = 'PERMISSIVE' AND cmd <> 'SELECT')
    );
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'Políticas fora da allowlist após limpeza: %', unexpected;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('medical_records', 'transport_logistics', 'announcements', 'counselor_audit_logs')
      AND (grantee IN ('anon', 'PUBLIC') OR (grantee = 'authenticated' AND privilege_type <> 'SELECT'))
  ) THEN
    RAISE EXCEPTION 'Privilégios de navegador acima de SELECT permanecem nas tabelas sensíveis.';
  END IF;
END $$;

COMMIT;
