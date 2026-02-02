
-- =========================================================
-- STEP 1: BREAK THE IDENTITY LOCK (RUN THIS FIRST)
-- =========================================================

-- We must remove the requirement that a Profile ID must exist in Auth.Users.
-- This allows us to "Deploy" (provision) users before they have signed up.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
    -- Catch-all for other common naming conventions
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey') THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_user_id_fkey;
    END IF;
END $$;

-- =========================================================
-- STEP 2: REBUILD PROFILES TABLE (STANDALONE)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE, -- This stores the real Supabase Auth ID after registration
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role_id TEXT, -- Will link to roles table
    allowed_outlets TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- STEP 3: CORE ERP TABLES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.properties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT
);

CREATE TABLE IF NOT EXISTS public.outlets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.membership_categories (
    id TEXT PRIMARY KEY,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    base_rate NUMERIC(15,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    membership_number TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    category_id TEXT REFERENCES public.membership_categories(id),
    start_date DATE NOT NULL,
    current_end_date DATE NOT NULL,
    net_amount NUMERIC(15,2) NOT NULL,
    status TEXT DEFAULT 'Active'
);

-- =========================================================
-- STEP 4: SECURITY & AUTOMATION
-- =========================================================

-- Admin bypass for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE (auth_id = auth.uid() OR id = auth.uid()) 
    AND role_id = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles Viewable" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());

-- TRIGGER: AUTOMATICALLY LINK REGISTERING USERS TO PROFILES
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  -- If a profile with this email was pre-provisioned, update it with the REAL Auth ID
  UPDATE public.profiles 
  SET auth_id = new.id, updated_at = NOW() 
  WHERE email = new.email;
  
  -- If no profile existed, create a default admin one (Safety net)
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, auth_id, email, name, role_id)
    VALUES (new.id, new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', 'Staff'), 'admin');
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();

-- =========================================================
-- STEP 5: SEED DATA
-- =========================================================

INSERT INTO public.roles (id, name, permissions, is_system)
VALUES ('admin', 'Administrator', '{"members:view", "members:create", "members:edit", "members:delete", "categories:view", "categories:create", "categories:edit", "categories:delete", "users:view", "users:create", "users:edit", "users:delete", "settings:view", "settings:edit", "reports:view", "reports:export", "logs:view", "properties:view", "properties:edit", "outlets:view", "outlets:edit"}', true)
ON CONFLICT (id) DO NOTHING;
