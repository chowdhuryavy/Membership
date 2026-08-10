import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: `ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS restricted_permissions JSONB DEFAULT '[]'::jsonb;` });
  console.log("Error:", error);
}
run();
