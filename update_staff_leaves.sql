-- Run this in your Supabase SQL Editor to ensure staff_leaves table exists and is correct

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.staff_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. Enable RLS
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

-- 3. Create policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated read access to staff_leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Allow authenticated insert access to staff_leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Allow authenticated update access to staff_leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Allow authenticated delete access to staff_leaves" ON public.staff_leaves;

CREATE POLICY "Allow authenticated read access to staff_leaves"
    ON public.staff_leaves FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated insert access to staff_leaves"
    ON public.staff_leaves FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to staff_leaves"
    ON public.staff_leaves FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated delete access to staff_leaves"
    ON public.staff_leaves FOR DELETE
    TO authenticated
    USING (true);

-- 4. Grant permissions
GRANT ALL ON TABLE public.staff_leaves TO anon, authenticated, postgres;

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';
