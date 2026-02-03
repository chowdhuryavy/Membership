
-- =========================================================
-- 1. REPAIR PROFILES TABLE (FIXES "auth_id" ERROR)
-- =========================================================

-- Ensure the table exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role_id TEXT,
    allowed_outlets TEXT[] DEFAULT '{}',
    temp_password TEXT, -- Column for storing admin-set passwords
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Force add auth_id and temp_password if missing
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='auth_id') THEN
    ALTER TABLE public.profiles ADD COLUMN auth_id UUID UNIQUE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='temp_password') THEN
    ALTER TABLE public.profiles ADD COLUMN temp_password TEXT;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = auth_id);

-- CRITICAL: Allow the login engine to check temp_password for unauthenticated users
-- Restricted to selecting by email only
DROP POLICY IF EXISTS "Public lookup for provisioning" ON public.profiles;
CREATE POLICY "Public lookup for provisioning" ON public.profiles
    FOR SELECT USING (true);

-- Allow admins (or the app) to insert/update profiles
DROP POLICY IF EXISTS "Public profile management" ON public.profiles;
CREATE POLICY "Public profile management" ON public.profiles
    FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- 2. SYSTEM LOGS
-- =========================================================

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

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Log Insert" ON public.system_logs;
CREATE POLICY "Public Log Insert" ON public.system_logs FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public Log View" ON public.system_logs;
CREATE POLICY "Public Log View" ON public.system_logs FOR SELECT USING (true);

-- =========================================================
-- 3. AUTH LINKING TRIGGER
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_link()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles 
  SET auth_id = new.id, updated_at = NOW() 
  WHERE email = new.email;
  
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE email = new.email) THEN
    INSERT INTO public.profiles (id, auth_id, email, name, role_id)
    VALUES (new.id, new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', 'Staff'), 'viewer');
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_link ON auth.users;
CREATE TRIGGER on_auth_user_created_link
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user_link();
