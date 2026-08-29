-- Migration to add referral payee and shared incentive override to incentive_rules table
-- Execute this in your Supabase SQL Editor

ALTER TABLE incentive_rules 
ADD COLUMN IF NOT EXISTS referral_payee TEXT DEFAULT 'Staff';

ALTER TABLE incentive_rules 
ADD COLUMN IF NOT EXISTS disable_shared_incentive BOOLEAN DEFAULT false;

-- Add inactive_date to staff table
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS inactive_date DATE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_incentive_rules_applies_to ON incentive_rules(applies_to);

-- Optional: Update existing referral rules to default to 'Staff'
UPDATE incentive_rules SET referral_payee = 'Staff' WHERE applies_to = 'Referral' AND referral_payee IS NULL;

-- ----------------------------------------------------
-- RECENT ADDITIONS FOR PRIVILEGES
-- ----------------------------------------------------

-- Add privileges to membership_categories
ALTER TABLE membership_categories 
ADD COLUMN IF NOT EXISTS privileges JSONB DEFAULT '[]'::jsonb;

-- Add privilege_usage to members
ALTER TABLE members
ADD COLUMN IF NOT EXISTS privilege_usage JSONB DEFAULT '[]'::jsonb;

-- ----------------------------------------------------
-- PT MEMBERS HEALTH DECLARATION & SIGNATURE ENHANCEMENTS
-- ----------------------------------------------------

ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS member_signature TEXT;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS parq_answers JSONB;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS parq_details TEXT;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS is_under_18 BOOLEAN DEFAULT false;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS guardian_relationship TEXT;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS guardian_contact TEXT;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS guardian_signature TEXT;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS membership_number TEXT;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS property_id UUID;
ALTER TABLE pt_members ADD COLUMN IF NOT EXISTS trainer_id UUID;

-- ----------------------------------------------------
-- DAILY DATA BACKUP CONFIGURATION FOR OUTLETS
-- ----------------------------------------------------

ALTER TABLE outlets 
ADD COLUMN IF NOT EXISTS backup_email TEXT,
ADD COLUMN IF NOT EXISTS backup_enabled BOOLEAN DEFAULT false;
