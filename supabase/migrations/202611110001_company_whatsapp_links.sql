-- =============================================================================
-- Migration: 202611110001_company_whatsapp_links.sql
-- Purpose: Store WhatsApp group invite links per company with strict RLS
--          (access only via service_role through /api/companies/whatsapp).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.company_whatsapp_links (
  company_id text PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  invite_url text NOT NULL CHECK (invite_url ~ '^https://chat\.whatsapp\.com/[A-Za-z0-9]{16,32}$'),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_whatsapp_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_whatsapp_links FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.company_whatsapp_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.company_whatsapp_links TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
