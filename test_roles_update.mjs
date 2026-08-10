import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('roles').select('id, name, permissions').eq('id', '0958cdaa-7dd0-48bd-a80d-21d856d2526b').single();
  if (data) {
    if (!data.permissions.includes('settings:view')) {
      data.permissions.push('settings:view');
      await supabase.from('roles').update({ permissions: data.permissions }).eq('id', data.id);
      console.log("Updated Admin role with settings:view");
    } else {
      console.log("Admin role already has settings:view");
    }
  }
}
run();
