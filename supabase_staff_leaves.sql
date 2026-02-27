-- Run this in your Supabase SQL Editor to create the staff_leaves table

CREATE TABLE IF NOT EXISTS public.staff_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

-- Create policies for access control
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
