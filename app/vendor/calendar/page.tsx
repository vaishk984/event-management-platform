
import { getVendorBookingRequests, getVendorAvailability } from '@/lib/actions/vendor-actions'
import { VendorCalendarClient, CalendarEvent } from './VendorCalendarClient'

export const dynamic = 'force-dynamic'

export default async function VendorCalendarPage() {
    // Calculate date range (current year +/- 1 year)
    const today = new Date()
    const startDate = new Date(today.getFullYear() - 1, 0, 1).toISOString().split('T')[0]
    const endDate = new Date(today.getFullYear() + 1, 11, 31).toISOString().split('T')[0]

    // Fetch data from database in parallel
    const [bookingRequests, availability] = await Promise.all([
        getVendorBookingRequests(),
        getVendorAvailability(startDate, endDate)
    ])

    // Transform to Calendar Events
    const events: CalendarEvent[] = []

    // Filter out declined events as they are not relevant for the calendar
    const activeBookings = bookingRequests.filter(b => b.status !== 'declined')

    activeBookings.forEach(booking => {
        // Use eventDate which is standard in our domain
        const startDateStr = booking.eventDate || new Date().toISOString()
        // Use eventEndDate if available, otherwise default to startDate
        const endDateStr = booking.eventEndDate || startDateStr

        const start = new Date(startDateStr)
        const end = new Date(endDateStr)

        // Safety check for invalid dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return
        }

        // Iterate from start to end date
        // Create a new date object for iteration to avoid reference issues
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
            const dateStr = dt.toISOString().split('T')[0]

            events.push({
                id: `${booking.id}-${dateStr}`, // Unique ID for each day segment
                date: dateStr,
                title: booking.eventName || `Event ${booking.id.slice(0, 4)}`,
                venue: booking.venue || 'TBD',
                time: 'All Day',
                status: booking.status
            })
        }
    })

    return <VendorCalendarClient
        initialEvents={events}
        initialAvailability={availability}
        bookings={activeBookings}
    />
}
