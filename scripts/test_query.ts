import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
  console.log('Counting members in the entire database...');
  try {
    const start = Date.now();
    const { count, error } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      console.error('Count Failed with error:', error);
    } else {
      console.log(`Total members in database: ${count}. Count query took ${Date.now() - start}ms.`);
    }
    
    console.log('Querying first 10 members in database...');
    const start2 = Date.now();
    const { data, error: error2 } = await supabase
      .from('members')
      .select('id, guest_name, outlet_id, status')
      .limit(10);
    if (error2) {
      console.error('Fetch Failed with error:', error2);
    } else {
      console.log(`Successfully fetched first 10 members in ${Date.now() - start2}ms:`);
      data?.forEach(m => console.log(`ID: ${m.id}, Guest: ${m.guest_name}, Outlet: ${m.outlet_id}, Status: ${m.status}`));
    }
  } catch (e) {
    console.error('Unexpected exception:', e);
  }
}

testQuery();
