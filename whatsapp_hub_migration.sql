-- =========================================================================
-- WHATSAPP HUB & SIDEBAR VISIBILITY MIGRATION
-- Adds whatsapp_enabled to properties & outlets, and visibility configs to company_settings
-- =========================================================================

-- 1. Add whatsapp_enabled to properties table if not exists
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true;

-- 2. Add whatsapp_enabled to outlets table if not exists
ALTER TABLE public.outlets 
ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT true;

-- 3. Add whatsapp tracking columns to company_settings table if not exists
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS whatsapp_disabled_outlets JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS whatsapp_disabled_properties JSONB DEFAULT '[]'::jsonb;
