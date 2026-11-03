-- ==============================================================================
-- 2026-10-31 — Módulo Isolado de Inscrições FSY 2027 e Fichas de Autorização
-- Idempotente e estritamente aditivo: NUNCA altera nem sincroniza com `profiles`,
-- `medical_records`, `companies`, `auth.users` ou `inclusion_cases`.
-- ==============================================================================
BEGIN;

-- 1. Metadados de revisão e lote ativo (singleton id = 1) -----------------------
CREATE TABLE IF NOT EXISTS public.registration_state_meta (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_revision integer NOT NULL DEFAULT 0,
  active_batch_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.registration_state_meta (id, current_revision, active_batch_id)
VALUES (1, 0, NULL)
ON CONFLICT (id) DO NOTHING;

-- 2. Lotes de importação confirmados -------------------------------------------
CREATE TABLE IF NOT EXISTS public.registration_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision integer NOT NULL,
  source_preview_id uuid,
  filename text NOT NULL,
  file_sha256 text NOT NULL,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes >= 0),
  import_mode text NOT NULL CHECK (import_mode IN ('upsert', 'replace_all')),
  use_normalized_names boolean NOT NULL DEFAULT true,
  idempotency_key text UNIQUE,
  total_count integer NOT NULL DEFAULT 0,
  participant_count integer NOT NULL DEFAULT 0,
  counselor_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  deleted_count integer NOT NULL DEFAULT 0,
  imported_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  imported_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_import_batches
  ADD COLUMN IF NOT EXISTS source_preview_id uuid;

-- 3. Previews temporários vinculados ao administrador e revisão base -----------
CREATE TABLE IF NOT EXISTS public.registration_import_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_revision integer NOT NULL,
  filename text NOT NULL,
  file_sha256 text NOT NULL,
  file_size_bytes integer NOT NULL CHECK (file_size_bytes >= 0),
  can_commit boolean NOT NULL DEFAULT false,
  summary_json jsonb NOT NULL,
  rows_json jsonb NOT NULL,
  committed_batch_id uuid REFERENCES public.registration_import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

-- 4. Registros canônicos isolados de inscrições (34 colunas preservadas) -------
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.registration_import_batches(id) ON DELETE CASCADE,
  dedup_key text NOT NULL UNIQUE,
  role_category text NOT NULL CHECK (role_category IN ('Participante', 'Consultor')),
  status text NOT NULL,
  first_name_raw text NOT NULL,
  last_name_raw text NOT NULL,
  preferred_name_raw text,
  full_name_raw text NOT NULL,
  first_name_normalized text NOT NULL,
  last_name_normalized text NOT NULL,
  preferred_name_normalized text,
  full_name_normalized text NOT NULL,
  guardian_name_raw text,
  guardian_name_normalized text,
  guardian_phone_raw text,
  birth_date_raw text,
  birth_date_iso text,
  age_at_registration integer,
  sex text,
  phone_raw text,
  email text,
  tshirt_size text,
  stake_name text,
  ward_name text,
  bishop_name_raw text,
  bishop_name_normalized text,
  bishop_email text,
  document_rg_or_passport_raw text,
  issuing_agency_raw text,
  cpf_raw text,
  cpf_digits_only text,
  parent_authorization_ack_raw text,
  contact1_name_raw text,
  contact1_name_normalized text,
  contact1_email text,
  contact1_phone_raw text,
  contact2_name_raw text,
  contact2_name_normalized text,
  contact2_email text,
  contact2_phone_raw text,
  is_church_member_raw text,
  talent_show_presentation_raw text,
  medical_info_raw text,
  dietary_info_raw text,
  health_conditions_summary_raw text,
  health_conditions_details_raw text,
  registration_date_raw text,
  was_name_normalized boolean NOT NULL DEFAULT false,
  has_health_alert boolean NOT NULL DEFAULT false,
  has_missing_guardian_for_minor boolean NOT NULL DEFAULT false,
  has_document_warning boolean NOT NULL DEFAULT false,
  source_sheets jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_row_numbers jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_columns jsonb NOT NULL DEFAULT '{}'::jsonb,
  record_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_registrations_batch_id ON public.event_registrations(batch_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_role_category ON public.event_registrations(role_category);
CREATE INDEX IF NOT EXISTS idx_event_registrations_stake_ward ON public.event_registrations(stake_name, ward_name);
CREATE INDEX IF NOT EXISTS idx_event_registrations_full_name ON public.event_registrations(full_name_normalized);

-- 5. RLS estrita + privilégios mínimos (A3: zero acesso direto via PostgREST) ---
-- Todas as leituras e mutações passam obrigatoriamente pelas rotas de servidor
-- (/api/admin/registrations/**) autenticadas com requireIdentity("userManagers")
-- usando `service_role`, impedindo que tokens `authenticated` leiam colunas
-- sensíveis (CPF, RG, saúde) diretamente pelo PostgREST.
ALTER TABLE public.registration_state_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_state_meta FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_import_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_import_previews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations FORCE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.registration_state_meta,
  public.registration_import_batches,
  public.registration_import_previews,
  public.event_registrations
FROM PUBLIC, anon, authenticated;

GRANT ALL ON
  public.registration_state_meta,
  public.registration_import_batches,
  public.registration_import_previews,
  public.event_registrations
TO service_role;

DROP POLICY IF EXISTS active_profile_required ON public.registration_state_meta;
DROP POLICY IF EXISTS active_profile_required ON public.registration_import_batches;
DROP POLICY IF EXISTS active_profile_required ON public.registration_import_previews;
DROP POLICY IF EXISTS active_profile_required ON public.event_registrations;
DROP POLICY IF EXISTS registration_state_meta_managers_read ON public.registration_state_meta;
DROP POLICY IF EXISTS registration_batches_managers_read ON public.registration_import_batches;
DROP POLICY IF EXISTS event_registrations_managers_read ON public.event_registrations;

-- 6. RPC Transacional de Commit com expectedRevision + idempotencyKey ----------
CREATE OR REPLACE FUNCTION public.admin_commit_registration_preview(
  p_preview_id uuid,
  p_actor_id uuid,
  p_actor_name text,
  p_mode text,
  p_expected_revision integer,
  p_idempotency_key text,
  p_use_normalized_names boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta public.registration_state_meta%ROWTYPE;
  v_preview public.registration_import_previews%ROWTYPE;
  v_existing_batch public.registration_import_batches%ROWTYPE;
  v_new_revision integer;
  v_batch_id uuid;
  v_row jsonb;
  v_dedup_key text;
  v_existing_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_deleted integer := 0;
  v_total integer := 0;
  v_participants integer := 0;
  v_counselors integer := 0;
  v_warnings integer := 0;
  v_norm_flag boolean := COALESCE(p_use_normalized_names, true);
BEGIN
  IF p_mode NOT IN ('upsert', 'replace_all') THEN
    RAISE EXCEPTION 'Modo de importação inválido.' USING ERRCODE = '22023';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(20261031, 1);

  -- M1: Limpa previews expirados não confirmados
  DELETE FROM public.registration_import_previews
  WHERE expires_at < now() AND committed_batch_id IS NULL;

  SELECT * INTO v_meta FROM public.registration_state_meta WHERE id = 1 FOR UPDATE;

  -- A2: Replay idempotente valida estritamente preview_id, actor_id, mode, expected_revision e use_normalized_names
  SELECT * INTO v_existing_batch
  FROM public.registration_import_batches
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing_batch.source_preview_id IS DISTINCT FROM p_preview_id
       OR v_existing_batch.imported_by_user_id IS DISTINCT FROM p_actor_id
       OR v_existing_batch.import_mode IS DISTINCT FROM p_mode
       OR (v_existing_batch.revision - 1) IS DISTINCT FROM p_expected_revision
       OR v_existing_batch.use_normalized_names IS DISTINCT FROM v_norm_flag THEN
      RAISE EXCEPTION 'Chave de idempotência já utilizada com parâmetros diferentes (preview, autor, modo, revisão esperada ou normalização).'
        USING ERRCODE = '40001';
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'idempotentReplay', true,
      'currentRevision', v_meta.current_revision,
      'insertedCount', v_existing_batch.inserted_count,
      'updatedCount', v_existing_batch.updated_count,
      'deletedCount', v_existing_batch.deleted_count,
      'batchId', v_existing_batch.id
    );
  END IF;

  SELECT * INTO v_preview
  FROM public.registration_import_previews
  WHERE id = p_preview_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pré-visualização de importação não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_preview.created_by_user_id IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'Esta pré-visualização pertence a outro administrador.' USING ERRCODE = '42501';
  END IF;

  IF v_preview.committed_batch_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta pré-visualização já foi confirmada anteriormente.' USING ERRCODE = '40001';
  END IF;

  IF v_preview.expires_at < now() THEN
    RAISE EXCEPTION 'A pré-visualização expirou. Envie a planilha novamente.' USING ERRCODE = '40001';
  END IF;

  IF NOT v_preview.can_commit THEN
    RAISE EXCEPTION 'A planilha possui erros bloqueantes e não pode ser importada.' USING ERRCODE = '22023';
  END IF;

  IF p_expected_revision IS DISTINCT FROM v_meta.current_revision
     OR v_preview.base_revision IS DISTINCT FROM v_meta.current_revision THEN
    RAISE EXCEPTION 'Os dados de inscrições foram alterados por outra operação (revisão esperada %, atual %). Gere uma nova pré-visualização.',
      p_expected_revision, v_meta.current_revision
      USING ERRCODE = '40001';
  END IF;

  IF jsonb_typeof(v_preview.rows_json) <> 'array' OR jsonb_array_length(v_preview.rows_json) = 0 THEN
    RAISE EXCEPTION 'Planilha sem registros válidos não pode ser aplicada.' USING ERRCODE = '22023';
  END IF;

  v_new_revision := v_meta.current_revision + 1;

  INSERT INTO public.registration_import_batches (
    revision,
    source_preview_id,
    filename,
    file_sha256,
    file_size_bytes,
    import_mode,
    use_normalized_names,
    idempotency_key,
    warning_count,
    imported_by_user_id,
    imported_by_name
  ) VALUES (
    v_new_revision,
    p_preview_id,
    v_preview.filename,
    v_preview.file_sha256,
    v_preview.file_size_bytes,
    p_mode,
    v_norm_flag,
    p_idempotency_key,
    COALESCE((v_preview.summary_json->>'warningCount')::integer, 0),
    p_actor_id,
    p_actor_name
  ) RETURNING id INTO v_batch_id;

  IF p_mode = 'replace_all' THEN
    DELETE FROM public.event_registrations
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_preview.rows_json) AS elem
      WHERE elem->>'dedupKey' = public.event_registrations.dedup_key
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_preview.rows_json)
  LOOP
    v_dedup_key := v_row->>'dedupKey';
    SELECT id INTO v_existing_id FROM public.event_registrations WHERE dedup_key = v_dedup_key;

    IF v_existing_id IS NULL THEN
      v_existing_id := COALESCE(nullif(v_row->>'id', '')::uuid, gen_random_uuid());
      INSERT INTO public.event_registrations (
        id, batch_id, dedup_key, role_category, status,
        first_name_raw, last_name_raw, preferred_name_raw, full_name_raw,
        first_name_normalized, last_name_normalized, preferred_name_normalized, full_name_normalized,
        guardian_name_raw, guardian_name_normalized, guardian_phone_raw,
        birth_date_raw, birth_date_iso, age_at_registration, sex, phone_raw, email, tshirt_size,
        stake_name, ward_name, bishop_name_raw, bishop_name_normalized, bishop_email,
        document_rg_or_passport_raw, issuing_agency_raw, cpf_raw, cpf_digits_only,
        parent_authorization_ack_raw,
        contact1_name_raw, contact1_name_normalized, contact1_email, contact1_phone_raw,
        contact2_name_raw, contact2_name_normalized, contact2_email, contact2_phone_raw,
        is_church_member_raw, talent_show_presentation_raw,
        medical_info_raw, dietary_info_raw, health_conditions_summary_raw, health_conditions_details_raw,
        registration_date_raw,
        was_name_normalized, has_health_alert, has_missing_guardian_for_minor, has_document_warning,
        source_sheets, source_row_numbers, issues, raw_columns, record_payload
      ) VALUES (
        v_existing_id,
        v_batch_id,
        v_dedup_key,
        v_row->>'roleCategory',
        COALESCE(v_row->>'status', 'Confirmado'),
        COALESCE(v_row->>'firstNameRaw', ''),
        COALESCE(v_row->>'lastNameRaw', ''),
        v_row->>'preferredNameRaw',
        COALESCE(v_row->>'fullNameRaw', ''),
        COALESCE(v_row->>'firstNameNormalized', ''),
        COALESCE(v_row->>'lastNameNormalized', ''),
        v_row->>'preferredNameNormalized',
        COALESCE(v_row->>'fullNameNormalized', ''),
        v_row->>'guardianNameRaw',
        v_row->>'guardianNameNormalized',
        v_row->>'guardianPhoneRaw',
        v_row->>'birthDateRaw',
        v_row->>'birthDateIso',
        nullif(v_row->>'ageAtRegistration', '')::integer,
        v_row->>'sex',
        v_row->>'phoneRaw',
        v_row->>'email',
        v_row->>'tshirtSize',
        v_row->>'stakeName',
        v_row->>'wardName',
        v_row->>'bishopNameRaw',
        v_row->>'bishopNameNormalized',
        v_row->>'bishopEmail',
        v_row->>'documentRgOrPassportRaw',
        v_row->>'issuingAgencyRaw',
        v_row->>'cpfRaw',
        v_row->>'cpfDigitsOnly',
        v_row->>'parentAuthorizationAckRaw',
        v_row->>'contact1NameRaw',
        v_row->>'contact1NameNormalized',
        v_row->>'contact1Email',
        v_row->>'contact1PhoneRaw',
        v_row->>'contact2NameRaw',
        v_row->>'contact2NameNormalized',
        v_row->>'contact2Email',
        v_row->>'contact2PhoneRaw',
        v_row->>'isChurchMemberRaw',
        v_row->>'talentShowPresentationRaw',
        v_row->>'medicalInfoRaw',
        v_row->>'dietaryInfoRaw',
        v_row->>'healthConditionsSummaryRaw',
        v_row->>'healthConditionsDetailsRaw',
        v_row->>'registrationDateRaw',
        COALESCE((v_row->>'wasNameNormalized')::boolean, false),
        COALESCE((v_row->>'hasHealthAlert')::boolean, false),
        COALESCE((v_row->>'hasMissingGuardianForMinor')::boolean, false),
        COALESCE((v_row->>'hasDocumentWarning')::boolean, false),
        COALESCE(v_row->'sourceSheets', '[]'::jsonb),
        COALESCE(v_row->'sourceRowNumbers', '{}'::jsonb),
        COALESCE(v_row->'issues', '[]'::jsonb),
        COALESCE(v_row->'rawColumns', '{}'::jsonb),
        jsonb_set(jsonb_set(v_row, '{id}', to_jsonb(v_existing_id::text)), '{batchId}', to_jsonb(v_batch_id::text))
      );
      v_inserted := v_inserted + 1;
    ELSE
      UPDATE public.event_registrations SET
        batch_id = v_batch_id,
        role_category = v_row->>'roleCategory',
        status = COALESCE(v_row->>'status', 'Confirmado'),
        first_name_raw = COALESCE(v_row->>'firstNameRaw', ''),
        last_name_raw = COALESCE(v_row->>'lastNameRaw', ''),
        preferred_name_raw = v_row->>'preferredNameRaw',
        full_name_raw = COALESCE(v_row->>'fullNameRaw', ''),
        first_name_normalized = COALESCE(v_row->>'firstNameNormalized', ''),
        last_name_normalized = COALESCE(v_row->>'lastNameNormalized', ''),
        preferred_name_normalized = v_row->>'preferredNameNormalized',
        full_name_normalized = COALESCE(v_row->>'fullNameNormalized', ''),
        guardian_name_raw = v_row->>'guardianNameRaw',
        guardian_name_normalized = v_row->>'guardianNameNormalized',
        guardian_phone_raw = v_row->>'guardianPhoneRaw',
        birth_date_raw = v_row->>'birthDateRaw',
        birth_date_iso = v_row->>'birthDateIso',
        age_at_registration = nullif(v_row->>'ageAtRegistration', '')::integer,
        sex = v_row->>'sex',
        phone_raw = v_row->>'phoneRaw',
        email = v_row->>'email',
        tshirt_size = v_row->>'tshirtSize',
        stake_name = v_row->>'stakeName',
        ward_name = v_row->>'wardName',
        bishop_name_raw = v_row->>'bishopNameRaw',
        bishop_name_normalized = v_row->>'bishopNameNormalized',
        bishop_email = v_row->>'bishopEmail',
        document_rg_or_passport_raw = v_row->>'documentRgOrPassportRaw',
        issuing_agency_raw = v_row->>'issuingAgencyRaw',
        cpf_raw = v_row->>'cpfRaw',
        cpf_digits_only = v_row->>'cpfDigitsOnly',
        parent_authorization_ack_raw = v_row->>'parentAuthorizationAckRaw',
        contact1_name_raw = v_row->>'contact1NameRaw',
        contact1_name_normalized = v_row->>'contact1NameNormalized',
        contact1_email = v_row->>'contact1Email',
        contact1_phone_raw = v_row->>'contact1PhoneRaw',
        contact2_name_raw = v_row->>'contact2NameRaw',
        contact2_name_normalized = v_row->>'contact2NameNormalized',
        contact2_email = v_row->>'contact2Email',
        contact2_phone_raw = v_row->>'contact2PhoneRaw',
        is_church_member_raw = v_row->>'isChurchMemberRaw',
        talent_show_presentation_raw = v_row->>'talentShowPresentationRaw',
        medical_info_raw = v_row->>'medicalInfoRaw',
        dietary_info_raw = v_row->>'dietaryInfoRaw',
        health_conditions_summary_raw = v_row->>'healthConditionsSummaryRaw',
        health_conditions_details_raw = v_row->>'healthConditionsDetailsRaw',
        registration_date_raw = v_row->>'registrationDateRaw',
        was_name_normalized = COALESCE((v_row->>'wasNameNormalized')::boolean, false),
        has_health_alert = COALESCE((v_row->>'hasHealthAlert')::boolean, false),
        has_missing_guardian_for_minor = COALESCE((v_row->>'hasMissingGuardianForMinor')::boolean, false),
        has_document_warning = COALESCE((v_row->>'hasDocumentWarning')::boolean, false),
        source_sheets = COALESCE(v_row->'sourceSheets', '[]'::jsonb),
        source_row_numbers = COALESCE(v_row->'sourceRowNumbers', '{}'::jsonb),
        issues = COALESCE(v_row->'issues', '[]'::jsonb),
        raw_columns = COALESCE(v_row->'rawColumns', '{}'::jsonb),
        record_payload = jsonb_set(jsonb_set(v_row, '{id}', to_jsonb(v_existing_id::text)), '{batchId}', to_jsonb(v_batch_id::text)),
        updated_at = now()
      WHERE id = v_existing_id;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE role_category = 'Participante')::integer,
    count(*) FILTER (WHERE role_category = 'Consultor')::integer,
    count(*) FILTER (WHERE jsonb_array_length(issues) > 0)::integer
  INTO v_total, v_participants, v_counselors, v_warnings
  FROM public.event_registrations;

  UPDATE public.registration_import_batches
  SET
    total_count = v_total,
    participant_count = v_participants,
    counselor_count = v_counselors,
    warning_count = v_warnings,
    inserted_count = v_inserted,
    updated_count = v_updated,
    deleted_count = v_deleted
  WHERE id = v_batch_id;

  UPDATE public.registration_state_meta
  SET
    current_revision = v_new_revision,
    active_batch_id = v_batch_id,
    updated_at = now()
  WHERE id = 1;

  -- M1: Higieniza dados sensíveis do preview após confirmação
  UPDATE public.registration_import_previews
  SET
    committed_batch_id = v_batch_id,
    rows_json = '[]'::jsonb,
    summary_json = jsonb_set(
      jsonb_set(v_preview.summary_json, '{sampleRows}', '[]'::jsonb, true),
      '{nameChanges}', '[]'::jsonb, true
    )
  WHERE id = p_preview_id;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotentReplay', false,
    'currentRevision', v_new_revision,
    'insertedCount', v_inserted,
    'updatedCount', v_updated,
    'deletedCount', v_deleted,
    'batchId', v_batch_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_commit_registration_preview(uuid, uuid, text, text, integer, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_commit_registration_preview(uuid, uuid, text, text, integer, text, boolean)
  TO service_role;

-- 7. RPC Transacional de Exclusão de Lote Escopada (A1: NUNCA executa DELETE sem WHERE)
CREATE OR REPLACE FUNCTION public.admin_delete_registration_batch(
  p_batch_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta public.registration_state_meta%ROWTYPE;
  v_batch public.registration_import_batches%ROWTYPE;
  v_new_revision integer;
  v_deleted_records integer := 0;
BEGIN
  IF p_batch_id IS NULL THEN
    RAISE EXCEPTION 'ID do lote é obrigatório.' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(20261031, 1);

  SELECT * INTO v_meta FROM public.registration_state_meta WHERE id = 1 FOR UPDATE;
  SELECT * INTO v_batch FROM public.registration_import_batches WHERE id = p_batch_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote de importação não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- A1: Remove estritamente os registros vinculados a este lote (batch_id = p_batch_id).
  -- Registros originados em outros lotes permanecem intactos; se este era o lote ativo,
  -- active_batch_id passa a NULL sem promover lotes históricos antigos.
  DELETE FROM public.event_registrations WHERE batch_id = p_batch_id;
  GET DIAGNOSTICS v_deleted_records = ROW_COUNT;

  IF v_meta.active_batch_id = p_batch_id THEN
    v_meta.active_batch_id := NULL;
  END IF;

  DELETE FROM public.registration_import_batches WHERE id = p_batch_id;

  v_new_revision := v_meta.current_revision + 1;
  UPDATE public.registration_state_meta
  SET
    current_revision = v_new_revision,
    active_batch_id = v_meta.active_batch_id,
    updated_at = now()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'ok', true,
    'deletedBatchId', p_batch_id,
    'deletedRecordsCount', v_deleted_records,
    'currentRevision', v_new_revision,
    'activeBatchId', v_meta.active_batch_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_registration_batch(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_registration_batch(uuid, uuid)
  TO service_role;

COMMIT;
