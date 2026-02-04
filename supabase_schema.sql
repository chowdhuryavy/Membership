
-- ==========================================
-- MEMBERSHIP ERP - CORE SCHEMA V3.1 (WRITE ACCESS)
-- ==========================================

-- 1. CLEANUP PREVIOUS POLICIES
DROP POLICY IF EXISTS "Public Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Auth View Roles" ON public.roles;
DROP POLICY IF EXISTS "Auth View Properties" ON public.properties;
DROP POLICY IF EXISTS "Auth Manage Properties" ON public.properties;
DROP POLICY IF EXISTS "Auth View Outlets" ON public.outlets;
DROP POLICY IF EXISTS "Auth Manage Outlets" ON public.outlets;
DROP POLICY IF EXISTS "Auth View Categories" ON public.membership_categories;
DROP POLICY IF EXISTS "Auth Manage Categories" ON public.membership_categories;
DROP POLICY IF EXISTS "Auth View Members" ON public.members;
DROP POLICY IF EXISTS "Auth Manage Members" ON public.members;
DROP POLICY IF EXISTS "Auth View Freezes" ON public.freezes;
DROP POLICY IF EXISTS "Auth Manage Freezes" ON public.freezes;
DROP POLICY IF EXISTS "Auth View Settings" ON public.company_settings;
DROP POLICY IF EXISTS "Auth Manage Settings" ON public.company_settings;
DROP POLICY IF EXISTS "Auth View Currencies" ON public.currencies;
DROP POLICY IF EXISTS "Auth Manage Currencies" ON public.currencies;
DROP POLICY IF EXISTS "Public Logs" ON public.system_logs;

-- 2. RECREATE TABLES (Idempotent)
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

-- 4. RECREATE POLICIES (Granting Write Access)
CREATE POLICY "Public Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Logs" ON public.system_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Roles" ON public.roles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Properties" ON public.properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Outlets" ON public.outlets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Categories" ON public.membership_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Members" ON public.members FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Freezes" ON public.freezes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Settings" ON public.company_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth Manage Currencies" ON public.currencies FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. SEED INITIAL DATA
INSERT INTO public.roles (id, name, permissions, is_system)
VALUES ('admin', 'Administrator', '{"members:view", "members:create", "members:edit", "members:delete", "categories:view", "categories:create", "categories:edit", "categories:delete", "users:view", "users:create", "users:edit", "users:delete", "settings:view", "settings:edit", "reports:view", "reports:export", "logs:view", "properties:view", "properties:edit", "outlets:view", "outlets:edit"}', true)
ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions;

INSERT INTO public.company_settings (id, name) 
VALUES ('global', 'Membership ERP') 
ON CONFLICT (id) DO NOTHING;
