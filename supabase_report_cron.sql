-- Enable necessary extensions for HTTP requests and cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Add last_sent_at to report_recipients if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'report_recipients' AND column_name = 'last_sent_at') THEN
        ALTER TABLE report_recipients ADD COLUMN last_sent_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create a cron job to call the send-reports edge function every 10 minutes
-- NOTE: Replace <YOUR_PROJECT_REF> and <YOUR_ANON_KEY> with your actual Supabase project details
SELECT cron.schedule(
  'send-reports-frequent',
  '*/10 * * * *', -- Runs every 10 minutes
  $$
  SELECT net.http_post(
      url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/send-reports',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_ANON_KEY>"}'::jsonb,
      body:='{}'::jsonb
  ) as request_id;
  $$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job if needed:
-- SELECT cron.unschedule('send-reports-hourly');
