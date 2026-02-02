
-- ==========================================
-- MEMBERSHIP ERP - SUPABASE SCHEMA SETUP
-- ==========================================

-- 1. SECURITY ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROPERTIES & PORTFOLIOS
CREATE TABLE IF NOT EXISTS public.properties (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FACILITY OUTLETS
CREATE TABLE IF NOT EXISTS public.outlets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USER PROFILES (Linked to Auth.Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role_id TEXT REFERENCES public.roles(id),
    allowed_outlets TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. REVENUE CATEGORIES / TIERS
CREATE TABLE IF NOT EXISTS public.membership_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    base_rate NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEMBERSHIP LEDGER
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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

-- 7. TEMPORAL FREEZES / EXTENSIONS
CREATE TABLE IF NOT EXISTS public.freezes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SYSTEM CONFIGURATIONS
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    name TEXT NOT NULL DEFAULT 'Membership ERP',
    logo_url TEXT,
    address TEXT,
    currency_id TEXT,
    report_title TEXT,
    report_subtitle TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CURRENCY STANDARDS
CREATE TABLE IF NOT EXISTS public.currencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    symbol TEXT NOT NULL,
    rate NUMERIC(15,6) DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.system_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    outlet_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 1. SELECT POLICIES (Read access for all authenticated)
DO $$ BEGIN
    CREATE POLICY "View Roles" ON public.roles FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Properties" ON public.properties FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Outlets" ON public.outlets FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Currencies" ON public.currencies FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Categories" ON public.membership_categories FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Members" ON public.members FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Freezes" ON public.freezes FOR SELECT TO authenticated USING (true);
    CREATE POLICY "View Logs" ON public.system_logs FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN others THEN NULL; END $$;

-- 2. MANAGEMENT POLICIES (Simplified Admin Check)
-- Note: We allow users to update their own profile and admins to update everything
DO $$ BEGIN
    CREATE POLICY "Admins Manage Everything Roles" ON public.roles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Properties" ON public.properties FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Outlets" ON public.outlets FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Categories" ON public.membership_categories FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Members" ON public.members FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Freezes" ON public.freezes FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Settings" ON public.company_settings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Currencies" ON public.currencies FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    CREATE POLICY "Admins Manage Everything Logs" ON public.system_logs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
    
    -- Special handling for profiles to avoid recursion during first creation
    CREATE POLICY "Admins Manage All Profiles" ON public.profiles FOR ALL TO authenticated USING (role_id = 'admin' OR id = auth.uid());
EXCEPTION WHEN others THEN NULL; END $$;

-- ==========================================
-- AUTOMATION TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role_id)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', 'admin')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- SEED DATA
-- ==========================================

INSERT INTO public.roles (id, name, permissions, is_system)
VALUES ('admin', 'Administrator', '{
  "members:view", "members:create", "members:edit", "members:delete",
  "categories:view", "categories:create", "categories:edit", "categories:delete",
  "users:view", "users:create", "users:edit", "users:delete",
  "settings:view", "settings:edit",
  "reports:view", "reports:export",
  "logs:view",
  "properties:view", "properties:edit",
  "outlets:view", "outlets:edit"
}', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_settings (id, name) VALUES ('global', 'Membership ERP') ON CONFLICT DO NOTHING;
