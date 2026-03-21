-- ==========================================
-- MEMBERSHIP SUSPENSION (FREEZE) SCHEMA V2.0
-- ==========================================

-- 1. CREATE FREEZES TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.freezes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id TEXT NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    is_maintenance BOOLEAN DEFAULT FALSE,
    batch_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ADD NEW COLUMNS IF TABLE ALREADY EXISTS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='freezes' AND column_name='reason') THEN
        ALTER TABLE public.freezes ADD COLUMN reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='freezes' AND column_name='is_maintenance') THEN
        ALTER TABLE public.freezes ADD COLUMN is_maintenance BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='freezes' AND column_name='batch_id') THEN
        ALTER TABLE public.freezes ADD COLUMN batch_id UUID;
    END IF;
END $$;

-- 3. CREATE SYSTEM LOGS TABLE FOR AUDIT HISTORY
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    details TEXT,
    outlet_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE RLS
ALTER TABLE public.freezes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.freezes TO anon, authenticated, postgres;
GRANT ALL ON TABLE public.system_logs TO anon, authenticated, postgres;

-- 6. CREATE POLICIES (PERMISSIVE FOR SYSTEM OPERATIONS)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'freezes' AND policyname = 'System Access Policy') THEN
        CREATE POLICY "System Access Policy" ON public.freezes FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'System Access Policy') THEN
        CREATE POLICY "System Access Policy" ON public.system_logs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 7. ADD COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE public.freezes IS 'Stores membership suspension periods and extensions';
COMMENT ON COLUMN public.freezes.is_maintenance IS 'If true, this freeze does not count towards the members tier limit';
COMMENT ON COLUMN public.freezes.reason IS 'The administrative reason for the suspension';
COMMENT ON COLUMN public.freezes.batch_id IS 'Groups bulk freezes together';
COMMENT ON TABLE public.system_logs IS 'Centralized audit trail for all operational actions';
