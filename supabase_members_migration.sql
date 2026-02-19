
-- Ensure all optional identity and family fields exist in the members table
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_married BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'Single'; -- Single, Couple, Family
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS access_type TEXT DEFAULT 'Both'; -- Pool, Spa, Both
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS membership_type TEXT DEFAULT 'New'; -- New, Renew
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spouse_name TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS spouse_dob TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS kids JSONB DEFAULT '[]'::jsonb;
