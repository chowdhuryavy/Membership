
-- ==========================================
-- INCENTIVE RULES SCHEMA V4.0 (DISTRIBUTION)
-- ==========================================

DROP TABLE IF EXISTS public.incentive_rules;

CREATE TABLE public.incentive_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    
    -- Scoping Mechanism
    scope TEXT NOT NULL CHECK (scope IN ('Global', 'Property', 'Outlet')),
    scope_id TEXT NOT NULL, -- Property ID, Outlet ID, or 'global'
    
    -- Application Logic
    applies_to TEXT NOT NULL, -- 'Membership' | 'Massage' | 'Sale'
    target_id TEXT NOT NULL DEFAULT 'all', -- Specific Item ID or 'all'
    
    -- NEW: Distribution Logic
    distribution_type TEXT NOT NULL DEFAULT 'Individual', -- 'Individual' | 'Shared'
    
    -- Calculation Logic
    calculation_type TEXT NOT NULL, -- 'Percentage' | 'Fixed'
    value NUMERIC NOT NULL DEFAULT 0,
    
    -- Conditional Logic Columns
    min_price NUMERIC DEFAULT 0,
    max_price NUMERIC DEFAULT 99999,
    min_duration_minutes INTEGER DEFAULT 0,
    max_duration_minutes INTEGER DEFAULT 999,
    
    -- Modifiers
    apply_discount_percentage BOOLEAN DEFAULT TRUE, 
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADD Sales Rep Column to Members if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='sales_rep_id') THEN
        ALTER TABLE public.members ADD COLUMN sales_rep_id TEXT;
    END IF;
END $$;

-- ENABLE RLS FOR INTERNAL SYSTEM OPERATIONS
ALTER TABLE public.incentive_rules ENABLE ROW LEVEL SECURITY;

-- GRANT PERMISSIONS
GRANT ALL ON TABLE public.incentive_rules TO anon, authenticated, postgres;
