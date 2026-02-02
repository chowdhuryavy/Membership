
import { createClient } from '@supabase/supabase-js';

// Provided credentials linked directly to the code
const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (!supabase) {
  console.warn("Supabase initialization failed. App is running in Local Persistence Mode.");
}
