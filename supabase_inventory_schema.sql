
-- ==========================================
-- INVENTORY & MASTER CATALOG SCHEMA V1.0
-- ==========================================

CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    outlet_id TEXT NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Retail, Personal Training, Entrance Fee, Other
    price NUMERIC NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADD ITEM_ID TO SALES FOR STOCK TRACKING
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='item_id') THEN
        ALTER TABLE public.sales ADD COLUMN item_id TEXT REFERENCES public.inventory(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ENABLE RLS FOR INTERNAL SYSTEM OPERATIONS (MAINTAINING PARITY WITH EXISTING SCHEMA)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- GRANT PERMISSIONS
GRANT ALL ON TABLE public.inventory TO anon, authenticated, postgres;
