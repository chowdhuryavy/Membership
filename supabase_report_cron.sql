-- Enable necessary extensions for HTTP requests and cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to call the send-reports edge function every hour
-- NOTE: Replace <YOUR_PROJECT_REF> and <YOUR_ANON_KEY> with your actual Supabase project details
SELECT cron.schedule(
  'send-reports-hourly',
  '0 * * * *', -- Runs at minute 0 of every hour
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
