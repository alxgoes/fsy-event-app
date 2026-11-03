-- ==============================================================================
-- 2026-11-02 — Foto de perfil com análise do consultor
-- O jovem envia a foto pelo servidor; ela fica em análise até o consultor da
-- companhia (ou a gestão) aprovar. Só o servidor (service_role) grava a foto
-- publicada: o navegador e o app deixam de poder trocar avatar_url diretamente.
-- Idempotente e aditivo.
-- ==============================================================================
BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_pending_path text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_submitted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_reviewed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_review_note text;

DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_status_check
    CHECK (avatar_status IN ('none', 'pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fotos já existentes (Google) continuam valendo como aprovadas.
UPDATE public.profiles
   SET avatar_status = 'approved'
 WHERE avatar_status = 'none' AND coalesce(avatar_url, '') <> '';

CREATE INDEX IF NOT EXISTS idx_profiles_avatar_pending
  ON public.profiles(company_id, avatar_submitted_at)
  WHERE avatar_status = 'pending';

-- handle_new_user é SECURITY DEFINER e recebe metadata não confiável do cadastro.
-- Nenhum INSERT publica uma foto: a aprovação legítima acontece depois, via UPDATE
-- do servidor. O backfill acima preserva as fotos que já existiam antes desta regra.
CREATE OR REPLACE FUNCTION public.initialize_profile_photo_review()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.avatar_url := NULL;
  NEW.avatar_status := 'none';
  NEW.avatar_pending_path := NULL;
  NEW.avatar_submitted_at := NULL;
  NEW.avatar_reviewed_at := NULL;
  NEW.avatar_reviewed_by := NULL;
  NEW.avatar_review_note := NULL;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.initialize_profile_photo_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS initialize_profile_photo_review ON public.profiles;
CREATE TRIGGER initialize_profile_photo_review BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_profile_photo_review();

-- O navegador pode editar nome, telefone e estaca; foto e análise só pelo servidor.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND (
    NEW.id IS DISTINCT FROM OLD.id OR
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.company_id IS DISTINCT FROM OLD.company_id OR
    NEW.room IS DISTINCT FROM OLD.room OR
    NEW.suspended_at IS DISTINCT FROM OLD.suspended_at OR
    NEW.avatar_url IS DISTINCT FROM OLD.avatar_url OR
    NEW.avatar_status IS DISTINCT FROM OLD.avatar_status OR
    NEW.avatar_pending_path IS DISTINCT FROM OLD.avatar_pending_path OR
    NEW.avatar_submitted_at IS DISTINCT FROM OLD.avatar_submitted_at OR
    NEW.avatar_reviewed_at IS DISTINCT FROM OLD.avatar_reviewed_at OR
    NEW.avatar_reviewed_by IS DISTINCT FROM OLD.avatar_reviewed_by OR
    NEW.avatar_review_note IS DISTINCT FROM OLD.avatar_review_note
  ) THEN
    RAISE EXCEPTION 'Alterações de cargo, companhia, quarto, acesso ou foto exigem o servidor.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Bucket privado: nenhuma política para anon/authenticated; o servidor assina URLs curtas.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('profile-photos', 'profile-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE
      SET public = false,
          file_size_limit = EXCLUDED.file_size_limit,
          allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
