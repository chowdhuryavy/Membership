-- ==============================================================================
-- MIGRATION: Add guest_portal_settings and guest_portal_settings_map to company_settings
-- ==============================================================================
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- to provision dedicated JSONB columns for the Guest Portal navigation button order
-- and privilege configurations.

-- 1. Add dedicated JSONB columns if they don't already exist
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS guest_portal_settings JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS guest_portal_settings_map JSONB DEFAULT '{}'::jsonb;

-- 2. Populate newly added columns from existing staff_portal_settings if data exists
UPDATE company_settings 
SET 
  guest_portal_settings = COALESCE(
    guest_portal_settings,
    staff_portal_settings->'guest_portal_settings',
    '{}'::jsonb
  ),
  guest_portal_settings_map = COALESCE(
    guest_portal_settings_map,
    staff_portal_settings->'guest_portal_settings_map',
    '{}'::jsonb
  )
WHERE id = 'global';

-- 3. Document the schema columns
COMMENT ON COLUMN company_settings.guest_portal_settings IS 'Global guest portal configuration, feature visibility toggles, and mobile navigation button order (nav_button_order)';
COMMENT ON COLUMN company_settings.guest_portal_settings_map IS 'Per-facility (outlet/property) guest portal configuration overrides and navigation button orders';

-- Verify result:
SELECT 
  id, 
  name, 
  guest_portal_settings->'nav_button_order' AS global_nav_order,
  guest_portal_settings_map 
FROM company_settings 
WHERE id = 'global';
