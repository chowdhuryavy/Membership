-- Migration: Add session_timeout_minutes column to company_settings table
ALTER TABLE company_settings 
ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 15;

-- Update the existing global row with the current configured value
UPDATE company_settings 
SET session_timeout_minutes = COALESCE(
  (staff_portal_settings->>'session_timeout_minutes')::INTEGER,
  15
)
WHERE id = 'global';
