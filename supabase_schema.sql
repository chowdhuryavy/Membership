
-- ==========================================
-- MEMBERSHIP ERP - SUPABASE SCHEMA SETUP
-- ==========================================

-- 1. SECURITY ROLES & PERMISSIONS
CREATE TABLE public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROPERTIES & PORTFOLIOS
CREATE TABLE public.properties (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FACILITY OUTLETS
CREATE TABLE public.outlets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. USER PROFILES (Linked to Auth.Users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role_id TEXT REFERENCES public.roles(id),
    allowed_outlets TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. REVENUE CATEGORIES / TIERS
CREATE TABLE public.membership_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    base_rate NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEMBERSHIP LEDGER
CREATE TABLE public.members (
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
CREATE TABLE public.freezes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    member_id TEXT REFERENCES public.members(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SYSTEM CONFIGURATIONS
CREATE TABLE public.company_settings (
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
CREATE TABLE public.currencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    code TEXT NOT NULL,
    symbol TEXT NOT NULL,
    rate NUMERIC(15,6) DEFAULT 1,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AUDIT LOGS
CREATE TABLE public.system_logs (
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

-- GLOBAL READ ACCESS FOR AUTHENTICATED USERS
CREATE POLICY "View Access" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.company_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.membership_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.members FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.freezes FOR SELECT TO authenticated USING (true);
CREATE POLICY "View Access" ON public.system_logs FOR SELECT TO authenticated USING (true);

-- ADMIN-ONLY WRITE ACCESS HELPER
-- Assumption: 'admin' is the reserved ID for full clearance
CREATE POLICY "Admin Management" ON public.roles FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
CREATE POLICY "Admin Management" ON public.company_settings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));
CREATE POLICY "Admin Management" ON public.currencies FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role_id = 'admin'));

-- ==========================================
-- AUTOMATION TRIGGERS
-- ==========================================

-- AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role_id)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'name', 'admin');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

INSERT INTO public.currencies (id, code, symbol, rate, is_default)
VALUES ('default', 'USD', '$', 1, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_settings (id, name, currency_id)
VALUES ('global', 'Membership ERP', 'default')
ON CONFLICT (id) DO NOTHING;
