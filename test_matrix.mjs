import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: current } = await supabase.from('company_settings').select('*').single();
  console.log("Current perm:", current.restricted_permissions);
  const updatedSettings = { ...current, restricted_permissions: ["settings:view", "settings:edit"] };
  const { error } = await supabase.from('company_settings').upsert({ ...updatedSettings, id: 'global' });
  console.log("Upsert Error:", error);
  const { data: next } = await supabase.from('company_settings').select('*').single();
  console.log("Next perm:", next.restricted_permissions);
}
run();
