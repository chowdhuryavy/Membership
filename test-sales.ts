import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data.map(d => ({ id: d.id, created_at: d.created_at, net_amount: d.net_amount, item_id: d.item_id })), null, 2));
  }
}
test();
