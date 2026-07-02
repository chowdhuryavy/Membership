import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDelete() {
  console.log('--- DIAGNOSTIC SCRIPT START ---');
  try {
    console.log('1. Fetching all treatments (massage_types) from Supabase...');
    const { data: treatments, error: fetchErr } = await supabase
      .from('massage_types')
      .select('*');
      
    if (fetchErr) {
      console.error('Fetch Failed:', fetchErr);
      return;
    }
    
    console.log(`Found ${treatments?.length || 0} treatments:`);
    treatments?.forEach(t => {
      console.log(`  - ID: ${t.id}, Name: ${t.name}, Price: ${t.price}, Outlet ID: ${t.outlet_id}`);
    });
    
    // Let's find one to delete.
    const target = treatments?.find(t => t.name === 'TRSTQWE' || t.name.includes('TRSTQWE'));
    if (!target) {
      console.log('Could not find a treatment named "TRSTQWE" to delete.');
      return;
    }
    
    console.log(`\n2. Attempting to delete treatment "${target.name}" (ID: ${target.id})...`);
    const { data: delData, error: delErr, status, statusText } = await supabase
      .from('massage_types')
      .delete()
      .eq('id', target.id)
      .select(); // Ask for deleted data back
      
    console.log('Deletion Response:');
    console.log('  - Status:', status);
    console.log('  - Status Text:', statusText);
    console.log('  - Error:', delErr);
    console.log('  - Returned Deleted Data:', delData);
    
    if (delErr) {
      console.error('  -> Deletion explicitly failed with error:', delErr.message);
    } else if (!delData || delData.length === 0) {
      console.log('  -> Deletion completed with success status but 0 ROWS WERE DELETED (likely RLS / Policy restriction or row not found).');
    } else {
      console.log('  -> Deletion was 100% SUCCESSFUL! Row was removed.');
    }
  } catch (e) {
    console.error('Unexpected exception:', e);
  }
}

testDelete();
