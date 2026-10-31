-- ==============================================================================
-- 2026-10-31 — Registro Isolado de Dispositivos, Entregas Idempotentes e Preferências Push (FCM)
-- Idempotente e aditivo: gerenciado exclusivamente pelo servidor (service_role)
-- para impedir leitura ou enumeração de tokens FCM via PostgREST.
-- Todas as escritas são estritamente escopadas ao usuário autenticado (user_id).
-- NUNCA há deleção cross-account por device_id ou fcm_token.
-- ==============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id text NOT NULL CHECK (length(trim(device_id)) BETWEEN 8 AND 128),
  platform text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  fcm_token text NOT NULL CHECK (length(trim(fcm_token)) BETWEEN 20 AND 4096),
  app_version text,
  binding_generation bigint NOT NULL DEFAULT 1 CHECK (binding_generation >= 1),
  announcements_enabled boolean NOT NULL DEFAULT true,
  urgent_only boolean NOT NULL DEFAULT false,
  schedule_reminders_enabled boolean NOT NULL DEFAULT true,
  personal_reminders_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start text,
  quiet_hours_end text,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id),
  UNIQUE (fcm_token)
);

ALTER TABLE public.push_device_tokens
  ADD COLUMN IF NOT EXISTS binding_generation bigint NOT NULL DEFAULT 1 CHECK (binding_generation >= 1);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_user_active
  ON public.push_device_tokens(user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_device_tokens FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Tabela de Entregas Idempotentes por (announcement_id, user_id, device_id) (P2 / N2)
-- Garante que reenvios ou execuções assíncronas não dupliquem push para o mesmo
-- vínculo usuário+aparelho, permitindo entrega caso outra conta autentique no aparelho.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_announcement_deliveries (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id text NOT NULL CHECK (length(trim(device_id)) BETWEEN 8 AND 128),
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id, device_id)
);

ALTER TABLE public.push_announcement_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_announcement_deliveries FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RPC Atômica: register_user_push_device
-- Escopada estritamente ao p_user_id autenticado.
-- Rejeita colisão de fcm_token com outra conta via SQLSTATE 23505
-- (TOKEN_BOUND_TO_OTHER_ACCOUNT), exigindo rotação de token no SDK ou logout
-- autenticado prévio da conta anterior. Nunca revoga dispositivo de terceiros
-- por device_id livre.
-- P5: binding_generation só incrementa quando o fcm_token muda ou após revogação.
-- P7: SET search_path = public, pg_temp.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_user_push_device(
  p_user_id uuid,
  p_device_id text,
  p_platform text,
  p_fcm_token text,
  p_app_version text DEFAULT NULL,
  p_announcements_enabled boolean DEFAULT NULL,
  p_urgent_only boolean DEFAULT NULL,
  p_schedule_reminders_enabled boolean DEFAULT NULL,
  p_personal_reminders_enabled boolean DEFAULT NULL,
  p_quiet_hours_start text DEFAULT NULL,
  p_quiet_hours_end text DEFAULT NULL,
  p_update_quiet_hours boolean DEFAULT false
)
RETURNS public.push_device_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conflict_user_id uuid;
  v_row public.push_device_tokens;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Verifica se o fcm_token já pertence a outra conta (colisão cross-account)
  SELECT user_id
    INTO v_conflict_user_id
    FROM public.push_device_tokens
   WHERE fcm_token = p_fcm_token
     AND user_id <> p_user_id
   LIMIT 1;

  IF v_conflict_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'TOKEN_BOUND_TO_OTHER_ACCOUNT'
      USING ERRCODE = '23505',
            DETAIL = 'O token FCM informado está vinculado a outra conta ativa.';
  END IF;

  -- Dentro da MESMA conta (actor-scoped), remove eventual registro anterior
  -- que usava o mesmo fcm_token em outro device_id do próprio usuário
  DELETE FROM public.push_device_tokens
   WHERE user_id = p_user_id
     AND fcm_token = p_fcm_token
     AND device_id <> p_device_id;

  INSERT INTO public.push_device_tokens (
    user_id,
    device_id,
    platform,
    fcm_token,
    app_version,
    binding_generation,
    announcements_enabled,
    urgent_only,
    schedule_reminders_enabled,
    personal_reminders_enabled,
    quiet_hours_start,
    quiet_hours_end,
    revoked_at,
    last_seen_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_device_id,
    p_platform,
    p_fcm_token,
    p_app_version,
    1,
    COALESCE(p_announcements_enabled, true),
    COALESCE(p_urgent_only, false),
    COALESCE(p_schedule_reminders_enabled, true),
    COALESCE(p_personal_reminders_enabled, true),
    CASE WHEN p_update_quiet_hours THEN p_quiet_hours_start ELSE NULL END,
    CASE WHEN p_update_quiet_hours THEN p_quiet_hours_end ELSE NULL END,
    NULL,
    now(),
    now()
  )
  ON CONFLICT (user_id, device_id) DO UPDATE
    SET platform = EXCLUDED.platform,
        fcm_token = EXCLUDED.fcm_token,
        app_version = COALESCE(EXCLUDED.app_version, public.push_device_tokens.app_version),
        binding_generation = CASE
          WHEN public.push_device_tokens.fcm_token IS DISTINCT FROM EXCLUDED.fcm_token
            OR public.push_device_tokens.revoked_at IS NOT NULL
          THEN public.push_device_tokens.binding_generation + 1
          ELSE public.push_device_tokens.binding_generation
        END,
        announcements_enabled = COALESCE(p_announcements_enabled, public.push_device_tokens.announcements_enabled),
        urgent_only = COALESCE(p_urgent_only, public.push_device_tokens.urgent_only),
        schedule_reminders_enabled = COALESCE(p_schedule_reminders_enabled, public.push_device_tokens.schedule_reminders_enabled),
        personal_reminders_enabled = COALESCE(p_personal_reminders_enabled, public.push_device_tokens.personal_reminders_enabled),
        quiet_hours_start = CASE
          WHEN p_update_quiet_hours THEN p_quiet_hours_start
          ELSE public.push_device_tokens.quiet_hours_start
        END,
        quiet_hours_end = CASE
          WHEN p_update_quiet_hours THEN p_quiet_hours_end
          ELSE public.push_device_tokens.quiet_hours_end
        END,
        revoked_at = NULL,
        last_seen_at = now(),
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC Atômica: revoke_user_push_devices
-- Escopada estritamente ao p_user_id autenticado.
-- P4: Exige p_device_id preenchido OU p_revoke_all = true explícito.
-- P7: SET search_path = public, pg_temp.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_user_push_devices(
  p_user_id uuid,
  p_device_id text DEFAULT NULL,
  p_revoke_all boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer := 0;
  v_clean_device_id text := NULLIF(trim(COALESCE(p_device_id, '')), '');
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF NOT COALESCE(p_revoke_all, false) AND v_clean_device_id IS NULL THEN
    RAISE EXCEPTION 'DEVICE_ID_OR_ALL_REQUIRED'
      USING ERRCODE = '22023',
            DETAIL = 'Informe device_id ou p_revoke_all = true explicitamente.';
  END IF;

  IF COALESCE(p_revoke_all, false) THEN
    DELETE FROM public.push_device_tokens
     WHERE user_id = p_user_id;
  ELSE
    DELETE FROM public.push_device_tokens
     WHERE user_id = p_user_id
       AND device_id = v_clean_device_id;
  END IF;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON public.push_device_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.push_device_tokens TO service_role;

REVOKE ALL ON public.push_announcement_deliveries FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.push_announcement_deliveries TO service_role;

REVOKE ALL ON FUNCTION public.register_user_push_device(
  uuid, text, text, text, text, boolean, boolean, boolean, boolean, text, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user_push_device(
  uuid, text, text, text, text, boolean, boolean, boolean, boolean, text, text, boolean
) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_user_push_devices(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_push_devices(uuid, text, boolean) TO service_role;

COMMIT;
