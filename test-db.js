import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fqwfffkkaeknaqjorygy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A');
async function run() {
  const { data: cat } = await supabase.from('membership_categories').select('id').limit(1);
  const catId = cat?.[0]?.id;
  const { data: out } = await supabase.from('outlets').select('id').limit(1);
  const outId = out?.[0]?.id;
  console.log("Cat:", catId, "Out:", outId);

  const { data, error } = await supabase.from('members').insert([{
    id: 'test-123456789',
    outlet_id: outId,
    membership_number: 'TEST-123456789',
    guest_name: 'Test',
    category_id: catId,
    start_date: '2026-01-01',
    original_end_date: '2026-02-01',
    current_end_date: '2026-02-01',
    actual_rate: 100,
    discount: -50,
    net_amount: 150,
    daily_rate: 5,
    status: 'ACTIVE'
  }]);
  console.log("Insert Error:", error);
  if (!error) {
    await supabase.from('members').delete().eq('id', 'test-123456789');
  }
}
run();
