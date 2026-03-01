
-- ==========================================
-- GRANULAR PERMISSION OVERRIDES SCHEMA V1.1
-- ==========================================

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, permission_key)
);

-- ENABLE RLS FOR INTERNAL SYSTEM OPERATIONS
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- GRANT PERMISSIONS
GRANT ALL ON TABLE public.user_permission_overrides TO anon, authenticated, postgres;

-- TRIGGER FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_overrides_modtime
    BEFORE UPDATE ON public.user_permission_overrides
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();
