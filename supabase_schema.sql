
-- =========================================================
-- CRITICAL FIX: REMOVE FOREIGN KEY LOCKS
-- =========================================================

-- This line specifically targets the error you are seeing.
-- It removes the requirement that a profile ID must exist in auth.users.
ALTER TABLE IF EXISTS public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- =========================================================
-- MEMBERSHIP ERP - CORE SCHEMA
-- =========================================================

-- 1. SECURITY ROLES
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROPERTIES
CREATE TABLE IF NOT EXISTS public.properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. OUTLETS
CREATE TABLE IF NOT EXISTS public.outlets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROFILES (Unlinked ID to allow manual creation/deployment)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role_id TEXT REFERENCES public.roles(id),
    allowed_outlets TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CATEGORIES
CREATE TABLE IF NOT EXISTS public.membership_categories (
    id TEXT PRIMARY KEY,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    base_rate NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEMBERS
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

-- 7. SYSTEM CONFIGURATIONS
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    name TEXT NOT NULL DEFAULT 'Membership ERP',
    logo_url TEXT,
    address TEXT,
    currency_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CURRENCIES
CREATE TABLE IF NOT EXISTS public.currencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    symbol TEXT NOT NULL,
    rate NUMERIC(15,6) DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- SECURITY & AUTOMATION
-- ==========================================

-- Admin check bypasses RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role_id = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow Select All" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin Manage All" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
-- Add similar policies for other tables if not already present...

-- TRIGGER: LINKS AUTH USER TO EXISTING PROFILE VIA EMAIL
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Check if a profile already exists for this email
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = new.email) THEN
    UPDATE public.profiles 
    SET id = new.id, updated_at = NOW() 
    WHERE email = new.email;
  ELSE
    -- 2. Create a new one if it doesn't exist
    INSERT INTO public.profiles (id, email, name, role_id)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', 'New User'), 'admin');
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

-- ==========================================
-- SEED
-- ==========================================

INSERT INTO public.roles (id, name, permissions, is_system)
VALUES ('admin', 'Administrator', '{"members:view", "members:create", "members:edit", "members:delete", "categories:view", "categories:create", "categories:edit", "categories:delete", "users:view", "users:create", "users:edit", "users:delete", "settings:view", "settings:edit", "reports:view", "reports:export", "logs:view", "properties:view", "properties:edit", "outlets:view", "outlets:edit"}', true)
ON CONFLICT (id) DO NOTHING;
