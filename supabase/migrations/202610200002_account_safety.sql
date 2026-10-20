-- Complemento da revisão de risco: executar depois de 202610200001.
BEGIN;

-- Políticas permissivas antigas não podem reabrir acesso de uma sessão suspensa.
-- get_auth_role() é SECURITY DEFINER e retorna NULL para perfil suspenso.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS active_profile_required ON public.%I', t.relname);
    EXECUTE format('CREATE POLICY active_profile_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.get_auth_role() IS NOT NULL) WITH CHECK (public.get_auth_role() IS NOT NULL)', t.relname);
  END LOOP;
END $$;

-- Um único bloqueio transacional serializa todas as remoções de administradores.
-- Protege também /api/users e DELETE em Auth que faz cascade para profiles.
CREATE OR REPLACE FUNCTION public.keep_enabled_administrator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removing boolean;
BEGIN
  IF OLD.role::text NOT IN ('coordenador', 'casal_diretor') OR OLD.suspended_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN removing := true;
  ELSE removing := NEW.role::text NOT IN ('coordenador', 'casal_diretor') OR NEW.suspended_at IS NOT NULL;
  END IF;
  IF removing THEN
    PERFORM pg_advisory_xact_lock(20261020, 2);
    IF (SELECT count(*) FROM public.profiles WHERE role::text IN ('coordenador', 'casal_diretor') AND suspended_at IS NULL) <= 1 THEN
      RAISE EXCEPTION 'É necessário preservar uma conta administrativa habilitada.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.keep_enabled_administrator() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS keep_enabled_administrator ON public.profiles;
CREATE TRIGGER keep_enabled_administrator BEFORE UPDATE OF role, suspended_at OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.keep_enabled_administrator();
COMMIT;
