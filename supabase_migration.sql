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
