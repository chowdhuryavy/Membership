
-- ==========================================
-- SYSTEM CONFIGURATION EXTENSION: NAV ORDER
-- ==========================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='company_settings' AND column_name='navigation_order') THEN
        ALTER TABLE public.company_settings ADD COLUMN navigation_order JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Ensure RLS doesn't block updates
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.company_settings TO anon, authenticated, postgres;

-- ==========================================
-- OUTLETS EXTENSION: BOOKING ENGINE
-- ==========================================

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='booking_enabled') THEN
        ALTER TABLE public.outlets ADD COLUMN booking_enabled BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='booking_start_time') THEN
        ALTER TABLE public.outlets ADD COLUMN booking_start_time TEXT DEFAULT '08:00';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='outlets' AND column_name='booking_end_time') THEN
        ALTER TABLE public.outlets ADD COLUMN booking_end_time TEXT DEFAULT '22:00';
    END IF;
END $$;

-- Ensure RLS doesn't block updates on outlets
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.outlets TO anon, authenticated, postgres;

-- Create policy if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'outlets' AND policyname = 'Allow all operations on outlets'
    ) THEN
        CREATE POLICY "Allow all operations on outlets" ON public.outlets FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==========================================
-- MASSAGE ROOMS SCHEMA
-- ==========================================

CREATE TABLE IF NOT EXISTS public.massage_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES public.properties(id),
    name TEXT NOT NULL,
    number TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.massage_rooms ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.massage_rooms TO anon, authenticated, postgres;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'massage_rooms' AND policyname = 'Allow all operations on massage_rooms'
    ) THEN
        CREATE POLICY "Allow all operations on massage_rooms" ON public.massage_rooms FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

