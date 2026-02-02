
-- ==========================================
-- MEMBERSHIP ERP - SECURE SCHEMA SETUP
-- ==========================================

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

-- 4. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- ==========================================
-- ADMINISTRATIVE HELPER FUNCTIONS (No Recursion)
-- ==========================================

-- This function bypasses RLS to check admin status safely
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

-- ==========================================
-- UPDATED RLS POLICIES
-- ==========================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Select policies (Allow all authenticated users to read)
CREATE POLICY "Read Roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read Profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read Properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read Outlets" ON public.outlets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read Categories" ON public.membership_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Read Members" ON public.members FOR SELECT TO authenticated USING (true);

-- Write policies (Use the is_admin() function to prevent 403 recursion)
CREATE POLICY "Admin Manage Roles" ON public.roles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin Manage Properties" ON public.properties FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin Manage Outlets" ON public.outlets FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin Manage Categories" ON public.membership_categories FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admin Manage Members" ON public.members FOR ALL TO authenticated USING (public.is_admin());

-- Special Policy for Profiles (Admins can manage all, users can manage self)
CREATE POLICY "Manage Profiles" ON public.profiles FOR ALL TO authenticated 
USING (public.is_admin() OR id = auth.uid());

-- ==========================================
-- SEED DATA
-- ==========================================

INSERT INTO public.roles (id, name, permissions, is_system)
VALUES ('admin', 'Administrator', '{"members:view", "members:create", "members:edit", "members:delete", "categories:view", "categories:create", "categories:edit", "categories:delete", "users:view", "users:create", "users:edit", "users:delete", "settings:view", "settings:edit", "reports:view", "reports:export", "logs:view", "properties:view", "properties:edit", "outlets:view", "outlets:edit"}', true)
ON CONFLICT (id) DO NOTHING;
