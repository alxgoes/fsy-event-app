-- ==============================================================================
-- 2026-10-20 — Endurecimento de segurança, curtidas, preferências de layout,
-- trilha administrativa e operações transacionais.
-- Idempotente: pode ser reaplicada. Não apaga dados de participantes.
-- Ordem: schema.sql (somente banco vazio) → 202609090001 → 202609090002 → esta.
-- ==============================================================================
BEGIN;

-- 1. Suspensão administrativa e funções auxiliares ------------------------------
-- suspended_at preenchido = acesso suspenso; o cargo deixa de valer nas políticas.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND suspended_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_company()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() AND suspended_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_auth_company() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_company() TO authenticated, service_role;

-- 2. Cadastro: o cargo inicial é sempre "jovem" ---------------------------------
-- A regra antiga promovia contas pelo texto do e-mail (admin/medico/logistica).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, role, avatar_url, stake, phone)
    VALUES (
      NEW.id,
      left(COALESCE(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), nullif(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1), 'Participante'), 160),
      'jovem',
      COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
      left(nullif(trim(NEW.raw_user_meta_data->>'stake'), ''), 120),
      left(nullif(trim(NEW.raw_user_meta_data->>'phone'), ''), 40)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Falha ao criar perfil para %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. Perfis: leitura mínima e campos protegidos --------------------------------
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Coordinators and Directors can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_self_read ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_read ON public.profiles;
DROP POLICY IF EXISTS profiles_counselor_read ON public.profiles;

CREATE POLICY profiles_self_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
-- A atualização própria continua limitada pelo trigger de campos protegidos.
CREATE POLICY profiles_staff_read ON public.profiles FOR SELECT TO authenticated
  USING (public.get_auth_role()::text IN ('coordenador', 'casal_diretor', 'logistica', 'medico'));
CREATE POLICY profiles_counselor_read ON public.profiles FOR SELECT TO authenticated
  USING (public.get_auth_role()::text = 'consultor' AND company_id IS NOT NULL AND company_id = public.get_auth_company());

REVOKE INSERT, DELETE, TRUNCATE ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.profiles FROM anon;

-- O navegador pode editar nome, telefone, estaca e foto, nunca cargo/companhia/quarto.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.company_id IS DISTINCT FROM OLD.company_id OR
    NEW.room IS DISTINCT FROM OLD.room OR
    NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
  ) THEN
    RAISE EXCEPTION 'Alterações de cargo, companhia, quarto ou acesso exigem a administração do servidor.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_role ON public.profiles;
CREATE TRIGGER protect_profile_role BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 4. Conteúdo: escrita somente pelo servidor -----------------------------------
DROP POLICY IF EXISTS "Logistics and Coordinators can manage schedule" ON public.schedule_items;
DROP POLICY IF EXISTS "Staff can manage announcements" ON public.announcements;
DROP POLICY IF EXISTS "Logistics and Coordinators can manage transport" ON public.transport_logistics;
DROP POLICY IF EXISTS "Directors, Coordinators and Logistics can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Medics and Directors can manage medical records" ON public.medical_records;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.counselor_audit_logs;
DROP POLICY IF EXISTS "Directors, Coordinators and Logistics can delete counselor audit logs" ON public.counselor_audit_logs;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON
  public.schedule_items, public.announcements, public.transport_logistics, public.companies,
  public.medical_records, public.counselor_audit_logs, public.media_photos
FROM anon, authenticated;
REVOKE ALL ON public.medical_records, public.counselor_audit_logs FROM anon;

-- Ônibus e motoristas: dados operacionais da equipe.
DROP POLICY IF EXISTS "Anyone authenticated can view transport schedule" ON public.transport_logistics;
DROP POLICY IF EXISTS transport_staff_read ON public.transport_logistics;
CREATE POLICY transport_staff_read ON public.transport_logistics FOR SELECT TO authenticated
  USING (public.get_auth_role()::text IN ('logistica', 'coordenador', 'casal_diretor'));

-- Fotos ocultas ficam restritas à mídia e à coordenação.
DROP POLICY IF EXISTS "Anyone authenticated can view visible media photos" ON public.media_photos;
DROP POLICY IF EXISTS media_visible_read ON public.media_photos;
CREATE POLICY media_visible_read ON public.media_photos FOR SELECT TO authenticated
  USING (visible IS TRUE OR public.get_auth_role()::text IN ('midia', 'logistica', 'coordenador', 'casal_diretor'));

-- 5. Curtidas: uma linha por pessoa e comunicado --------------------------------
CREATE TABLE IF NOT EXISTS public.announcement_likes (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);
CREATE INDEX IF NOT EXISTS announcement_likes_user_idx ON public.announcement_likes(user_id);
ALTER TABLE public.announcement_likes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcement_likes FROM anon, authenticated;
GRANT SELECT ON public.announcement_likes TO authenticated;
GRANT ALL ON public.announcement_likes TO service_role;
DROP POLICY IF EXISTS announcement_likes_own_read ON public.announcement_likes;
CREATE POLICY announcement_likes_own_read ON public.announcement_likes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Migra curtidas legadas gravadas como "Categoria__LIKES__[ids]" e limpa a categoria.
DO $$
DECLARE
  item record;
  raw text;
  liked jsonb;
BEGIN
  FOR item IN SELECT id, category FROM public.announcements WHERE category LIKE '%\_\_LIKES\_\_%' FOR UPDATE
  LOOP
    raw := split_part(item.category, '__LIKES__', 2);
    BEGIN
      liked := raw::jsonb;
    EXCEPTION WHEN others THEN
      liked := '[]'::jsonb;
    END;
    IF jsonb_typeof(liked) = 'array' THEN
      INSERT INTO public.announcement_likes (announcement_id, user_id)
      SELECT item.id, value::uuid
      FROM jsonb_array_elements_text(liked) AS value
      WHERE value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = value::uuid)
      ON CONFLICT DO NOTHING;
    END IF;
    UPDATE public.announcements
      SET category = coalesce(nullif(split_part(item.category, '__LIKES__', 1), ''), 'Geral')
      WHERE id = item.id;
  END LOOP;
END;
$$;

-- 6. Preferências individuais de layout ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_layout_preferences (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  page_key text NOT NULL CHECK (page_key ~ '^[a-z0-9][a-z0-9:_-]{0,63}$'),
  breakpoint text NOT NULL DEFAULT 'all' CHECK (breakpoint IN ('all', 'mobile', 'desktop')),
  layout_version integer NOT NULL CHECK (layout_version BETWEEN 1 AND 1000),
  card_order jsonb NOT NULL CHECK (jsonb_typeof(card_order) = 'array' AND jsonb_array_length(card_order) <= 60),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page_key, breakpoint)
);
ALTER TABLE public.user_layout_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_layout_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_layout_preferences TO authenticated;
GRANT ALL ON public.user_layout_preferences TO service_role;
DROP POLICY IF EXISTS layout_own_rows ON public.user_layout_preferences;
CREATE POLICY layout_own_rows ON public.user_layout_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 7. Trilha das ações administrativas sobre contas -----------------------------
-- Sem senhas, tokens ou conteúdo médico. target_id sem FK: a conta pode ser excluída.
CREATE TABLE IF NOT EXISTS public.admin_account_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  target_id uuid,
  target_label text NOT NULL,
  action text NOT NULL CHECK (action IN ('edit', 'role', 'suspend', 'reactivate', 'delete', 'recovery_email', 'set_password', 'email')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_account_events_target_idx ON public.admin_account_events(target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_account_events_created_idx ON public.admin_account_events(created_at DESC);
ALTER TABLE public.admin_account_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_account_events FROM anon, authenticated;
GRANT SELECT ON public.admin_account_events TO authenticated;
GRANT ALL ON public.admin_account_events TO service_role;
DROP POLICY IF EXISTS admin_account_events_read ON public.admin_account_events;
CREATE POLICY admin_account_events_read ON public.admin_account_events FOR SELECT TO authenticated
  USING (public.get_auth_role()::text IN ('coordenador', 'casal_diretor', 'logistica'));

-- 8. Operações transacionais chamadas somente pelo servidor ---------------------
CREATE OR REPLACE FUNCTION public.admin_save_company(
  p_id text, p_is_new boolean, p_name text, p_motto text, p_set_motto boolean,
  p_color text, p_counselor_ids uuid[], p_actor_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_company public.companies;
  v_valid integer;
BEGIN
  IF p_is_new THEN
    IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
      RAISE EXCEPTION 'Nome da companhia é obrigatório.' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.companies (id, name, motto, color, updated_at)
    VALUES (p_id, trim(p_name), CASE WHEN p_set_motto THEN p_motto END, coalesce(p_color, '#007DA5'), now())
    RETURNING * INTO v_company;
  ELSE
    UPDATE public.companies SET
      name = coalesce(nullif(trim(p_name), ''), name),
      motto = CASE WHEN p_set_motto THEN p_motto ELSE motto END,
      color = coalesce(p_color, color),
      updated_at = now()
    WHERE id = p_id RETURNING * INTO v_company;
    IF NOT FOUND THEN RAISE EXCEPTION 'Companhia não encontrada.' USING ERRCODE = 'P0002'; END IF;
  END IF;

  IF p_counselor_ids IS NOT NULL THEN
    SELECT count(*) INTO v_valid FROM public.profiles
      WHERE id = ANY(p_counselor_ids) AND role = 'consultor';
    IF v_valid <> coalesce(array_length(p_counselor_ids, 1), 0) THEN
      RAISE EXCEPTION 'Selecione apenas contas com cargo de consultor.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.profiles SET company_id = NULL, updated_at = now()
      WHERE company_id = p_id AND role = 'consultor' AND NOT (id = ANY(p_counselor_ids));
    UPDATE public.profiles SET company_id = p_id, updated_at = now()
      WHERE id = ANY(p_counselor_ids);
    UPDATE public.companies SET counselors = coalesce((
      SELECT array_agg(full_name ORDER BY full_name) FROM public.profiles WHERE id = ANY(p_counselor_ids)
    ), '{}') WHERE id = p_id RETURNING * INTO v_company;
  END IF;

  RETURN to_jsonb(v_company);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_company(p_id text, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM 1 FROM public.companies WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Companhia não encontrada.' USING ERRCODE = 'P0002'; END IF;
  UPDATE public.profiles SET company_id = NULL, updated_at = now() WHERE company_id = p_id;
  DELETE FROM public.companies WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_replace_schedule(p_items jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_count integer;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A programação enviada está vazia.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.schedule_items;
  INSERT INTO public.schedule_items (day, date, start_time, end_time, title, location, description, category, is_highlight)
  SELECT day, date, start_time, end_time, title, location, description, coalesce(category, 'Geral'), coalesce(is_highlight, false)
  FROM jsonb_to_recordset(p_items) AS x(
    day text, date date, start_time text, end_time text, title text, location text,
    description text, category text, is_highlight boolean
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_company(text, boolean, text, text, boolean, text, uuid[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_delete_company(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_replace_schedule(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_company(text, boolean, text, text, boolean, text, uuid[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_company(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_replace_schedule(jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
