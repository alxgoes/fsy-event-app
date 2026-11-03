-- Apenas jovens precisam de aprovacao. O objeto continua no bucket privado,
-- inclusive quando uma pendencia antiga passa a ser a foto publicada da equipe.
BEGIN;
LOCK TABLE public.profiles IN SHARE ROW EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION public.normalize_staff_profile_photo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- O trigger protect_profile_role continua recusando alteracoes diretas do cliente.
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') OR NEW.role::text = 'jovem' THEN
    RETURN NEW;
  END IF;
  IF NEW.avatar_status = 'pending' AND nullif(NEW.avatar_pending_path, '') IS NOT NULL THEN
    NEW.avatar_url := 'profile-photos/' || NEW.avatar_pending_path;
  END IF;
  NEW.avatar_pending_path := NULL;
  NEW.avatar_review_note := NULL;
  NEW.avatar_reviewed_by := NULL;
  IF nullif(NEW.avatar_url, '') IS NOT NULL THEN
    NEW.avatar_status := 'approved';
    NEW.avatar_reviewed_at := coalesce(NEW.avatar_reviewed_at, clock_timestamp());
  ELSE
    NEW.avatar_url := NULL;
    NEW.avatar_status := 'none';
    NEW.avatar_submitted_at := NULL;
    NEW.avatar_reviewed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_staff_profile_photo() FROM PUBLIC, anon, authenticated;

-- Executa depois de protect_profile_role (ordem alfabetica), sem substituir sua protecao.
DROP TRIGGER IF EXISTS zz_normalize_staff_profile_photo ON public.profiles;
CREATE TRIGGER zz_normalize_staff_profile_photo
BEFORE UPDATE OF role, avatar_url, avatar_status, avatar_pending_path, avatar_review_note, avatar_reviewed_at, avatar_reviewed_by
ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_staff_profile_photo();

-- Reaplicavel; nao move objetos nem elimina fotos aprovadas existentes de jovens.
UPDATE public.profiles SET avatar_status = avatar_status WHERE role::text <> 'jovem';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_staff_photo_published_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_staff_photo_published_check CHECK (
      role::text = 'jovem' OR (
        avatar_pending_path IS NULL AND (
          (avatar_status = 'none' AND nullif(avatar_url, '') IS NULL) OR
          (avatar_status = 'approved' AND nullif(avatar_url, '') IS NOT NULL)
        )
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
