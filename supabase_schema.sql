
-- ==========================================
-- SYSTEM CONFIGURATION EXTENSION: NAV ORDER
-- ==========================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='navigation_order') THEN
        ALTER TABLE public.company_settings ADD COLUMN navigation_order JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Ensure RLS doesn't block updates
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.company_settings TO anon, authenticated, postgres;
