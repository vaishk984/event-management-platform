
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDashboardVisibility() {
    console.log('=== Dashboard Visibility Debug ===\n');

    // 1. Check what's in the database
    console.log('1. Checking recent intakes in event_intakes...');
    const { data: allIntakes, error: allError } = await supabase
        .from('event_intakes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (allError) {
        console.error('Error fetching all intakes:', allError.message);
    } else {
        console.log(`Found ${allIntakes?.length || 0} total intakes`);
        if (allIntakes && allIntakes.length > 0) {
            allIntakes.forEach((intake, i) => {
                console.log(`\n[${i + 1}]`);
                console.log(`  ID: ${intake.id}`);
                console.log(`  Status: ${intake.status}`);
                console.log(`  Planner ID: ${intake.planner_id || 'NULL'}`);
                console.log(`  Client: ${intake.client_name}`);
                console.log(`  Created: ${new Date(intake.created_at).toLocaleString()}`);
            });
        }
    }

    // 2. Check pending specifically
    console.log('\n2. Checking pending intakes (status IN submitted, in_progress)...');
    const { data: pendingIntakes, error: pendingError } = await supabase
        .from('event_intakes')
        .select('*')
        .in('status', ['submitted', 'in_progress'])
        .order('created_at', { ascending: false });

    if (pendingError) {
        console.error('Error fetching pending intakes:', pendingError.message);
    } else {
        console.log(`Found ${pendingIntakes?.length || 0} pending intakes`);
        if (pendingIntakes && pendingIntakes.length > 0) {
            pendingIntakes.forEach((intake, i) => {
                console.log(`  [${i + 1}] ${intake.client_name} - Status: ${intake.status} - Planner: ${intake.planner_id || 'NULL'}`);
            });
        }
    }

    // 3. Get current user
    console.log('\n3. Checking current authenticated user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
        console.log('Not authenticated or error:', userError.message);
    } else if (!user) {
        console.log('No user logged in (using anon key only)');
    } else {
        console.log(`Logged in user ID: ${user.id}`);
        console.log(`Email: ${user.email}`);

        // Check if any intakes match this user's planner_id
        const matchingIntakes = allIntakes?.filter(i => i.planner_id === user.id) || [];
        console.log(`\nIntakes with matching planner_id: ${matchingIntakes.length}`);
    }

    console.log('\n=== Debug Complete ===');
}

debugDashboardVisibility();
