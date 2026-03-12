
-- ==========================================
-- SYSTEM CONFIGURATION EXTENSION: RESTRICTED PERMISSIONS
-- ==========================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='restricted_permissions') THEN
        ALTER TABLE public.company_settings ADD COLUMN restricted_permissions JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;
