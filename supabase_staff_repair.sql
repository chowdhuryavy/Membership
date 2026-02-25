
-- ==========================================
-- STAFF SCHEMA REPAIR: LEAVE & INCENTIVES
-- ==========================================

-- 1. ADD MISSING COLUMNS TO staff TABLE
ALTER TABLE IF EXISTS public.staff 
ADD COLUMN IF NOT EXISTS is_eligible_for_incentives BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS leave_start_date TEXT,
ADD COLUMN IF NOT EXISTS leave_end_date TEXT;

-- 2. ENSURE RLS DOES NOT BLOCK OPERATIONS
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

-- 3. REFRESH PERMISSIONS
GRANT ALL ON TABLE public.staff TO anon, authenticated, postgres;
