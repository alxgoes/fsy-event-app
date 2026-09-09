BEGIN;

-- Browser clients may edit profile details, never their authorization role.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Alterações de cargo exigem a administração do servidor.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

CREATE TABLE public.inclusion_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medical_record_id uuid NOT NULL UNIQUE REFERENCES public.medical_records(id) ON DELETE RESTRICT,
  full_name text NOT NULL,
  phase text NOT NULL DEFAULT 'triagem' CHECK (phase IN ('triagem','contato','entrevistas','analise','concluido','arquivado')),
  needs text NOT NULL CHECK (length(trim(needs)) BETWEEN 1 AND 6000),
  support_plan text NOT NULL DEFAULT '' CHECK (length(support_plan) <= 6000),
  contacts jsonb NOT NULL CHECK (jsonb_typeof(contacts) = 'object'),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  decision text CHECK (decision IN ('participacao_confirmada','participacao_com_apoio','participacao_nao_recomendada')),
  decision_reason text,
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((decision IS NULL AND decision_reason IS NULL AND decided_by IS NULL AND decided_at IS NULL)
    OR (decision IS NOT NULL AND decision_reason IS NOT NULL AND length(trim(decision_reason)) >= 10 AND decided_by IS NOT NULL AND decided_at IS NOT NULL)),
  CHECK (decision IS DISTINCT FROM 'participacao_com_apoio' OR length(trim(support_plan)) > 0),
  CHECK (phase <> 'concluido' OR decision IS NOT NULL)
);
CREATE INDEX inclusion_cases_updated_idx ON public.inclusion_cases(updated_at DESC);
CREATE TABLE public.inclusion_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inclusion_cases(id) ON DELETE RESTRICT,
  scheduled_at timestamptz NOT NULL,
  participants text NOT NULL CHECK (length(trim(participants)) BETWEEN 2 AND 500),
  status text NOT NULL CHECK (status IN ('agendada','realizada','cancelada')),
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 6000),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'realizada' OR length(trim(summary)) > 0)
);
CREATE INDEX inclusion_interviews_case_idx ON public.inclusion_interviews(case_id, scheduled_at DESC);
CREATE TABLE public.inclusion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.inclusion_cases(id) ON DELETE RESTRICT,
  action text NOT NULL,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  actor_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX inclusion_history_case_idx ON public.inclusion_history(case_id, created_at DESC);

ALTER TABLE public.inclusion_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inclusion_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inclusion_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inclusion_cases, public.inclusion_interviews, public.inclusion_history FROM anon, authenticated;
GRANT SELECT ON public.inclusion_cases, public.inclusion_interviews, public.inclusion_history TO authenticated;
GRANT ALL ON public.inclusion_cases, public.inclusion_interviews, public.inclusion_history TO service_role;
CREATE POLICY inclusion_cases_staff_read ON public.inclusion_cases FOR SELECT TO authenticated
USING (public.get_auth_role()::text IN ('medico','coordenador','casal_diretor','logistica'));
CREATE POLICY inclusion_interviews_staff_read ON public.inclusion_interviews FOR SELECT TO authenticated
USING (public.get_auth_role()::text IN ('medico','coordenador','casal_diretor','logistica'));
CREATE POLICY inclusion_history_staff_read ON public.inclusion_history FOR SELECT TO authenticated
USING (public.get_auth_role()::text IN ('medico','coordenador','casal_diretor','logistica'));

-- Changes made from the medical form also invalidate open inclusion forms.
CREATE OR REPLACE FUNCTION public.sync_medical_inclusion_contacts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE extra jsonb;
BEGIN
  IF ROW(NEW.full_name, NEW.emergency_contact_name, NEW.emergency_contact_phone,
    NEW.emergency_contact_rel, NEW.emergency_contact_alt_phone)
    IS NOT DISTINCT FROM ROW(OLD.full_name, OLD.emergency_contact_name, OLD.emergency_contact_phone,
    OLD.emergency_contact_rel, OLD.emergency_contact_alt_phone) THEN RETURN NEW; END IF;
  BEGIN
    extra := coalesce(NEW.emergency_contact_alt_phone::jsonb, '{}'::jsonb);
    IF jsonb_typeof(extra) <> 'object' THEN extra := '{}'::jsonb; END IF;
  EXCEPTION WHEN invalid_text_representation THEN extra := '{}'::jsonb;
  END;
  UPDATE public.inclusion_cases SET
    full_name = coalesce(NEW.full_name, full_name),
    contacts = jsonb_build_object(
      'parent', jsonb_build_object('name', coalesce(NEW.emergency_contact_name,''), 'phone', coalesce(NEW.emergency_contact_phone,''),
        'relationship', coalesce(NEW.emergency_contact_rel,''), 'ward',''),
      'bishop', jsonb_build_object('name', coalesce(extra->'bishop'->>'name',''), 'phone', coalesce(extra->'bishop'->>'phone',''),
        'relationship', coalesce(extra->'bishop'->>'relationship',''), 'ward', coalesce(extra->'bishop'->>'ward',''))
    ), version = version + 1, updated_at = now()
  WHERE medical_record_id = NEW.id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_medical_inclusion_contacts() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_medical_inclusion_contacts AFTER UPDATE ON public.medical_records
FOR EACH ROW EXECUTE FUNCTION public.sync_medical_inclusion_contacts();

-- All writes run through one transaction. Only the server may supply actor_id.
CREATE OR REPLACE FUNCTION public.mutate_inclusion(
  p_action text, p_actor_id uuid, p_payload jsonb,
  p_case_id uuid DEFAULT NULL, p_interview_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_case public.inclusion_cases;
  v_old public.inclusion_cases;
  v_record_id uuid;
  v_name text;
  v_actor_name text;
  v_actor_role text;
  v_interview public.inclusion_interviews;
  v_old_interview jsonb;
  v_details jsonb;
  v_extra_contacts jsonb;
  v_extra_contacts_text text;
BEGIN
  SELECT full_name, role::text INTO v_actor_name, v_actor_role FROM public.profiles WHERE id = p_actor_id;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('medico','coordenador','casal_diretor','logistica') THEN
    RAISE EXCEPTION 'Acesso negado à inclusão.' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'create' THEN
    IF (p_payload ? 'medical_record_id') = (p_payload ? 'new_record') THEN
      RAISE EXCEPTION 'Informe uma ficha existente ou um novo participante.' USING ERRCODE = '22023';
    END IF;
    IF p_payload ? 'new_record' THEN
      v_name := trim(p_payload->'new_record'->>'full_name');
      IF v_name IS NULL OR length(v_name) < 2 OR length(v_name) > 160 THEN
        RAISE EXCEPTION 'Nome inválido.' USING ERRCODE = '22023';
      END IF;
      INSERT INTO public.medical_records (
        full_name, emergency_contact_name, emergency_contact_phone, emergency_contact_rel, emergency_contact_alt_phone
      ) VALUES (
        v_name, coalesce(nullif(p_payload->'contacts'->'parent'->>'name',''),'Não informado'),
        coalesce(nullif(p_payload->'contacts'->'parent'->>'phone',''),'Não informado'),
        coalesce(nullif(p_payload->'contacts'->'parent'->>'relationship',''),'Responsável'),
        jsonb_build_object('bishop', p_payload->'contacts'->'bishop')::text
      ) RETURNING id INTO v_record_id;
    ELSE
      v_record_id := (p_payload->>'medical_record_id')::uuid;
      SELECT full_name INTO v_name FROM public.medical_records WHERE id = v_record_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Ficha não encontrada.' USING ERRCODE = 'P0002'; END IF;
    END IF;
    INSERT INTO public.inclusion_cases (medical_record_id, full_name, needs, support_plan, contacts, created_by)
    VALUES (v_record_id, coalesce(v_name,'Participante'), p_payload->>'needs', coalesce(p_payload->>'support_plan',''), p_payload->'contacts', p_actor_id)
    RETURNING * INTO v_case;
    v_details := jsonb_build_object('medical_record_id', v_record_id, 'phase', v_case.phase);
  ELSE
    SELECT * INTO v_case FROM public.inclusion_cases WHERE id = p_case_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Acompanhamento não encontrado.' USING ERRCODE = 'P0002'; END IF;
    IF (p_payload->>'version')::integer IS DISTINCT FROM v_case.version THEN
      RAISE EXCEPTION 'O acompanhamento foi alterado por outra pessoa. Atualize antes de salvar.' USING ERRCODE = '40001';
    END IF;
    v_old := v_case;
    IF p_action = 'update' THEN
      IF p_payload->>'phase' = 'concluido' THEN
        RAISE EXCEPTION 'A conclusão exige uma decisão humana registrada.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.inclusion_cases SET
        needs = coalesce(p_payload->>'needs', needs), support_plan = coalesce(p_payload->>'support_plan', support_plan),
        contacts = coalesce(p_payload->'contacts', contacts), phase = coalesce(p_payload->>'phase', phase),
        decision = CASE WHEN p_payload ? 'phase' AND p_payload->>'phase' NOT IN ('arquivado','concluido') THEN NULL ELSE decision END,
        decision_reason = CASE WHEN p_payload ? 'phase' AND p_payload->>'phase' NOT IN ('arquivado','concluido') THEN NULL ELSE decision_reason END,
        decided_by = CASE WHEN p_payload ? 'phase' AND p_payload->>'phase' NOT IN ('arquivado','concluido') THEN NULL ELSE decided_by END,
        decided_at = CASE WHEN p_payload ? 'phase' AND p_payload->>'phase' NOT IN ('arquivado','concluido') THEN NULL ELSE decided_at END
      WHERE id = p_case_id;
      v_details := jsonb_build_object('before', to_jsonb(v_old), 'changes', p_payload - 'version');
    ELSIF p_action = 'archive' THEN
      UPDATE public.inclusion_cases SET phase = 'arquivado' WHERE id = p_case_id;
      v_details := jsonb_build_object('previous_phase', v_old.phase);
    ELSIF p_action IN ('interview_create','interview_update') THEN
      IF v_case.phase = 'arquivado' THEN RAISE EXCEPTION 'Reabra o acompanhamento antes de registrar entrevistas.' USING ERRCODE = '22023'; END IF;
      IF p_action = 'interview_create' THEN
        INSERT INTO public.inclusion_interviews (case_id, scheduled_at, participants, status, summary, created_by)
        VALUES (p_case_id, (p_payload->>'scheduled_at')::timestamptz, p_payload->>'participants', p_payload->>'status', coalesce(p_payload->>'summary',''), p_actor_id)
        RETURNING * INTO v_interview;
      ELSE
        SELECT to_jsonb(i) INTO v_old_interview FROM public.inclusion_interviews i WHERE id = p_interview_id AND case_id = p_case_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Entrevista não encontrada.' USING ERRCODE = 'P0002'; END IF;
        UPDATE public.inclusion_interviews SET scheduled_at = (p_payload->>'scheduled_at')::timestamptz,
          participants = p_payload->>'participants', status = p_payload->>'status', summary = coalesce(p_payload->>'summary',''), updated_at = now()
        WHERE id = p_interview_id AND case_id = p_case_id RETURNING * INTO v_interview;
      END IF;
      v_details := jsonb_build_object('before', v_old_interview, 'interview', to_jsonb(v_interview));
    ELSIF p_action = 'decision' THEN
      IF v_case.phase = 'arquivado' THEN RAISE EXCEPTION 'Reabra o acompanhamento antes de registrar a decisão.' USING ERRCODE = '22023'; END IF;
      IF p_payload->'confirmed_by_human' IS DISTINCT FROM 'true'::jsonb THEN
        RAISE EXCEPTION 'A decisão exige confirmação humana.' USING ERRCODE = '22023';
      END IF;
      IF p_payload->>'decision' = 'participacao_com_apoio' AND length(trim(coalesce(p_payload->>'support_plan',''))) = 0 THEN
        RAISE EXCEPTION 'Informe o plano de apoio.' USING ERRCODE = '22023';
      END IF;
      UPDATE public.inclusion_cases SET phase = 'concluido', decision = p_payload->>'decision',
        decision_reason = p_payload->>'reason', support_plan = p_payload->>'support_plan', decided_by = p_actor_id, decided_at = now()
      WHERE id = p_case_id;
      v_details := jsonb_build_object('previous_decision', v_old.decision, 'previous_reason', v_old.decision_reason,
        'decision', p_payload->>'decision', 'reason', p_payload->>'reason', 'support_plan', p_payload->>'support_plan', 'confirmed_by_human', true);
    ELSE
      RAISE EXCEPTION 'Operação inválida.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.inclusion_cases SET version = version + 1, updated_at = now() WHERE id = p_case_id RETURNING * INTO v_case;
  END IF;
  IF p_action IN ('create','update') AND p_payload ? 'contacts' THEN
    SELECT emergency_contact_alt_phone INTO v_extra_contacts_text FROM public.medical_records
      WHERE id = v_case.medical_record_id FOR UPDATE;
    BEGIN
      v_extra_contacts := coalesce(v_extra_contacts_text::jsonb, '{}'::jsonb);
      IF jsonb_typeof(v_extra_contacts) <> 'object' THEN v_extra_contacts := '{}'::jsonb; END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      v_extra_contacts := '{}'::jsonb;
    END;
    UPDATE public.medical_records SET
      emergency_contact_name = coalesce(nullif(p_payload->'contacts'->'parent'->>'name',''),'Não informado'),
      emergency_contact_phone = coalesce(nullif(p_payload->'contacts'->'parent'->>'phone',''),'Não informado'),
      emergency_contact_rel = coalesce(nullif(p_payload->'contacts'->'parent'->>'relationship',''),'Responsável'),
      emergency_contact_alt_phone = (v_extra_contacts || jsonb_build_object('bishop', p_payload->'contacts'->'bishop'))::text,
      updated_at = now()
    WHERE id = v_case.medical_record_id;
  END IF;
  -- The medical contact trigger may have advanced the version during this write.
  SELECT * INTO v_case FROM public.inclusion_cases WHERE id = v_case.id;
  INSERT INTO public.inclusion_history(case_id, action, actor_id, actor_name, details)
  VALUES (v_case.id, p_action, p_actor_id, v_actor_name, v_details);
  RETURN to_jsonb(v_case);
END;
$$;
REVOKE ALL ON FUNCTION public.mutate_inclusion(text,uuid,jsonb,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_inclusion(text,uuid,jsonb,uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
