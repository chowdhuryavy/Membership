-- =========================================================================
-- PROPERTY-WISE SMTP CONFIGURATION SCHEMA & RLS POLICIES
-- =========================================================================

-- 1. Create property_smtp_settings table
CREATE TABLE IF NOT EXISTS public.property_smtp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    host TEXT NOT NULL DEFAULT '',
    port INTEGER NOT NULL DEFAULT 587,
    username TEXT NOT NULL DEFAULT '',
    -- Encrypted password stored in format: "iv_hex:auth_tag_hex:ciphertext_hex"
    -- NEVER store plaintext passwords in this column
    encrypted_password TEXT NOT NULL DEFAULT '',
    encryption_version INTEGER NOT NULL DEFAULT 1,
    secure_connection VARCHAR(20) NOT NULL DEFAULT 'tls' CHECK (secure_connection IN ('ssl', 'tls', 'none')),
    from_email TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    last_tested_at TIMESTAMPTZ,
    last_test_status VARCHAR(20), -- 'success' | 'failed'
    last_test_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_property_smtp_property UNIQUE (property_id)
);

-- Index for instant lookup during email dispatch
CREATE INDEX IF NOT EXISTS idx_property_smtp_property_id 
    ON public.property_smtp_settings(property_id);

-- 2. Enable Row Level Security
ALTER TABLE public.property_smtp_settings ENABLE ROW LEVEL SECURITY;

-- 3. Security Policies:
-- Strictly restricted to System Administrators and Service Role
DROP POLICY IF EXISTS "System Admins full access to property SMTP" ON public.property_smtp_settings;
CREATE POLICY "System Admins full access to property SMTP"
    ON public.property_smtp_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(trim(profiles.role_id)) IN ('admin', 'super_admin', 'superadmin', 'system_admin', 'system_administrator', 'owner')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(trim(profiles.role_id)) IN ('admin', 'super_admin', 'superadmin', 'system_admin', 'system_administrator', 'owner')
        )
    );

-- Also allow service role bypass for Edge Functions
DROP POLICY IF EXISTS "Service role full access to property SMTP" ON public.property_smtp_settings;
CREATE POLICY "Service role full access to property SMTP"
    ON public.property_smtp_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4. Secure Public View
-- This view completely omits the encrypted_password column so the frontend never retrieves it.
CREATE OR REPLACE VIEW public.property_smtp_settings_safe AS
SELECT 
    id,
    property_id,
    host,
    port,
    username,
    secure_connection,
    from_email,
    from_name,
    is_enabled,
    (encrypted_password IS NOT NULL AND length(encrypted_password) > 0) AS has_password_configured,
    last_tested_at,
    last_test_status,
    last_test_error,
    created_at,
    updated_at
FROM public.property_smtp_settings;

-- Grant permissions
GRANT ALL ON public.property_smtp_settings TO authenticated;
GRANT ALL ON public.property_smtp_settings TO service_role;
GRANT SELECT ON public.property_smtp_settings_safe TO authenticated;
GRANT SELECT ON public.property_smtp_settings_safe TO service_role;
