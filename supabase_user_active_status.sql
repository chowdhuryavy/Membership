-- ADD is_active COLUMN TO profiles TABLE
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- REFRESH PERMISSIONS
GRANT ALL ON TABLE public.profiles TO anon, authenticated, postgres;
