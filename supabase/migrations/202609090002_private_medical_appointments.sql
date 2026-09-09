BEGIN;

CREATE TABLE IF NOT EXISTS public.medical_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  medical_record_id uuid REFERENCES public.medical_records(id) ON DELETE SET NULL,
  youth_name text NOT NULL,
  professional_name text NOT NULL,
  reason text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'agendado',
  is_seen boolean NOT NULL DEFAULT false,
  seen_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medical_appointments
  ADD COLUMN IF NOT EXISTS medical_record_id uuid REFERENCES public.medical_records(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_seen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
CREATE INDEX IF NOT EXISTS medical_appointments_schedule_idx ON public.medical_appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS medical_appointments_user_idx ON public.medical_appointments(user_id);

-- The old fallback stored private appointments in a broadly readable transport row.
-- Keep its original notes intact as a reversible backup, inaccessible to browser roles.
-- Any malformed legacy data aborts this transaction; no partial import.
DO $$
DECLARE
  legacy record;
  payload jsonb;
  item jsonb;
BEGIN
  FOR legacy IN SELECT id, notes FROM public.transport_logistics
    WHERE stake_city = '__APPOINTMENTS_STORAGE__' AND notes IS NOT NULL FOR UPDATE
  LOOP
    payload := legacy.notes::jsonb;
    IF jsonb_typeof(payload) <> 'array' THEN
      RAISE EXCEPTION 'Formato inválido no armazenamento legado de agendamentos (registro %).', legacy.id;
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(payload)
    LOOP
      IF item->>'id' IS NULL THEN RAISE EXCEPTION 'Agendamento legado sem identificador.'; END IF;
      INSERT INTO public.medical_appointments (
        id, user_id, medical_record_id, youth_name, professional_name, reason, scheduled_at,
        status, is_seen, seen_at, notes, created_by, created_at, updated_at
      ) VALUES (
        (item->>'id')::uuid, nullif(item->>'user_id','')::uuid, nullif(item->>'medical_record_id','')::uuid,
        item->>'youth_name', item->>'professional_name', item->>'reason', (item->>'scheduled_at')::timestamptz,
        coalesce(item->>'status','agendado'), coalesce((item->>'is_seen')::boolean,false),
        nullif(item->>'seen_at','')::timestamptz, item->>'notes', nullif(item->>'created_by','')::uuid,
        coalesce(nullif(item->>'created_at','')::timestamptz, now()), coalesce(nullif(item->>'updated_at','')::timestamptz, now())
      ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE public.transport_logistics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transport_private_appointments_backup ON public.transport_logistics;
CREATE POLICY transport_private_appointments_backup ON public.transport_logistics
AS RESTRICTIVE FOR ALL TO anon, authenticated
USING (coalesce(stake_city, '') <> '__APPOINTMENTS_STORAGE__')
WITH CHECK (coalesce(stake_city, '') <> '__APPOINTMENTS_STORAGE__');

ALTER TABLE public.medical_appointments ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE existing_policy record;
BEGIN
  FOR existing_policy IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'medical_appointments'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.medical_appointments', existing_policy.policyname);
  END LOOP;
END;
$$;
REVOKE ALL ON public.medical_appointments FROM anon, authenticated;
GRANT SELECT ON public.medical_appointments TO authenticated;
GRANT ALL ON public.medical_appointments TO service_role;
CREATE POLICY medical_appointments_private_read ON public.medical_appointments FOR SELECT TO authenticated
USING (public.get_auth_role()::text IN ('medico','coordenador','casal_diretor','logistica'));
-- Participants read their sanitized appointment projection through the API.
-- Writes, including marking an appointment seen, go through the authenticated API.
NOTIFY pgrst, 'reload schema';
COMMIT;
