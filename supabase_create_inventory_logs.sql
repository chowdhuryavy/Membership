-- Create inventory_logs table if it doesn't exist
-- Using TEXT for IDs to match your existing schema
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    item_id TEXT REFERENCES public.inventory(id) ON DELETE CASCADE,
    property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
    outlet_id TEXT REFERENCES public.outlets(id) ON DELETE CASCADE,
    change_amount INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for all access (authenticated users)
CREATE POLICY "Allow all access to authenticated users" 
ON public.inventory_logs FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
