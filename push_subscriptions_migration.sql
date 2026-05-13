-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own push subscriptions"
    ON public.push_subscriptions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
