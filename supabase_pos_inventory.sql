
-- ==========================================
-- POS & INVENTORY CONSOLIDATED SCHEMA V1.0
-- ==========================================

-- 1. CREATE MASTER CATALOG / INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Retail, Personal Training, Entrance Fee, Other
    price NUMERIC NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREATE SALES / POS RECOGNITION TABLE
CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    guest_id TEXT REFERENCES public.guests(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    category TEXT NOT NULL,
    item_id TEXT REFERENCES public.inventory(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    gross_amount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0,
    net_amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed', -- completed, refunded, void
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. DISABLE RLS FOR SYSTEM-LEVEL OPERATIONS (PARITY WITH CORE SCHEMA)
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales DISABLE ROW LEVEL SECURITY;

-- 4. GRANT PERMISSIONS FOR ALL ACCESS LEVELS
GRANT ALL ON TABLE public.inventory TO anon, authenticated, postgres;
GRANT ALL ON TABLE public.sales TO anon, authenticated, postgres;
