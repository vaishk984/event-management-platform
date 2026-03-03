
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase Config');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugUserRole() {
    const email = 'rahul@elegantmoments.com';
    const log: string[] = [];
    log.push(`🔍 Debugging User: ${email}`);

    // 1. Get Auth User ID
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        log.push('❌ User not found in Auth!');
        fs.writeFileSync('debug_output.txt', log.join('\n'));
        return;
    }
    log.push(`✅ Auth User ID: ${user.id}`);
    log.push(`   Metadata: ${JSON.stringify(user.user_metadata)}`);

    // 2. Check Vendors Table Link
    const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (vendorError) {
        log.push(`❌ No Vendor record found linked to this User ID.`);
        log.push(`   Error: ${vendorError.message} (Code: ${vendorError.code})`);

        const { data: vendorByEmail } = await supabase
            .from('vendors')
            .select('*')
            .eq('email', email)
            .single();

        if (vendorByEmail) {
            log.push(`   ⚠️ Vendor record exists for email, but user_id is: ${vendorByEmail.user_id}`);
        }
    } else {
        log.push(`✅ Vendor Link Found!`);
        log.push(`   Vendor ID: ${vendor.id}`);
        log.push(`   Company: ${vendor.company_name}`);
        log.push(`   Calculated Role should be: vendor`);
    }

    // 3. Check User Profiles
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profile) {
        log.push(`ℹ️ User Profile Exists: Role = ${profile.role}`);
    } else {
        log.push(`ℹ️ No User Profile record found.`);
    }

    fs.writeFileSync('debug_output.txt', log.join('\n'));
    console.log('Debug complete. Written to debug_output.txt');
}

debugUserRole();
