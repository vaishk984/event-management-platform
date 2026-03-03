import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Debugging Grand Palace Venue Bookings ---');

    // 1. Get Vendor ID
    const { data: vendors, error: vendorError } = await supabase
        .from('vendors')
        .select('id, company_name, email, user_id')
        .ilike('company_name', '%Grand Palace%');

    if (!vendors || vendors.length === 0) {
        console.log('❌ Vendor "Grand Palace" not found!');
        return;
    }

    console.log(`Found ${vendors.length} vendor(s) matching "Grand Palace":`);

    for (const vendor of vendors) {
        console.log(`\nVendor: ${vendor.company_name}`);
        console.log(`ID: ${vendor.id}`);
        console.log(`User ID: ${vendor.user_id}`);

        // 2. Check Bookings for this vendor
        const { data: bookings } = await supabase
            .from('booking_requests')
            .select(`
                id,
                status,
                service_category,
                event_id,
                events (name, event_date)
            `)
            .eq('vendor_id', vendor.id);

        if (bookings && bookings.length > 0) {
            console.log(`  ✅ Found ${bookings.length} booking(s):`);
            bookings.forEach(b => {
                // @ts-ignore
                const eventName = b.events?.name || 'Unknown Event';
                // @ts-ignore
                const eventDate = b.events?.event_date || 'N/A';
                console.log(`    - Event: "${eventName}" (${eventDate})`);
                console.log(`      Status: ${b.status}`);
            });
        } else {
            console.log('  ❌ No booking requests found for this vendor.');
        }
    }
}

check();
