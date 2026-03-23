-- Report Recipients Table
DROP TABLE IF EXISTS report_recipients;

CREATE TABLE report_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    property_id TEXT REFERENCES public.properties(id) ON DELETE CASCADE,
    outlet_id TEXT NOT NULL, -- 'all' or UUID
    report_type TEXT NOT NULL CHECK (report_type IN ('daily_revenue', 'monthly_summary', 'revenue_recognition', 'daily_sales', 'incentives', 'members_joined', 'expiring_memberships', 'massage_room_revenue')),
    send_time TEXT NOT NULL DEFAULT '08:00',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS
ALTER TABLE report_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON report_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON report_recipients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON report_recipients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON report_recipients FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON report_recipients TO anon, authenticated, postgres;
