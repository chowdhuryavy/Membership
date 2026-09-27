-- =========================================================================
-- MIGRATION: PHONE BOOK & UNIFIED GUEST DIRECTORY TABLE
-- Compatible with properties(id) TEXT and outlets(id) TEXT schema
-- =========================================================================

-- 1. Create table with TEXT keys matching properties(id) and outlets(id)
CREATE TABLE IF NOT EXISTS public.phonebook_contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  outlet_id TEXT REFERENCES public.outlets(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT DEFAULT 'Manual',
  category TEXT DEFAULT 'General Contact',
  nationality TEXT,
  dob DATE,
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. If table was previously attempted or created with uuid column types, alter them safely:
DO $$
BEGIN
  -- Fix property_id if uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'phonebook_contacts' 
      AND column_name = 'property_id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.phonebook_contacts DROP CONSTRAINT IF EXISTS phonebook_contacts_property_id_fkey;
    ALTER TABLE public.phonebook_contacts ALTER COLUMN property_id TYPE TEXT;
    ALTER TABLE public.phonebook_contacts ADD CONSTRAINT phonebook_contacts_property_id_fkey 
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;
  END IF;

  -- Fix outlet_id if uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'phonebook_contacts' 
      AND column_name = 'outlet_id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.phonebook_contacts DROP CONSTRAINT IF EXISTS phonebook_contacts_outlet_id_fkey;
    ALTER TABLE public.phonebook_contacts ALTER COLUMN outlet_id TYPE TEXT;
    ALTER TABLE public.phonebook_contacts ADD CONSTRAINT phonebook_contacts_outlet_id_fkey 
      FOREIGN KEY (outlet_id) REFERENCES public.outlets(id) ON DELETE SET NULL;
  END IF;

  -- Fix id if uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'phonebook_contacts' 
      AND column_name = 'id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.phonebook_contacts ALTER COLUMN id TYPE TEXT;
  END IF;
END $$;

-- 3. Enable Row Level Security
ALTER TABLE public.phonebook_contacts ENABLE ROW LEVEL SECURITY;

-- 4. Create permissive policy for app access
DROP POLICY IF EXISTS "Allow all operations on phonebook_contacts" ON public.phonebook_contacts;
CREATE POLICY "Allow all operations on phonebook_contacts"
  ON public.phonebook_contacts FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Performance Indexes for search and scope filtering
CREATE INDEX IF NOT EXISTS idx_phonebook_property ON public.phonebook_contacts(property_id);
CREATE INDEX IF NOT EXISTS idx_phonebook_outlet ON public.phonebook_contacts(outlet_id);
CREATE INDEX IF NOT EXISTS idx_phonebook_phone ON public.phonebook_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_phonebook_name ON public.phonebook_contacts(name);

-- 6. Grant Permissions
GRANT ALL ON public.phonebook_contacts TO authenticated;
GRANT ALL ON public.phonebook_contacts TO anon;
GRANT ALL ON public.phonebook_contacts TO service_role;
