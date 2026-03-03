'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Public Actions - No user authentication check (handled by RPC and Security Definer)

export async function getPublicEvent(token: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_public_event', { token_input: token })

    if (error) {
        console.error('getPublicEvent error:', error)
        return { error: 'Failed to find event' }
    }

    // RPC 'get_public_event' returns SETOF events, so it's an array. Take first.
    if (!data || data.length === 0) {
        return { error: 'Invalid token or event not found' }
    }

    return { data: data[0] }
}

export async function getPublicTimeline(token: string) {
    const supabase = await createClient()
    const { data: timeline, error: timelineError } = await supabase.rpc('get_public_timeline', { token_input: token })
    const { data: functions, error: functionsError } = await supabase.rpc('get_public_functions', { token_input: token })

    if (timelineError || functionsError) {
        console.error('getPublicTimeline error:', timelineError || functionsError)
        return { items: [], functions: [] }
    }


    return {
        items: timeline || [],
        functions: functions || []
    }
}

export async function getPublicBudget(token: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_public_budget', { token_input: token })

    if (error) {
        console.error('getPublicBudget error:', error)
        return { totalEstimated: 0, totalSpent: 0, totalPaid: 0 }
    }

    // RPC returns a row
    return data && data[0] ? data[0] : { totalEstimated: 0, totalSpent: 0, totalPaid: 0 }
}

export async function updateProposalStatus(token: string, status: 'approved' | 'declined' | 'changes_requested', feedback?: string) {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('update_proposal_status', {
        token_input: token,
        status_input: status,
        feedback_input: feedback || null
    })

    if (error) {
        console.error('updateProposalStatus error:', error)
        return { error: 'Failed to update status' }
    }

    // Create notification for the planner
    try {
        const { data: event } = await supabase
            .from('events')
            .select('id, planner_id, name, client_name')
            .eq('public_token', token)
            .single()

        if (event?.planner_id) {
            const clientName = event.client_name || 'Your client'
            const eventName = event.name || 'an event'

            const notifTitle = status === 'approved'
                ? '✅ Proposal Approved!'
                : status === 'changes_requested'
                    ? '📝 Changes Requested'
                    : '❌ Proposal Declined'

            const notifMessage = status === 'approved'
                ? `${clientName} has approved the proposal for "${eventName}". You can now proceed with vendor confirmations.`
                : status === 'changes_requested'
                    ? `${clientName} has requested changes to the proposal for "${eventName}".${feedback ? ` Feedback: "${feedback}"` : ''}`
                    : `${clientName} has declined the proposal for "${eventName}".`

            await supabase.from('notifications').insert({
                user_id: event.planner_id,
                event_id: event.id,
                type: status === 'approved' ? 'proposal_approved' : 'proposal_changes_requested',
                title: notifTitle,
                message: notifMessage,
                link: `/planner/events/${event.id}/client`,
            })
        }
    } catch (e) {
        console.error('Error creating notification:', e)
        // Don't fail the whole request if notification fails
    }

    revalidatePath(`/proposal/${token}`)
    return { success: true }
}

export async function generateProposalToken(eventId: string) {
    const supabase = await createClient()
    const token = `prop_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`

    const { error } = await supabase
        .from('events')
        .update({
            public_token: token,
            proposal_status: 'sent', // Update status too
            updated_at: new Date().toISOString()
        })
        .eq('id', eventId)

    if (error) {
        console.error('Error generating token:', error)
        return { error: 'Failed to generate proposal link' }
    }

    return { token }
}

export async function getPublicProposalDetails(token: string) {
    const supabase = await createClient()

    // 1. Get Event from token (no join — FK hint causes PGRST200)
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('public_token', token)
        .single()

    if (eventError || !events) {
        console.error('Error fetching proposal event:', eventError)
        return { error: 'Proposal not found' }
    }

    // 2. Fetch planner profile separately using planner_id
    const { data: planner } = await supabase
        .from('user_profiles')
        .select('full_name, email, phone_number, company_name')
        .eq('id', events.planner_id)
        .maybeSingle()

    const eventId = events.id

    // 3. Get Booking Requests (no FK join — it causes PGRST200)
    const { data: requests, error: requestsError } = await supabase
        .from('booking_requests')
        .select('*')
        .eq('event_id', eventId)
        .neq('status', 'declined')

    if (requestsError) {
        console.error('Error fetching booking requests:', requestsError)
    }

    // 3b. Also get vendors from vendor_assignments (added via Showroom)
    const { data: assignments, error: assignmentsError } = await supabase
        .from('vendor_assignments')
        .select('*, vendor:vendor_id(id, company_name, category)')
        .eq('event_id', eventId)

    if (assignmentsError) {
        console.error('Error fetching vendor assignments:', assignmentsError)
    }

    // 4. Fetch vendor names separately for each booking request
    const vendorIds = [...new Set([
        ...(requests || []).map(r => r.vendor_id),
        ...(assignments || []).map((a: any) => a.vendor_id)
    ].filter(Boolean))]

    let vendorMap: Record<string, { name: string, start_price: number }> = {}
    if (vendorIds.length > 0) {
        const { data: vendors, error: vendorError } = await supabase
            .from('vendors')
            .select('id, company_name, start_price')
            .in('id', vendorIds)
        if (vendorError) {
            console.error('Error fetching vendors:', vendorError)
        }
        for (const v of (vendors || [])) {
            vendorMap[v.id] = { name: v.company_name, start_price: v.start_price || 0 }
        }
    }

    // 5. Get Budget Items
    const { data: budgetItems, error: budgetError } = await supabase
        .from('budget_items')
        .select('*')
        .eq('event_id', eventId)

    if (budgetError) {
        console.error('Error fetching budget items:', budgetError)
    }

    // 6. Get Timeline Items
    const { data: timelineItems, error: timelineError } = await supabase
        .from('timeline_items')
        .select('*')
        .eq('event_id', eventId)
        .order('start_time', { ascending: true })

    if (timelineError) {
        console.error('Error fetching timeline:', timelineError)
    }

    // 6b. Get Event Functions (top-level schedule groups like "Graduation ceremony")
    const { data: eventFunctions, error: funcError } = await supabase
        .from('event_functions')
        .select('*')
        .eq('event_id', eventId)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

    if (funcError) {
        console.error('Error fetching event functions:', funcError)
    }

    // Merge booking_requests + vendor_assignments (dedupe by SERVICE CATEGORY)
    // This prevents duplicate entries (like 2 catering components) if one is assigned and one is a generic request
    const mergedVendorMap = new Map<string, any>()

    // Add assignments first (showroom vendors)
    for (const a of (assignments || [])) {
        const category = ((a as any).vendor?.category || a.vendor_category || 'other').toLowerCase()
        mergedVendorMap.set(category, {
            service: category.charAt(0).toUpperCase() + category.slice(1),
            vendor_id: a.vendor_id,
            agreed_amount: a.agreed_amount || a.price || 0,
            quoted_amount: 0,
            budget: 0,
            notes: a.notes || '',
            service_details: '',
        })
    }

    // Add booking_requests (overwrite if same category)
    for (const req of (requests || [])) {
        const category = (req.service || 'other').toLowerCase()

        // If an assignment already exists for this category with a vendor, but the request has NO vendor, skip overwriting.
        // We want to keep the true vendor assignment over a generic unassigned request.
        if (!req.vendor_id && mergedVendorMap.has(category) && mergedVendorMap.get(category).vendor_id) {
            continue
        }

        mergedVendorMap.set(category, req)
    }

    const allVendorEntries = Array.from(mergedVendorMap.values())

    // Map to proposal categories
    const guestCount = events.guest_count || 0
    const categories = allVendorEntries.map(req => {
        const serviceName = req.service?.toLowerCase() || 'other'
        const isCatering = serviceName.includes('food') || serviceName.includes('cater')
        const vendorData = vendorMap[req.vendor_id] || { name: 'Vendor TBD', start_price: 0 }

        // Fallback to vendor table's start_price if all booking amounts are 0
        const unitPrice = req.agreed_amount || req.quoted_amount || req.budget || vendorData.start_price || 0
        const totalPrice = isCatering && guestCount > 0 ? unitPrice * guestCount : unitPrice

        return {
            id: serviceName,
            name: req.service || 'Service',
            icon: serviceName.includes('photo') ? 'Camera' :
                isCatering ? 'UtensilsCrossed' :
                    serviceName.includes('decor') ? 'Sparkles' :
                        serviceName.includes('venue') ? 'Building2' :
                            serviceName.includes('transport') ? 'Car' :
                                serviceName.includes('music') || serviceName.includes('entertain') ? 'Music' :
                                    'Sparkles',
            vendor: {
                name: vendorData.name,
                rating: 4.8
            },
            price: totalPrice,
            perPlatePrice: isCatering ? unitPrice : null,
            guestCount: isCatering ? guestCount : null,
            items: req.service_details ? [req.service_details] : req.notes ? [req.notes] : ['Details to be confirmed']
        }
    })

    // Map budget items for the budget section
    const budget = {
        items: (budgetItems || []).map(item => ({
            id: item.id,
            category: item.category,
            description: item.description || item.category,
            estimated: item.estimated_amount || 0,
            actual: item.actual_amount || 0,
            paid: item.paid_amount || 0,
        })),
        totalEstimated: (budgetItems || []).reduce((sum: number, i: any) => sum + (i.estimated_amount || 0), 0),
        totalActual: (budgetItems || []).reduce((sum: number, i: any) => sum + (i.actual_amount || 0), 0),
        totalPaid: (budgetItems || []).reduce((sum: number, i: any) => sum + (i.paid_amount || 0), 0),
    }

    // Map timeline: use timeline_items if available, otherwise fall back to event_functions
    let timeline: any[] = []

    if ((timelineItems || []).length > 0) {
        // Use detailed timeline items
        timeline = (timelineItems || []).map((item: any) => ({
            id: item.id,
            time: item.start_time ? item.start_time.substring(0, 5) : 'TBD',
            title: item.title,
            category: 'event',
            duration: item.duration ? `${item.duration} mins` : '',
            description: item.description || ''
        }))
    } else if ((eventFunctions || []).length > 0) {
        // Fall back to event functions (top-level schedule)
        timeline = (eventFunctions || []).map((fn: any) => ({
            id: fn.id,
            time: fn.start_time ? fn.start_time.substring(0, 5) : 'TBD',
            title: fn.name,
            category: fn.type || 'event',
            duration: '',
            description: fn.venue_name ? `Venue: ${fn.venue_name}` : (fn.date ? `Date: ${new Date(fn.date).toLocaleDateString()}` : '')
        }))
    }

    if (timeline.length === 0) {
        timeline.push({ id: 't1', time: 'TBD', title: 'Timeline not yet created', category: 'ceremony', duration: '', description: 'Your planner will add the event schedule here' })
    }

    return {
        proposal: {
            id: events.id,
            eventName: events.name,
            eventType: events.type,
            clientName: events.client_name,
            date: events.date,
            venue: events.venue_name,
            city: events.city,
            guestCount: events.guest_count,
            plannerName: planner?.company_name || planner?.full_name || 'Event Planner',
            plannerPhone: planner?.phone_number || '',
            plannerEmail: planner?.email || '',
            validUntil: new Date(new Date(events.updated_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: events.proposal_status || 'pending',
            personalMessage: events.notes || 'Here is your event proposal.',
            postApprovalNote: 'Once approved, your planner will confirm all vendor bookings and share a final detailed plan with you.',
            categories: categories,
            timeline: timeline,
            budget: budget
        }
    }
}

// ===== FINAL PROPOSAL (SNAPSHOT) =====

export async function sendFinalProposal(eventId: string) {
    const supabase = await createClient()

    // 1. Get the current event to find the preliminary token
    const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

    if (eventError || !event) {
        return { error: 'Event not found' }
    }

    if (!event.public_token) {
        return { error: 'Generate a preliminary proposal link first' }
    }

    // 2. Build the snapshot by calling getPublicProposalDetails
    const proposalResult = await getPublicProposalDetails(event.public_token)
    if ('error' in proposalResult) {
        return { error: 'Failed to capture proposal data' }
    }

    // 3. Generate a unique token for the final proposal
    const finalToken = `final_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`

    // 4. Get version number
    const { count } = await supabase
        .from('proposal_snapshots')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)

    const version = (count || 0) + 1

    // 5. Store the snapshot
    const { error: insertError } = await supabase
        .from('proposal_snapshots')
        .insert({
            event_id: eventId,
            version: version,
            snapshot_data: proposalResult.proposal,
            token: finalToken,
            status: 'sent',
        })

    if (insertError) {
        console.error('Error creating proposal snapshot:', insertError)
        return { error: 'Failed to save final proposal' }
    }

    // 6. Update event with final token
    await supabase
        .from('events')
        .update({
            final_proposal_token: finalToken,
            proposal_status: 'final_sent',
        })
        .eq('id', eventId)

    revalidatePath(`/planner/events/${eventId}/client`)
    return { success: true, token: finalToken, version }
}

export async function getFinalProposal(token: string) {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('proposal_snapshots')
        .select('*')
        .eq('token', token)
        .single()

    if (error || !data) {
        console.error('Error fetching final proposal:', error)
        return { error: 'Final proposal not found' }
    }

    // Mark as viewed if first time
    if (data.status === 'sent') {
        await supabase
            .from('proposal_snapshots')
            .update({ status: 'viewed' })
            .eq('id', data.id)
    }

    return {
        proposal: data.snapshot_data,
        version: data.version,
        status: data.status,
        sentAt: data.sent_at,
        isFinal: true,
    }
}

export async function updateFinalProposalStatus(token: string, status: 'approved' | 'declined' | 'changes_requested', feedback?: string) {
    const supabase = await createClient()

    const { data: snapshot, error: fetchError } = await supabase
        .from('proposal_snapshots')
        .select('id, event_id')
        .eq('token', token)
        .single()

    if (fetchError || !snapshot) {
        return { error: 'Proposal not found' }
    }

    // Update snapshot status
    const { error } = await supabase
        .from('proposal_snapshots')
        .update({
            status: status,
            client_feedback: feedback || null,
        })
        .eq('id', snapshot.id)

    if (error) {
        return { error: 'Failed to update status' }
    }

    // Also update event status
    await supabase
        .from('events')
        .update({
            proposal_status: status === 'approved' ? 'approved' : status,
            client_feedback: feedback || null,
        })
        .eq('id', snapshot.event_id)

    // Create notification for planner
    try {
        const { data: event } = await supabase
            .from('events')
            .select('planner_id, name, client_name')
            .eq('id', snapshot.event_id)
            .single()

        if (event?.planner_id) {
            const clientName = event.client_name || 'Your client'
            const eventName = event.name || 'an event'

            const notifTitle = status === 'approved'
                ? '✅ Final Proposal Approved!'
                : status === 'changes_requested'
                    ? '📝 Changes Requested on Final Proposal'
                    : '❌ Final Proposal Declined'

            const notifMessage = status === 'approved'
                ? `${clientName} has approved the final proposal for "${eventName}". You can now proceed with execution!`
                : status === 'changes_requested'
                    ? `${clientName} has requested changes to the final proposal for "${eventName}".${feedback ? ` Feedback: "${feedback}"` : ''}`
                    : `${clientName} has declined the final proposal for "${eventName}".`

            await supabase.from('notifications').insert({
                user_id: event.planner_id,
                event_id: snapshot.event_id,
                type: status === 'approved' ? 'proposal_approved' : 'proposal_changes_requested',
                title: notifTitle,
                message: notifMessage,
                link: `/planner/events/${snapshot.event_id}/client`,
            })
        }
    } catch (e) {
        console.error('Error creating notification:', e)
    }

    revalidatePath(`/proposal/${token}`)
    return { success: true }
}
