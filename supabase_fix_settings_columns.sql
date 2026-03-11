
-- ==========================================
-- SETTINGS SCHEMA REPAIR V1.0
-- ==========================================

-- 1. REPAIR COMPANY_SETTINGS TABLE
DO $$ 
BEGIN 
    -- Add missing columns to company_settings
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='report_title') THEN
        ALTER TABLE public.company_settings ADD COLUMN report_title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='report_subtitle') THEN
        ALTER TABLE public.company_settings ADD COLUMN report_subtitle TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='signatory_prepared_role') THEN
        ALTER TABLE public.company_settings ADD COLUMN signatory_prepared_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='signatory_reviewed_role') THEN
        ALTER TABLE public.company_settings ADD COLUMN signatory_reviewed_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='signatory_approved_role') THEN
        ALTER TABLE public.company_settings ADD COLUMN signatory_approved_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='keyboard_shortcuts') THEN
        ALTER TABLE public.company_settings ADD COLUMN keyboard_shortcuts JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='contract_template') THEN
        ALTER TABLE public.company_settings ADD COLUMN contract_template TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='conditions') THEN
        ALTER TABLE public.company_settings ADD COLUMN conditions TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='required_signatories') THEN
        ALTER TABLE public.company_settings ADD COLUMN required_signatories TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 2. REPAIR PROPERTIES TABLE
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='signatory_prepared_role') THEN
        ALTER TABLE public.properties ADD COLUMN signatory_prepared_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='signatory_reviewed_role') THEN
        ALTER TABLE public.properties ADD COLUMN signatory_reviewed_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='signatory_approved_role') THEN
        ALTER TABLE public.properties ADD COLUMN signatory_approved_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='required_signatories') THEN
        ALTER TABLE public.properties ADD COLUMN required_signatories TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 3. REPAIR OUTLETS TABLE
DO $$ 
BEGIN 
    -- Add missing columns to outlets
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='signatory_prepared_role') THEN
        ALTER TABLE public.outlets ADD COLUMN signatory_prepared_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='signatory_reviewed_role') THEN
        ALTER TABLE public.outlets ADD COLUMN signatory_reviewed_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='signatory_approved_role') THEN
        ALTER TABLE public.outlets ADD COLUMN signatory_approved_role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='required_signatories') THEN
        ALTER TABLE public.outlets ADD COLUMN required_signatories TEXT[] DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='contract_template') THEN
        ALTER TABLE public.outlets ADD COLUMN contract_template TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='conditions') THEN
        ALTER TABLE public.outlets ADD COLUMN conditions TEXT;
    END IF;
END $$;
