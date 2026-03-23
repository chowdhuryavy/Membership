-- ==========================================
-- MAINTENANCE BATCHES SCHEMA UPDATE
-- ==========================================

-- 1. Create maintenance_batches table
CREATE TABLE IF NOT EXISTS public.maintenance_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add maintenance_batch_id to freezes table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='freezes' AND column_name='maintenance_batch_id') THEN
        ALTER TABLE public.freezes ADD COLUMN maintenance_batch_id UUID REFERENCES public.maintenance_batches(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.maintenance_batches ENABLE ROW LEVEL SECURITY;

-- 4. Grant permissions
GRANT ALL ON TABLE public.maintenance_batches TO anon, authenticated, postgres;

-- 5. Create policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_batches' AND policyname = 'System Access Policy') THEN
        CREATE POLICY "System Access Policy" ON public.maintenance_batches FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 6. Add comments
COMMENT ON TABLE public.maintenance_batches IS 'Groups bulk maintenance suspensions together';
COMMENT ON COLUMN public.freezes.maintenance_batch_id IS 'Links a freeze to a specific maintenance batch';
