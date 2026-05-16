-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Ensure user_id column doesn't have the reference if it already exists
-- We do this by dropping and recreating or using an alter (if we knew the constraint name)
-- But the safest fix is to ask the user to run the provided SQL in their editor.

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
-- We allow all operations for now because staff login doesn't use Supabase Auth
-- In a production environment, you should use service-role Edge Functions or real Auth
DROP POLICY IF EXISTS "Enable all access for push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Enable all access for push_subscriptions"
    ON public.push_subscriptions
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Ensure notifications table is accessible by staff
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- CRITICAL: Remove foreign key constraints that might block staff members from receiving notifications
-- Staff members are stored in public.staff, but these tables often have FKs to public.users or auth.users
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey;

DROP POLICY IF EXISTS "Enable all access for notifications" ON public.notifications;
CREATE POLICY "Enable all access for notifications"
    ON public.notifications
    FOR ALL
    USING (true)
    WITH CHECK (true);
