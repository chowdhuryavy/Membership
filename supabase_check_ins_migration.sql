-- ==============================================================================
-- SUPABASE DATABASE MIGRATION: Member Check-In & Facility Attendance Tracking
-- ==============================================================================

-- 1. Create member_check_ins table
CREATE TABLE IF NOT EXISTS public.member_check_ins (
    id TEXT PRIMARY KEY,
    member_id TEXT,
    membership_number VARCHAR(100) NOT NULL,
    guest_name VARCHAR(255) NOT NULL,
    outlet_id TEXT,
    property_id TEXT,
    check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_out_time TIMESTAMPTZ NULL,
    duration_minutes INTEGER NULL,
    check_in_method VARCHAR(50) NOT NULL DEFAULT 'reception_scan', -- reception_scan, reception_manual, self_kiosk_qr, self_kiosk_number
    checked_in_by VARCHAR(255) NULL,
    notes TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, completed
    membership_status_at_checkin VARCHAR(50) NULL,
    access_type VARCHAR(100) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_member_check_ins_outlet ON public.member_check_ins(outlet_id);
CREATE INDEX IF NOT EXISTS idx_member_check_ins_property ON public.member_check_ins(property_id);
CREATE INDEX IF NOT EXISTS idx_member_check_ins_status ON public.member_check_ins(status);
CREATE INDEX IF NOT EXISTS idx_member_check_ins_time ON public.member_check_ins(check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_member_check_ins_member ON public.member_check_ins(member_id);

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.member_check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on member_check_ins" ON public.member_check_ins;
DROP POLICY IF EXISTS "Allow authenticated insert on member_check_ins" ON public.member_check_ins;
DROP POLICY IF EXISTS "Allow authenticated update on member_check_ins" ON public.member_check_ins;
DROP POLICY IF EXISTS "Allow public read on member_check_ins" ON public.member_check_ins;
DROP POLICY IF EXISTS "Allow public insert on member_check_ins" ON public.member_check_ins;
DROP POLICY IF EXISTS "Allow public update on member_check_ins" ON public.member_check_ins;

CREATE POLICY "Allow public read on member_check_ins" 
    ON public.member_check_ins 
    FOR SELECT 
    USING (true);

CREATE POLICY "Allow public insert on member_check_ins" 
    ON public.member_check_ins 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public update on member_check_ins" 
    ON public.member_check_ins 
    FOR UPDATE 
    USING (true)
    WITH CHECK (true);

-- 4. Helper View for Currently Checked-In Facility Members
CREATE OR REPLACE VIEW public.v_currently_checked_in
WITH (security_invoker = true) AS
SELECT 
    ci.id,
    ci.member_id,
    ci.membership_number,
    ci.guest_name,
    ci.outlet_id,
    ci.property_id,
    ci.check_in_time,
    ci.check_in_method,
    ci.checked_in_by,
    ci.access_type,
    EXTRACT(EPOCH FROM (NOW() - ci.check_in_time))/60 AS elapsed_minutes
FROM public.member_check_ins ci
WHERE ci.status = 'active';

