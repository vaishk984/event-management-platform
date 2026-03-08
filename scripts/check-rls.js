const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// We need the direct Postgres URL, or we can use Supabase client.
// Actually, let's just query via supabase client using an RPC, OR use postgres connection if available.
// If not, we can see if we can just test the policies ourselves.
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkPolicies() {
    console.log("Checking insert...");
    const clientSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await clientSupabase.from('event_intakes').insert([{ client_name: "test", client_phone: "123" }]);
    console.log(error);
}
checkPolicies();
