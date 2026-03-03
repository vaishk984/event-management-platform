/**
 * Debug script to check vendor booking requests
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function debugVendorBookings() {
    console.log('🔍 Debugging vendor booking requests...\n')

    // 1. Get current user (assuming vendor is logged in)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        console.error('❌ Not authenticated or error getting user:', userError)
        return
    }
    console.log('✅ Current user ID:', user.id)
    console.log('   Email:', user.email)

    // 2. Get vendor profile
    const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (vendorError || !vendor) {
        console.error('❌ Vendor not found for user:', vendorError)
        return
    }
    console.log('\n✅ Vendor profile found:')
    console.log('   Vendor ID:', vendor.id)
    console.log('   Name:', vendor.name)
    console.log('   Category:', vendor.category)

    // 3. Get ALL booking requests for this vendor
    const { data: allBookings, error: allBookingsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('vendor_id', vendor.id)

    console.log('\n📊 All booking requests for vendor:')
    console.log('   Total count:', allBookings?.length || 0)
    if (allBookings && allBookings.length > 0) {
        console.log('   Statuses:', allBookings.map(b => b.status).join(', '))
    }

    // 4. Get booking requests with event details (as the dashboard does)
    const { data: bookingsWithEvents, error: bookingsError } = await supabase
        .from('booking_requests')
        .select(`
            *,
            events (
                id,
                name,
                event_date,
                city,
                guest_count
            )
        `)
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false })

    console.log('\n📋 Booking requests with event details:')
    console.log('   Total count:', bookingsWithEvents?.length || 0)

    // 5. Get pending requests specifically
    const { data: pendingBookings, error: pendingError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('vendor_id', vendor.id)
        .in('status', ['draft', 'quote_requested', 'pending'])

    console.log('\n⏳ Pending booking requests:')
    console.log('   Total count:', pendingBookings?.length || 0)

    // 6. Get stats
    const { data: statsData } = await supabase
        .from('booking_requests')
        .select('status')
        .eq('vendor_id', vendor.id)

    const stats = {
        pending: 0,
        accepted: 0,
        completed: 0
    }

    if (statsData) {
        statsData.forEach((r: any) => {
            if (r.status === 'pending' || r.status === 'draft' || r.status === 'quote_requested') stats.pending++
            if (r.status === 'accepted' || r.status === 'confirmed') stats.accepted++
            if (r.status === 'completed') stats.completed++
        })
    }

    console.log('\n📈 Calculated stats:')
    console.log('   Pending:', stats.pending)
    console.log('   Accepted:', stats.accepted)
    console.log('   Completed:', stats.completed)

    // Save full data to JSON file for detailed inspection
    const debugData = {
        user: {
            id: user.id,
            email: user.email
        },
        vendor,
        allBookings,
        bookingsWithEvents,
        pendingBookings,
        stats
    }

    fs.writeFileSync('debug_vendor_bookings.json', JSON.stringify(debugData, null, 2))
    console.log('\n💾 Full data saved to debug_vendor_bookings.json')

    // Check if there are any bookings at all in the system
    const { data: allSystemBookings, error: systemError } = await supabase
        .from('booking_requests')
        .select('vendor_id, status')

    console.log('\n🌐 System-wide booking requests:')
    console.log('   Total in system:', allSystemBookings?.length || 0)
    if (allSystemBookings && allSystemBookings.length > 0) {
        const uniqueVendors = new Set(allSystemBookings.map(b => b.vendor_id))
        console.log('   Unique vendor IDs:', Array.from(uniqueVendors))
    }
}

debugVendorBookings().catch(console.error)
