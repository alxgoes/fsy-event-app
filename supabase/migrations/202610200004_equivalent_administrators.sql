-- Direção, coordenação e logística têm a mesma autoridade por definição do evento.
-- Alinha somente a proteção da última administração; não altera RLS nem registros.
BEGIN;
CREATE OR REPLACE FUNCTION public.keep_enabled_administrator()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE removing boolean;
BEGIN
  IF OLD.role::text NOT IN ('coordenador', 'casal_diretor', 'logistica') OR OLD.suspended_at IS NOT NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN removing := true;
  ELSE removing := NEW.role::text NOT IN ('coordenador', 'casal_diretor', 'logistica') OR NEW.suspended_at IS NOT NULL;
  END IF;
  IF removing THEN
    PERFORM pg_advisory_xact_lock(20261020, 2);
    IF (SELECT count(*) FROM public.profiles WHERE role::text IN ('coordenador', 'casal_diretor', 'logistica') AND suspended_at IS NULL) <= 1 THEN
      RAISE EXCEPTION 'É necessário preservar uma conta administrativa habilitada.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.keep_enabled_administrator() FROM PUBLIC, anon, authenticated;
COMMIT;
