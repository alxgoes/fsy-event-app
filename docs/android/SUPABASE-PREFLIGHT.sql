-- ==============================================================================
-- FSY Sessão Ribeirão Preto 2 (2027) — Preflight Somente Leitura (Catálogo Real)
--
-- Objetivo:
--   1. Inspecionar de forma 100% SOMENTE LEITURA (SELECT) o catálogo `pg_class`,
--      `pg_proc`, `pg_policies`, `information_schema.columns` e `role_table_grants`
--      do projeto Supabase (`vhbmnnpgftrrovjtvbzo`) sem consultar nem expor PII.
--   2. Confirmar que as 15 tabelas existentes do catálogo real (`profiles`,
--      `companies`, `schedule_items`, `announcements`, `announcement_likes`,
--      `media_photos`, `medical_records`, `medical_appointments`,
--      `transport_logistics`, `counselor_audit_logs`, `inclusion_cases`,
--      `inclusion_interviews`, `inclusion_history`, `admin_account_events`,
--      `user_layout_preferences`) e as funções de segurança (`get_auth_role`,
--      `get_auth_company`, `handle_new_user`, `protect_profile_role`,
--      `keep_enabled_administrator`) estão íntegras.
--   3. Verificar o estado das tabelas novas e isoladas de inscrições e push
--      (`registration_state_meta`, `registration_import_batches`,
--      `registration_import_previews`, `event_registrations`,
--      `user_push_Subscriptions` / `push_device_tokens` quando aplicável).
--
-- REGRAS DE SEGURANÇA E PRESERVAÇÃO:
--   - NUNCA reexecutar `supabase/schema.sql` ou migrations 001..004 já presentes.
--   - NUNCA executar TRUNCATE/DROP em tabelas existentes (`profiles`: 6,
--     `auth.users`: 6, `schedule_items`: 82, `companies`: 4, `medical_records`: 0).
--   - Após qualquer importação real nas tabelas novas, NUNCA executar DROP:
--     preservar os dados e usar exclusivamente migração corretiva (forward-fix).
-- ==============================================================================

-- 1. Resumo agregado do catálogo `public` + grants + RLS (sem PII)
WITH expected_tables(table_name, category) AS (
  VALUES
    ('profiles', 'core_existing'),
    ('companies', 'core_existing'),
    ('schedule_items', 'core_existing'),
    ('announcements', 'core_existing'),
    ('announcement_likes', 'core_existing'),
    ('media_photos', 'core_existing'),
    ('medical_records', 'core_existing'),
    ('medical_appointments', 'core_existing'),
    ('transport_logistics', 'core_existing'),
    ('counselor_audit_logs', 'core_existing'),
    ('inclusion_cases', 'core_existing'),
    ('inclusion_interviews', 'core_existing'),
    ('inclusion_history', 'core_existing'),
    ('admin_account_events', 'core_existing'),
    ('user_layout_preferences', 'core_existing'),
    ('registration_state_meta', 'registrations_20261031'),
    ('registration_import_batches', 'registrations_20261031'),
    ('registration_import_previews', 'registrations_20261031'),
    ('event_registrations', 'registrations_20261031')
)
SELECT
  e.category,
  e.table_name,
  (c.oid IS NOT NULL) AS exists_in_public,
  COALESCE(c.relrowsecurity, false) AS rls_enabled,
  COALESCE(c.relforcerowsecurity, false) AS rls_forced,
  (
    SELECT count(*)::int
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = e.table_name
  ) AS policy_count,
  COALESCE(
    (
      SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
      FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public'
        AND g.table_name = e.table_name
        AND g.grantee = 'authenticated'
    ),
    'NONE'
  ) AS authenticated_grants,
  COALESCE(
    (
      SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
      FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public'
        AND g.table_name = e.table_name
        AND g.grantee = 'anon'
    ),
    'NONE'
  ) AS anon_grants
FROM expected_tables e
LEFT JOIN pg_class c
  ON c.relname = e.table_name
  AND c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
ORDER BY e.category, e.table_name;

-- 2. Verificação somente leitura de funções críticas e RPCs com assinaturas reais
WITH expected_functions(proname, expected_args) AS (
  VALUES
    ('get_auth_role', ''),
    ('get_auth_company', ''),
    ('handle_new_user', ''),
    ('protect_profile_role', ''),
    ('keep_enabled_administrator', ''),
    ('admin_commit_registration_preview', 'p_preview_id uuid, p_actor_id uuid, p_actor_name text, p_mode text, p_expected_revision integer, p_idempotency_key text, p_use_normalized_names boolean DEFAULT true'),
    ('admin_delete_registration_batch', 'p_batch_id uuid, p_actor_id uuid')
)
SELECT
  ef.proname AS function_name,
  (p.oid IS NOT NULL) AS exists_in_public,
  COALESCE(pg_get_function_identity_arguments(p.oid), '') AS actual_identity_args,
  COALESCE(p.prosecdef, false) AS security_definer,
  COALESCE(array_to_string(p.proconfig, ', '), '') AS function_config
FROM expected_functions ef
LEFT JOIN pg_proc p
  ON p.proname = ef.proname
  AND p.pronamespace = 'public'::regnamespace
ORDER BY ef.proname;

-- 3. Contagens exatas de preservação (baseline antes/depois da migração aditiva)
SELECT
  (SELECT count(*)::int FROM public.profiles) AS profiles_count,
  (SELECT count(*)::int FROM auth.users) AS auth_users_count,
  (SELECT count(*)::int FROM public.schedule_items) AS schedule_items_count,
  (SELECT count(*)::int FROM public.companies) AS companies_count,
  (SELECT count(*)::int FROM public.medical_records) AS medical_records_count,
  (SELECT count(*)::int FROM public.user_layout_preferences) AS layout_prefs_count,
  to_regclass('public.event_registrations')::text AS event_registrations_regclass,
  to_regclass('public.registration_import_batches')::text AS registration_batches_regclass,
  to_regclass('public.registration_import_previews')::text AS registration_previews_regclass,
  to_regclass('public.registration_state_meta')::text AS registration_meta_regclass;

-- 4. Condição de segurança antes de qualquer manutenção nas tabelas novas (somente leitura):
--    Se as tabelas novas já existirem e contiverem linhas (batches > 0 ou registrations > 0),
--    é PROIBIDO executar DROP; qualquer ajuste posterior deve ser feito via ALTER/CREATE OR REPLACE (forward-fix).
SELECT
  CASE
    WHEN to_regclass('public.event_registrations') IS NULL THEN 'NOT_MIGRATED_YET'
    ELSE 'MIGRATED'
  END AS registrations_module_state;
