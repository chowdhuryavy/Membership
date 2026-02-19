-- REPAIR: ADD 'outlet_id' TO SALES TABLE
ALTER TABLE IF EXISTS public.sales 
ADD COLUMN IF NOT EXISTS outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE;

-- REFRESH POLICIES
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.sales TO anon, authenticated, postgres;