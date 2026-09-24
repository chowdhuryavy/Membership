-- =========================================================================
-- WHATSAPP AUTOMATION MANAGEMENT SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- Multi-Company, Multi-Property, Multi-Outlet Isolated Architecture
-- =========================================================================

-- 1. Companies Table (if not already existing)
CREATE TABLE IF NOT EXISTS public.whatsapp_companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    logo_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default company if none exists
INSERT INTO public.whatsapp_companies (id, name, code, description)
VALUES 
    ('comp_hcm_global', 'Health Club Management & Hospitality', 'HCM', 'Primary Hospitality & Wellness Portfolio'),
    ('comp_perfection_luxury', 'Perfection Luxury Hotels & Resorts', 'PLHR', 'Ultra-Luxury Hotel Collection'),
    ('comp_oasis_wellness', 'Oasis Wellness & Leisure Group', 'OWLG', 'Destination Wellness & Spa Properties')
ON CONFLICT (id) DO NOTHING;

-- 2. WhatsApp API Configurations (Isolated per Company, Property & Outlet)
CREATE TABLE IF NOT EXISTS public.whatsapp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    phone_number_id TEXT NOT NULL DEFAULT '',
    waba_id TEXT NOT NULL DEFAULT '',
    display_phone_number TEXT NOT NULL DEFAULT '',
    display_name TEXT DEFAULT '',
    app_id TEXT DEFAULT '',
    -- Encrypted permanent access token: "iv_hex:auth_tag_hex:ciphertext_hex"
    -- Plaintext credentials MUST NEVER be stored in this column
    encrypted_access_token TEXT NOT NULL DEFAULT '',
    encryption_version INTEGER NOT NULL DEFAULT 1,
    webhook_verify_token TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT false,
    business_hours_start TEXT DEFAULT '08:00',
    business_hours_end TEXT DEFAULT '22:00',
    out_of_hours_message TEXT DEFAULT 'Thank you for reaching out! We are currently closed and will respond during operating hours.',
    welcome_message_enabled BOOLEAN DEFAULT true,
    last_tested_at TIMESTAMPTZ,
    last_test_status VARCHAR(20), -- 'success' | 'failed'
    last_test_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_whatsapp_config_target UNIQUE (company_id, property_id, outlet_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_configs_lookup 
    ON public.whatsapp_configs(company_id, property_id, outlet_id);

-- 3. WhatsApp Conversations (Customer Chats Isolated per Property/Outlet)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    unread_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    assigned_to TEXT,
    avatar_url TEXT,
    notes TEXT,
    member_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_whatsapp_conversation_target UNIQUE (company_id, property_id, outlet_id, contact_phone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_scope 
    ON public.whatsapp_conversations(company_id, property_id, outlet_id, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conv_phone 
    ON public.whatsapp_conversations(contact_phone);

-- 4. WhatsApp Messages (Timeline Messages within a Conversation)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('contact', 'agent', 'bot')),
    sender_name TEXT NOT NULL DEFAULT '',
    message_text TEXT NOT NULL,
    media_url TEXT,
    media_type VARCHAR(20) CHECK (media_type IN ('image', 'document', 'audio', 'video')),
    status VARCHAR(20) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conv 
    ON public.whatsapp_messages(conversation_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_scope 
    ON public.whatsapp_messages(company_id, property_id, outlet_id);

-- 5. WhatsApp Automation Rules (Triggers & Event-Driven Responders)
CREATE TABLE IF NOT EXISTS public.whatsapp_automation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    trigger_event VARCHAR(50) NOT NULL CHECK (trigger_event IN (
        'on_member_created', 
        'on_booking_confirmed', 
        'on_checkin', 
        'on_expiring_membership', 
        'on_keyword', 
        'on_inactivity'
    )),
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('send_template', 'send_text', 'assign_agent', 'add_tag')),
    template_id UUID,
    action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_rules_scope 
    ON public.whatsapp_automation_rules(company_id, property_id, outlet_id, is_active);

-- 6. WhatsApp Templates (Meta Approved Templates per Scope)
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    language VARCHAR(10) NOT NULL DEFAULT 'en_US',
    header_text TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,
    buttons JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED')),
    meta_template_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_scope 
    ON public.whatsapp_templates(company_id, property_id, outlet_id);

-- 7. WhatsApp Audit & Delivery Logs
CREATE TABLE IF NOT EXISTS public.whatsapp_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    target_phone TEXT,
    status VARCHAR(20) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    performed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enforce strict property and outlet isolation so no cross-tenant leakage occurs
-- =========================================================================

ALTER TABLE public.whatsapp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper check function / subquery pattern for authenticated users:
-- Admins have full access. Regular staff can only access their allowed_outlets.

-- 1. WHATSAPP CONFIGS POLICIES
DROP POLICY IF EXISTS "whatsapp_configs_admin_all" ON public.whatsapp_configs;
CREATE POLICY "whatsapp_configs_admin_all" ON public.whatsapp_configs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(trim(profiles.role_id)) IN ('admin', 'super_admin', 'superadmin', 'system_admin', 'system_administrator', 'owner')
        )
    );

DROP POLICY IF EXISTS "whatsapp_configs_outlet_select" ON public.whatsapp_configs;
CREATE POLICY "whatsapp_configs_outlet_select" ON public.whatsapp_configs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (whatsapp_configs.outlet_id = ANY(profiles.allowed_outlets) OR profiles.allowed_outlets IS NULL)
        )
    );

-- 2. CONVERSATIONS POLICIES (Strict Outlet Isolation)
DROP POLICY IF EXISTS "whatsapp_conversations_admin_all" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_admin_all" ON public.whatsapp_conversations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(trim(profiles.role_id)) IN ('admin', 'super_admin', 'superadmin', 'system_admin', 'system_administrator', 'owner')
        )
    );

DROP POLICY IF EXISTS "whatsapp_conversations_outlet_access" ON public.whatsapp_conversations;
CREATE POLICY "whatsapp_conversations_outlet_access" ON public.whatsapp_conversations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (whatsapp_conversations.outlet_id = ANY(profiles.allowed_outlets))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (whatsapp_conversations.outlet_id = ANY(profiles.allowed_outlets))
        )
    );

-- 3. MESSAGES POLICIES
DROP POLICY IF EXISTS "whatsapp_messages_admin_all" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_admin_all" ON public.whatsapp_messages
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(trim(profiles.role_id)) IN ('admin', 'super_admin', 'superadmin', 'system_admin', 'system_administrator', 'owner')
        )
    );

DROP POLICY IF EXISTS "whatsapp_messages_outlet_access" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_outlet_access" ON public.whatsapp_messages
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (whatsapp_messages.outlet_id = ANY(profiles.allowed_outlets))
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (whatsapp_messages.outlet_id = ANY(profiles.allowed_outlets))
        )
    );

-- 4. RULES POLICIES
DROP POLICY IF EXISTS "whatsapp_rules_admin_all" ON public.whatsapp_automation_rules;
CREATE POLICY "whatsapp_rules_admin_all" ON public.whatsapp_automation_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(trim(profiles.role_id)) IN ('admin', 'super_admin', 'superadmin', 'system_admin', 'system_administrator', 'owner')
        )
    );

DROP POLICY IF EXISTS "whatsapp_rules_outlet_access" ON public.whatsapp_automation_rules;
CREATE POLICY "whatsapp_rules_outlet_access" ON public.whatsapp_automation_rules
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (whatsapp_automation_rules.outlet_id = ANY(profiles.allowed_outlets))
        )
    );

-- 5. TEMPLATES POLICIES
DROP POLICY IF EXISTS "whatsapp_templates_admin_all" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_admin_all" ON public.whatsapp_templates
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND lower(trim(profiles.role_id)) IN ('admin', 'super_admin', 'superadmin', 'system_admin', 'system_administrator', 'owner')
        )
    );

DROP POLICY IF EXISTS "whatsapp_templates_outlet_access" ON public.whatsapp_templates;
CREATE POLICY "whatsapp_templates_outlet_access" ON public.whatsapp_templates
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (whatsapp_templates.outlet_id = ANY(profiles.allowed_outlets))
        )
    );

-- =========================================================================
-- SECURE PUBLIC VIEWS
-- Omits raw encrypted tokens and returns masked configuration to frontend
-- =========================================================================

CREATE OR REPLACE VIEW public.whatsapp_configs_safe AS
SELECT 
    id,
    company_id,
    property_id,
    outlet_id,
    phone_number_id,
    waba_id,
    display_phone_number,
    display_name,
    app_id,
    webhook_verify_token,
    is_active,
    (encrypted_access_token IS NOT NULL AND length(encrypted_access_token) > 0) AS has_token_configured,
    business_hours_start,
    business_hours_end,
    out_of_hours_message,
    welcome_message_enabled,
    last_tested_at,
    last_test_status,
    last_test_error,
    created_at,
    updated_at
FROM public.whatsapp_configs;

-- Grants
GRANT ALL ON public.whatsapp_configs TO authenticated;
GRANT ALL ON public.whatsapp_configs TO service_role;
GRANT SELECT ON public.whatsapp_configs_safe TO authenticated;
GRANT SELECT ON public.whatsapp_configs_safe TO service_role;

GRANT ALL ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

GRANT ALL ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

GRANT ALL ON public.whatsapp_automation_rules TO authenticated;
GRANT ALL ON public.whatsapp_automation_rules TO service_role;

GRANT ALL ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;

GRANT ALL ON public.whatsapp_audit_logs TO authenticated;
GRANT ALL ON public.whatsapp_audit_logs TO service_role;
