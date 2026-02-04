
-- ==========================================
-- MEMBERSHIP ERP - CORE SCHEMA V3.0 (CLEAN)
-- ==========================================

-- 1. CLEANUP PREVIOUS POLICIES (Idempotency Guard)
DO $$ 
BEGIN
    -- Profiles
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Profiles') THEN DROP POLICY "Public Profiles" ON public.profiles; END IF;
    -- Roles
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Roles') THEN DROP POLICY "Auth View Roles" ON public.roles; END IF;
    -- Properties
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Properties') THEN DROP POLICY "Auth View Properties" ON public.properties; END IF;
    -- Outlets
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Outlets') THEN DROP POLICY "Auth View Outlets" ON public.outlets; END IF;
    -- Categories
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Categories') THEN DROP POLICY "Auth View Categories" ON public.membership_categories; END IF;
    -- Members
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Members') THEN DROP POLICY "Auth View Members" ON public.members; END IF;
    -- Freezes
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Freezes') THEN DROP POLICY "Auth View Freezes" ON public.freezes; END IF;
    -- Settings
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Settings') THEN DROP POLICY "Auth View Settings" ON public.company_settings; END IF;
    -- Currencies
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth View Currencies') THEN DROP POLICY "Auth View Currencies" ON public.currencies; END IF;
    -- Logs
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Logs') THEN DROP POLICY "Public Logs" ON public.system_logs; END IF;
END $$;

-- 2. CORE TABLES
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.outlets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE, 
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role_id TEXT REFERENCES public.roles(id),
    allowed_outlets TEXT[] DEFAULT '{}',
    temp_password TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.membership_categories (
    id TEXT PRIMARY KEY,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    base_rate NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    membership_number TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    category_id TEXT REFERENCES public.membership_categories(id),
    start_date DATE NOT NULL,
    original_end_date DATE NOT NULL,
    current_end_date DATE NOT NULL,
    actual_rate NUMERIC(15,2) NOT NULL,
    discount NUMERIC(15,2) DEFAULT 0,
    net_amount NUMERIC(15,2) NOT NULL,
    daily_rate NUMERIC(15,4) NOT NULL,
    check_no TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.freezes (
    id TEXT PRIMARY KEY,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    name TEXT NOT NULL DEFAULT 'Membership ERP',
    logo_url TEXT,
    address TEXT,
    currency_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.currencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    symbol TEXT NOT NULL,
    rate NUMERIC(15,6) DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    outlet_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 4. RECREATE POLICIES
CREATE POLICY "Public Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Logs" ON public.system_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth View Roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth View Properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth View Outlets" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth View Categories" ON public.membership_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth View Members" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth View Freezes" ON public.freezes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth View Settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth View Currencies" ON public.currencies FOR SELECT TO authenticated USING (true);

-- 5. SEED INITIAL ADMIN ROLE
INSERT INTO public.roles (id, name, permissions, is_system)
VALUES ('admin', 'Administrator', '{"members:view", "members:create", "members:edit", "members:delete", "categories:view", "categories:create", "categories:edit", "categories:delete", "users:view", "users:create", "users:edit", "users:delete", "settings:view", "settings:edit", "reports:view", "reports:export", "logs:view", "properties:view", "properties:edit", "outlets:view", "outlets:edit"}', true)
ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions;

INSERT INTO public.company_settings (id, name) 
VALUES ('global', 'Membership ERP') 
ON CONFLICT (id) DO NOTHING;
