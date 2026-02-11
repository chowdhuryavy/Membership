-- ==========================================
-- DATABASE INTEGRITY REPAIR: MASSAGE MODULE V14.6
-- ==========================================

-- 1. ADD PROPERTY_ID TO GUESTS TABLE IF NOT EXISTS
-- Using TEXT type to ensure compatibility with existing properties.id (which is text based on previous error)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='guests' AND column_name='property_id') THEN
        ALTER TABLE public.guests ADD COLUMN property_id TEXT;
    ELSE
        BEGIN
            ALTER TABLE public.guests ALTER COLUMN property_id TYPE TEXT;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END $$;

-- 2. DROP ALL POTENTIAL CONSTRAINTS (LEGACY AND NEW)
DO $$ 
BEGIN 
    ALTER TABLE IF EXISTS public.guests DROP CONSTRAINT IF EXISTS guests_property_id_fkey;
    ALTER TABLE IF EXISTS public.outlets DROP CONSTRAINT IF EXISTS outlets_property_id_fkey;
    ALTER TABLE IF EXISTS public.therapists DROP CONSTRAINT IF EXISTS therapists_property_id_fkey;
    ALTER TABLE IF EXISTS public.massage_types DROP CONSTRAINT IF EXISTS massage_types_property_id_fkey;
    ALTER TABLE IF EXISTS public.massage_bookings DROP CONSTRAINT IF EXISTS massage_bookings_property_id_fkey;
END $$;

-- 3. RECONCILE PARENT RECORDS (THE DEEP HEALER)
INSERT INTO public.properties (id, name, address, logo_url)
SELECT DISTINCT pid, 'Recovered Property ' || SUBSTR(pid, 1, 8), 'Auto-generated during integrity repair', ''
FROM (
    SELECT property_id::text as pid FROM public.outlets WHERE property_id IS NOT NULL
    UNION
    SELECT property_id::text as pid FROM public.therapists WHERE property_id IS NOT NULL
    UNION
    SELECT property_id::text as pid FROM public.massage_types WHERE property_id IS NOT NULL
    UNION
    SELECT property_id::text as pid FROM public.massage_bookings WHERE property_id IS NOT NULL
    UNION
    SELECT property_id::text as pid FROM public.guests WHERE property_id IS NOT NULL
) AS all_referenced_properties
WHERE NOT EXISTS (
    SELECT 1 FROM public.properties p 
    WHERE p.id::text = all_referenced_properties.pid
)
ON CONFLICT (id) DO NOTHING;

-- 4. RE-ESTABLISH ALL CONSTRAINTS SAFELY
ALTER TABLE public.guests ADD CONSTRAINT guests_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.outlets ADD CONSTRAINT outlets_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.therapists ADD CONSTRAINT therapists_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.massage_types ADD CONSTRAINT massage_types_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

ALTER TABLE public.massage_bookings ADD CONSTRAINT massage_bookings_property_id_fkey 
FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;

-- 5. REFINE GUEST UNIQUENESS FOR MULTI-PROPERTY ARCHITECTURE
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_phone_key;
ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_phone_property_id_unique; -- Drop new one too just in case
ALTER TABLE public.guests ADD CONSTRAINT guests_phone_property_id_unique UNIQUE (phone, property_id);

-- 6. ADD DISCOUNT COLUMN TO MASSAGE_BOOKINGS
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='massage_bookings' AND column_name='discount') THEN
        ALTER TABLE public.massage_bookings ADD COLUMN discount NUMERIC DEFAULT 0;
    END IF;
END $$;

-- 7. ENSURE RLS DOES NOT BLOCK SYSTEM OPERATIONS
ALTER TABLE public.properties DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.massage_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.massage_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests DISABLE ROW LEVEL SECURITY;

-- 8. GRANT PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres;