-- ==============================================================================
-- FSY Sessão Ribeirão Preto 2 - Supabase Database Schema & RBAC Configuration
-- ==============================================================================

-- 1. Create User Role Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'jovem',
        'consultor',
        'midia',
        'medico',
        'logistica',
        'coordenador',
        'casal_diretor'
    );
EXCEPTION
    WHEN duplicate_object THEN
        BEGIN
            ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'midia';
        EXCEPTION
            WHEN duplicate_object THEN null;
        END;
END $$;

-- 2. Create Tables

-- Companies Table (Companhias do FSY)
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY, -- e.g., 'cia-1', 'cia-nefi', etc.
    name TEXT NOT NULL,  -- e.g., 'Companhia 1 - Néfi'
    motto TEXT,
    color TEXT DEFAULT '#4361EE',
    counselors TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'jovem',
    company_id TEXT,
    stake TEXT,
    room TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Medical Records Table (Confidential - Multidisciplinary Team & Directors only)
CREATE TABLE IF NOT EXISTS public.medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT,
    company_id TEXT,
    room TEXT,
    allergies TEXT,
    is_severe_allergy BOOLEAN NOT NULL DEFAULT false,
    medications TEXT,
    emergency_contact_name TEXT NOT NULL,
    emergency_contact_phone TEXT NOT NULL,
    emergency_contact_rel TEXT NOT NULL,
    emergency_contact_alt_phone TEXT, -- Stores JSON: contact2, contact3, and bishop (name, phone, ward)
    contact_2_name TEXT,
    contact_2_phone TEXT,
    contact_2_rel TEXT,
    contact_3_name TEXT,
    contact_3_phone TEXT,
    contact_3_rel TEXT,
    bishop_name TEXT,
    bishop_phone TEXT,
    bishop_ward TEXT,
    dietary_restrictions TEXT,
    diet_type TEXT DEFAULT 'standard',
    blood_type TEXT,
    doctor_notes TEXT,
    last_consultation TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Official Schedule Items Table
CREATE TABLE IF NOT EXISTS public.schedule_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day TEXT NOT NULL, -- e.g., 'Dia 1', 'Dia 2', 'Dia 3', 'Dia 4', 'Dia 5'
    date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Geral', -- Espiritual, Alimentação, Atividade, Show, Baile, Logística
    is_highlight BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Official Announcements Table (Broadcast alerts & notifications)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_company_id TEXT, -- NULL for global announcements, or 'cia-1', 'cia-2', etc.
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal', -- 'urgent', 'important', 'normal'
    category TEXT NOT NULL DEFAULT 'Geral',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Transport & Bus Logistics Table (Arrivals & Departures by Stake)
CREATE TABLE IF NOT EXISTS public.transport_logistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_number TEXT NOT NULL,
    stake_city TEXT NOT NULL, -- e.g., 'Estaca Franca', 'Estaca Sertãozinho', 'Estaca Ribeirão Preto Leste'
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    capacity INT NOT NULL DEFAULT 46,
    passengers_count INT NOT NULL DEFAULT 0,
    departure_city_time TEXT NOT NULL,
    arrival_fsy_time TEXT NOT NULL,
    departure_fsy_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'programado', -- 'programado', 'a_caminho', 'chegou', 'retornando', 'concluido'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Automatic Profile Creation Trigger on Auth Signup (Google OAuth & Email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    default_role user_role := 'jovem';
BEGIN
    BEGIN
        -- Assign coordinator role if specific admin email domain or pattern
        IF NEW.email ILIKE '%coordenador%' OR NEW.email ILIKE '%admin%' THEN
            default_role := 'coordenador';
        ELSIF NEW.email ILIKE '%medico%' OR NEW.email ILIKE '%doutor%' THEN
            default_role := 'medico';
        ELSIF NEW.email ILIKE '%logistica%' THEN
            default_role := 'logistica';
        END IF;

        INSERT INTO public.profiles (id, full_name, role, avatar_url)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
            default_role,
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
        )
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = timezone('utc'::text, now());
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- Trigger definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_logistics ENABLE ROW LEVEL SECURITY;

-- Helper security functions
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS user_role AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5. RLS Policies

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Coordinators and Directors can manage profiles" ON public.profiles;
CREATE POLICY "Coordinators and Directors can manage profiles"
    ON public.profiles FOR ALL
    TO authenticated
    USING (public.get_auth_role() IN ('coordenador', 'casal_diretor'));

-- MEDICAL RECORDS POLICIES (Confidential)
DROP POLICY IF EXISTS "Medics and Directors can view all medical records" ON public.medical_records;
CREATE POLICY "Medics and Directors can view all medical records"
    ON public.medical_records FOR SELECT
    TO authenticated
    USING (
        public.get_auth_role()::text IN ('medico', 'casal_diretor', 'coordenador') OR
        user_id = auth.uid()
    );

DROP POLICY IF EXISTS "Medics and Directors can manage medical records" ON public.medical_records;
CREATE POLICY "Medics and Directors can manage medical records"
    ON public.medical_records FOR ALL
    TO authenticated
    USING (public.get_auth_role()::text IN ('medico', 'casal_diretor', 'coordenador'))
    WITH CHECK (public.get_auth_role()::text IN ('medico', 'casal_diretor', 'coordenador'));

DROP POLICY IF EXISTS "Users can view their own medical record" ON public.medical_records;


-- SCHEDULE POLICIES
DROP POLICY IF EXISTS "Anyone authenticated can view schedule" ON public.schedule_items;
CREATE POLICY "Anyone authenticated can view schedule"
    ON public.schedule_items FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Logistics and Coordinators can manage schedule" ON public.schedule_items;
CREATE POLICY "Logistics and Coordinators can manage schedule"
    ON public.schedule_items FOR ALL
    TO authenticated
    USING (public.get_auth_role() IN ('logistica', 'coordenador', 'casal_diretor'));

-- ANNOUNCEMENTS POLICIES
DROP POLICY IF EXISTS "Users can view global or their company announcements" ON public.announcements;
CREATE POLICY "Users can view global or their company announcements"
    ON public.announcements FOR SELECT
    TO authenticated
    USING (
        target_company_id IS NULL OR
        target_company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR
        public.get_auth_role() IN ('coordenador', 'casal_diretor', 'consultor', 'logistica', 'medico')
    );

DROP POLICY IF EXISTS "Staff can manage announcements" ON public.announcements;
CREATE POLICY "Staff can manage announcements"
    ON public.announcements FOR ALL
    TO authenticated
    USING (public.get_auth_role() IN ('coordenador', 'casal_diretor', 'consultor'));

-- TRANSPORT LOGISTICS POLICIES
DROP POLICY IF EXISTS "Anyone authenticated can view transport schedule" ON public.transport_logistics;
CREATE POLICY "Anyone authenticated can view transport schedule"
    ON public.transport_logistics FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Logistics and Coordinators can manage transport" ON public.transport_logistics;
CREATE POLICY "Logistics and Coordinators can manage transport"
    ON public.transport_logistics FOR ALL
    TO authenticated
    USING (public.get_auth_role() IN ('logistica', 'coordenador', 'casal_diretor'));

-- 7. Media Photos Table (Gerenciada pela Equipe de Mídia)
CREATE TABLE IF NOT EXISTS public.media_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    drive_url TEXT NOT NULL,
    thumbnail_url TEXT,
    category TEXT DEFAULT 'Geral',
    visible BOOLEAN DEFAULT true,
    author_id UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.media_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view visible media photos" ON public.media_photos;
CREATE POLICY "Anyone authenticated can view visible media photos"
    ON public.media_photos FOR SELECT
    TO authenticated
    USING (true);

-- 8. Companies Table RLS Policies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view companies" ON public.companies;
CREATE POLICY "Anyone authenticated can view companies"
    ON public.companies FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Directors, Coordinators and Logistics can manage companies" ON public.companies;
CREATE POLICY "Directors, Coordinators and Logistics can manage companies"
    ON public.companies FOR ALL
    TO authenticated
    USING (public.get_auth_role() IN ('coordenador', 'casal_diretor', 'logistica'));

-- 9. Medical Appointments Table (Equipe Multidisciplinar)
CREATE TABLE IF NOT EXISTS public.medical_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    medical_record_id UUID REFERENCES public.medical_records(id) ON DELETE SET NULL,
    youth_name TEXT NOT NULL,
    professional_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'agendado', -- 'agendado', 'realizado', 'cancelado'
    is_seen BOOLEAN NOT NULL DEFAULT false,
    seen_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.medical_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own medical appointments" ON public.medical_appointments;
CREATE POLICY "Users can view their own medical appointments"
    ON public.medical_appointments FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid() OR
        public.get_auth_role() IN ('medico', 'coordenador', 'casal_diretor')
    );

DROP POLICY IF EXISTS "Users can mark their own appointment as seen" ON public.medical_appointments;
CREATE POLICY "Users can mark their own appointment as seen"
    ON public.medical_appointments FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Medics and Coordinators can manage appointments" ON public.medical_appointments;
CREATE POLICY "Medics and Coordinators can manage appointments"
    ON public.medical_appointments FOR ALL
    TO authenticated
    USING (public.get_auth_role() IN ('medico', 'coordenador', 'casal_diretor'));

-- 10. Counselor Audit Logs Table (Auditoria das alterações dos consultores)
CREATE TABLE IF NOT EXISTS public.counselor_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    author_role TEXT NOT NULL DEFAULT 'consultor',
    company_id TEXT,
    company_name TEXT,
    action_type TEXT NOT NULL, -- 'publicou_comunicado', 'excluiu_comunicado', 'atualizou_grito_de_guerra', etc.
    action_label TEXT NOT NULL, -- 'Novo Comunicado Publicado', 'Comunicado Removido'
    title TEXT,
    content TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_counselor_audit_created_at ON public.counselor_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_counselor_audit_author_name ON public.counselor_audit_logs(author_name);
CREATE INDEX IF NOT EXISTS idx_counselor_audit_company_id ON public.counselor_audit_logs(company_id);

ALTER TABLE public.counselor_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors, Coordinators and Logistics can view counselor audit logs" ON public.counselor_audit_logs;
CREATE POLICY "Directors, Coordinators and Logistics can view counselor audit logs"
    ON public.counselor_audit_logs FOR SELECT
    TO authenticated
    USING (public.get_auth_role() IN ('coordenador', 'casal_diretor', 'logistica'));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.counselor_audit_logs;
CREATE POLICY "Authenticated users can insert audit logs"
    ON public.counselor_audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Directors, Coordinators and Logistics can delete counselor audit logs" ON public.counselor_audit_logs;
CREATE POLICY "Directors, Coordinators and Logistics can delete counselor audit logs"
    ON public.counselor_audit_logs FOR DELETE
    TO authenticated
    USING (public.get_auth_role() IN ('coordenador', 'casal_diretor', 'logistica'));

