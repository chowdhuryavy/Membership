ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS restricted_permissions JSONB DEFAULT '[]'::jsonb;
