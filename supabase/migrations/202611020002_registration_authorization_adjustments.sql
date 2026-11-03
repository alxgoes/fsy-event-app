-- Ajustes privados da autorização, independentes do payload original de importação.
-- O importador atualiza o mesmo id por dedup_key em upsert e replace_all.
-- Transacional e reaplicável: preserva ajustes existentes e nunca expõe RPCs pela metade.
BEGIN;
SELECT pg_advisory_xact_lock(20261031, 1);

CREATE TABLE IF NOT EXISTS public.registration_authorization_adjustments (
  registration_id uuid PRIMARY KEY REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  values_json jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(values_json) = 'object'),
  edited_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_by_name text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.registration_authorization_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_authorization_adjustments FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_authorization_adjustments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.registration_authorization_adjustments TO service_role;

CREATE OR REPLACE FUNCTION public.admin_patch_registration_authorization(
  p_registration_id uuid, p_actor_id uuid, p_adjustments jsonb DEFAULT '{}'::jsonb,
  p_reset boolean DEFAULT false
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_actor_name text;
BEGIN
  SELECT full_name INTO v_actor_name FROM public.profiles
  WHERE id = p_actor_id AND role IN ('coordenador', 'casal_diretor', 'logistica')
    AND suspended_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cargo não autorizado.' USING ERRCODE = '42501'; END IF;
  PERFORM id FROM public.event_registrations WHERE id = p_registration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscrição não encontrada.' USING ERRCODE = 'P0002'; END IF;
  IF p_adjustments IS NULL OR jsonb_typeof(p_adjustments) <> 'object' THEN
    RAISE EXCEPTION 'Ajustes inválidos.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_each(p_adjustments) AS field
    WHERE field.key <> ALL (ARRAY['firstName','lastName','birthDate','sex','phone','cpf',
      'documentRgOrPassport','issuingAgency','guardianName','guardianPhone','stakeName','wardName',
      'bishopName','bishopEmail','tshirtSize','medicalInfo','dietaryInfo','healthConditionsSummary','healthConditionsDetails'])
      OR jsonb_typeof(field.value) <> 'string'
  ) THEN RAISE EXCEPTION 'Campo de ajuste inválido.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.registration_authorization_adjustments
    (registration_id, values_json, edited_by_user_id, edited_by_name, edited_at)
  VALUES (p_registration_id, CASE WHEN p_reset THEN '{}'::jsonb ELSE p_adjustments END,
    p_actor_id, COALESCE(v_actor_name, ''), clock_timestamp())
  ON CONFLICT (registration_id) DO UPDATE SET
    values_json = CASE WHEN p_reset THEN '{}'::jsonb
      ELSE registration_authorization_adjustments.values_json || EXCLUDED.values_json END,
    edited_by_user_id = EXCLUDED.edited_by_user_id,
    edited_by_name = EXCLUDED.edited_by_name, edited_at = EXCLUDED.edited_at;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_patch_registration_authorization(uuid, uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_patch_registration_authorization(uuid, uuid, jsonb, boolean) TO service_role;

-- Lotes antigos também passam a excluir cancelados dos contadores por tipo.
CREATE OR REPLACE FUNCTION public.registration_batch_counts_without_cancelled() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  SELECT count(*) FILTER (WHERE role_category = 'Participante' AND status !~* '^cancelad'),
    count(*) FILTER (WHERE role_category = 'Consultor' AND status !~* '^cancelad')
  INTO NEW.participant_count, NEW.counselor_count
  FROM public.event_registrations;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.registration_batch_counts_without_cancelled() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS registration_batch_counts_without_cancelled ON public.registration_import_batches;
CREATE TRIGGER registration_batch_counts_without_cancelled
BEFORE UPDATE OF total_count, participant_count, counselor_count ON public.registration_import_batches
FOR EACH ROW EXECUTE FUNCTION public.registration_batch_counts_without_cancelled();
UPDATE public.registration_import_batches SET participant_count = participant_count
WHERE id = (SELECT active_batch_id FROM public.registration_state_meta WHERE id = 1);

-- Bloqueia perdas silenciosas de ajustes mesmo se alguém editar após gerar o preview.
CREATE OR REPLACE FUNCTION public.admin_commit_registration_preview_with_adjustments(
  p_preview_id uuid, p_actor_id uuid, p_actor_name text, p_mode text,
  p_expected_revision integer, p_idempotency_key text, p_use_normalized_names boolean DEFAULT true,
  p_acknowledge_adjustment_removal boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  -- Importar e excluir lotes adquirem o advisory antes da meta: manter essa ordem
  -- impede um deadlock com a RPC antiga chamada ao fim desta função.
  PERFORM pg_advisory_xact_lock(20261031, 1);
  PERFORM id FROM public.registration_state_meta WHERE id = 1 FOR UPDATE;
  -- Os registros ficam bloqueados durante a conferência de perda de ajustes.
  PERFORM id FROM public.event_registrations ORDER BY id FOR UPDATE;
  IF p_mode = 'replace_all' AND NOT p_acknowledge_adjustment_removal AND EXISTS (
    SELECT 1 FROM public.registration_authorization_adjustments a
    JOIN public.event_registrations r ON r.id = a.registration_id
    JOIN public.registration_import_previews p ON p.id = p_preview_id AND p.committed_batch_id IS NULL
    WHERE a.values_json <> '{}'::jsonb AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p.rows_json) elem WHERE elem->>'dedupKey' = r.dedup_key
    )
  ) THEN
    RAISE EXCEPTION 'A substituição removeria inscritos com ajustes. Confira o aviso e confirme a remoção dos ajustes.' USING ERRCODE = '40001';
  END IF;
  RETURN public.admin_commit_registration_preview(p_preview_id, p_actor_id, p_actor_name,
    p_mode, p_expected_revision, p_idempotency_key, p_use_normalized_names);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_commit_registration_preview_with_adjustments(uuid, uuid, text, text, integer, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_commit_registration_preview_with_adjustments(uuid, uuid, text, text, integer, text, boolean, boolean) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
