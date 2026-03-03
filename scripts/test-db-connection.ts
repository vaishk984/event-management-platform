/**
 * Database Connection Test Script
 * Run with: npm run test:db
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testDatabaseConnection() {
    console.log('🔍 Testing Supabase Connection...\n')

    // Test 1: Basic Connection
    console.log('Test 1: Basic Connection')
    try {
        const { data, error } = await supabase.from('roles').select('*').limit(1)

        if (error) {
            console.error('❌ Connection failed:', error.message)
            process.exit(1)
        }

        console.log('✅ Connected to Supabase successfully!')
        console.log(`   Found ${data?.length || 0} roles\n`)
    } catch (err) {
        console.error('❌ Connection error:', err)
        process.exit(1)
    }

    // Test 2: List All Tables
    console.log('Test 2: Verify Tables Created')
    const expectedTables = [
        'leads',
        'lead_activities',
        'roles',
        'user_profiles',
        'events',
        'event_requirements',
        'event_concepts',
        'package_templates',
        'template_items',
        'services',
        'packages',
        'package_items',
        'revision_requests',
        'checklists',
        'checklist_items',
        'vendors',
        'vendor_services',
        'vendor_availability',
        'event_tasks',
        'proof_of_work',
        'invoices',
        'payments',
        'vendor_payouts',
        'feedback',
        'vendor_performance',
        'notifications',
        'audit_logs',
    ]

    let tablesFound = 0
    for (const table of expectedTables) {
        try {
            const { error } = await supabase.from(table).select('count').limit(1)

            if (!error) {
                console.log(`   ✅ ${table}`)
                tablesFound++
            } else {
                console.log(`   ❌ ${table} - ${error.message}`)
            }
        } catch (err) {
            console.log(`   ❌ ${table} - Error`)
        }
    }

    console.log(`\n   Total: ${tablesFound}/${expectedTables.length} tables found\n`)

    // Test 3: Check Default Roles
    console.log('Test 3: Verify Default Roles')
    try {
        const { data: roles, error } = await supabase
            .from('roles')
            .select('name')
            .order('name')

        if (error) {
            console.log('   ❌ Could not fetch roles:', error.message)
        } else {
            console.log(`   ✅ Found ${roles?.length || 0} roles:`)
            roles?.forEach(role => {
                console.log(`      - ${role.name}`)
            })
        }
    } catch (err) {
        console.log('   ❌ Error fetching roles')
    }

    console.log('\n✅ Database connection test complete!')
    console.log('🚀 Ready to start development!\n')
}

// Run the test
testDatabaseConnection()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Test failed:', err)
        process.exit(1)
    })
