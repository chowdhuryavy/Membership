-- ====================================================================
-- AUTHENTICATION MECHANISM MONITOR MIGRATION
-- Adds account locking, failed attempt counters, and unlock audit fields
-- ====================================================================

-- 1. Profiles Table (Portal / Admin / System Users)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unlocked_by TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_is_locked ON public.profiles(is_locked);
CREATE INDEX IF NOT EXISTS idx_profiles_failed_login ON public.profiles(failed_login_attempts);

-- 2. Staff Table (Staff Portal Personnel)
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unlocked_by TEXT;

CREATE INDEX IF NOT EXISTS idx_staff_is_locked ON public.staff(is_locked);
CREATE INDEX IF NOT EXISTS idx_staff_failed_login ON public.staff(failed_login_attempts);

-- 3. Comments for documentation
COMMENT ON COLUMN public.profiles.failed_login_attempts IS 'Number of consecutive unsuccessful password attempts';
COMMENT ON COLUMN public.profiles.is_locked IS 'Indicates whether account is locked after reaching threshold of 3 failed attempts';
COMMENT ON COLUMN public.profiles.locked_at IS 'Timestamp when the account was locked';
COMMENT ON COLUMN public.profiles.unlocked_at IS 'Timestamp when the account was unlocked by Property Admin';
COMMENT ON COLUMN public.profiles.unlocked_by IS 'Identifier or name of Property Admin or Super Admin who unlocked the account';

COMMENT ON COLUMN public.staff.failed_login_attempts IS 'Number of consecutive unsuccessful password attempts';
COMMENT ON COLUMN public.staff.is_locked IS 'Indicates whether staff portal account is locked after reaching threshold of 3 failed attempts';
COMMENT ON COLUMN public.staff.locked_at IS 'Timestamp when the staff account was locked';
COMMENT ON COLUMN public.staff.unlocked_at IS 'Timestamp when the staff account was unlocked by Property Admin';
COMMENT ON COLUMN public.staff.unlocked_by IS 'Identifier or name of Property Admin or Super Admin who unlocked the staff account';
