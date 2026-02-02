
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Force add auth_id if missing
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='auth_id') THEN
    ALTER TABLE public.profiles ADD COLUMN auth_id UUID UNIQUE;
  END IF;
END $$;

-- Drop the legacy constraint that links profiles directly to auth.users.id
-- This allows "Provisioning" users before they sign up.
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.profiles'::regclass 
        AND confrelid = 'auth.users'::regclass
    ) LOOP
        EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- =========================================================
-- 2. SYSTEM LOGS & SECURITY (FIXES MISSING LOGS)
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

-- IMPORTANT: Enable RLS and add policies so the APP can write to this table
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
  -- Link pre-provisioned profile to new Auth user
  UPDATE public.profiles 
  SET auth_id = new.id, updated_at = NOW() 
  WHERE email = new.email;
  
  -- Create if not exists
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, auth_id, email, name, role_id)
    VALUES (new.id, new.id, new.email, COALESCE(new.raw_user_meta_data->>'name', 'Staff'), 'admin');
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_link ON auth.users;
CREATE TRIGGER on_auth_user_created_link
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user_link();
