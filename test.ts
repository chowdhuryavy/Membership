import { supabase } from './services/supabase.ts';

const go = async () => {
    try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) {
            console.error("Error reading profiles:", error);
            return;
        }

        console.log(`=== profiles Table Rows (${data?.length || 0}) ===`);
        data?.forEach(row => {
            console.log(`- User: ${row.name || row.username} | Email: ${row.email} | Role: ${row.role_id}`);
            console.log(`  Allowed Outlets:`, row.allowed_outlets);
        });

    } catch (e) {
        console.error(e);
    }
};

go();
