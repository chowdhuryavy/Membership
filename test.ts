import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './services/supabase';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const go = async () => {
    try {
        const { data, error } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
        if (error) {
            console.error("Error reading company_settings:", error);
            return;
        }

        console.log(`=== company_settings columns ===`);
        if (data) {
            console.log(Object.keys(data));
            console.log("Entire row data:", data);
        } else {
            console.log("No row found in company_settings.");
        }

    } catch (e) {
        console.error(e);
    }
};

go();
