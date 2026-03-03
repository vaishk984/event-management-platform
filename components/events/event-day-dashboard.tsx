'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    Clock, CheckCircle2, AlertTriangle, Play, User, MapPin,
    Phone, RefreshCw, ChevronRight, Zap, Users, Calendar
} from 'lucide-react'
import { toast } from 'sonner'
import type { Event, EventFunction, TimelineItem, VendorAssignment } from '@/types/domain'
import { getFunctionsForEvent } from '@/lib/stores/event-functions'
import { getTimelineForFunction, updateTimelineStatus, getTimelineStats } from '@/lib/stores/timeline-store'
import { getAssignmentsForFunction, markArrival, getAssignmentSummary } from '@/lib/stores/vendor-assignment-store'

interface EventDayDashboardProps {
    event: Event
}

export function EventDayDashboard({ event }: EventDayDashboardProps) {
    const [functions, setFunctions] = useState<EventFunction[]>([])
    const [selectedFunction, setSelectedFunction] = useState<EventFunction | null>(null)
    const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
    const [vendors, setVendors] = useState<VendorAssignment[]>([])
    const [currentTime, setCurrentTime] = useState(new Date())

    // Load functions
    useEffect(() => {
        const funcs = getFunctionsForEvent(event.id)
        setFunctions(funcs)
        if (funcs.length > 0 && !selectedFunction) {
            setSelectedFunction(funcs[0])
        }
    }, [event.id, selectedFunction])

    // Load timeline and vendors for selected function
    useEffect(() => {
        if (selectedFunction) {
            setTimelineItems(getTimelineForFunction(selectedFunction.id))
            setVendors(getAssignmentsForFunction(selectedFunction.id))
        }
    }, [selectedFunction])

    // Update current time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date())
        }, 60000)
        return () => clearInterval(interval)
    }, [])

    const handleMarkArrival = (assignmentId: string, vendorName: string) => {
        markArrival(assignmentId)
        setVendors(vendors.map(v =>
            v.id === assignmentId ? { ...v, arrivedAt: new Date().toISOString() } : v
        ))
        toast.success(`${vendorName} marked as arrived`)
    }

    const handleStatusChange = (itemId: string, status: TimelineItem['status']) => {
        updateTimelineStatus(itemId, status)
        setTimelineItems(getTimelineForFunction(selectedFunction?.id || ''))
        toast.success(`Status updated to ${status}`)
    }

    // Calculate stats
    const stats = selectedFunction ? getTimelineStats(selectedFunction.id) : { total: 0, completed: 0, delayed: 0, inProgress: 0, pending: 0 }
    const vendorStats = selectedFunction ? getAssignmentSummary(event.id) : { total: 0, arrived: 0, confirmed: 0 }

    // Find current and next timeline items based on time
    const now = currentTime.toTimeString().slice(0, 5)
    const upcomingItems = timelineItems.filter(item =>
        item.status === 'pending' || item.status === 'in_progress'
    ).slice(0, 5)

    const delayedItems = timelineItems.filter(item => item.status === 'delayed')
    const pendingVendors = vendors.filter(v => v.status === 'confirmed' && !v.arrivedAt)

    const progressPercent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0

    return (
        <div className="space-y-6">
            {/* Live Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium text-green-600">LIVE</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Event Day Dashboard</h2>
                    <p className="text-gray-500">
                        {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} •
                        {event.name}
                    </p>
                </div>
                <Button variant="outline" onClick={() => {
                    if (selectedFunction) {
                        setTimelineItems(getTimelineForFunction(selectedFunction.id))
                        setVendors(getAssignmentsForFunction(selectedFunction.id))
                    }
                    toast.success('Dashboard refreshed')
                }}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* Function Selector */}
            {functions.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {functions.map(func => (
                        <Button
                            key={func.id}
                            variant={selectedFunction?.id === func.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedFunction(func)}
                            className={selectedFunction?.id === func.id ? 'bg-orange-500 hover:bg-orange-600' : ''}
                        >
                            {func.name}
                        </Button>
                    ))}
                </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-green-700">{stats.completed}/{stats.total}</p>
                                <p className="text-xs text-green-600">Tasks Done</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className={`${delayedItems.length > 0 ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200' : 'bg-gray-50'}`}>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${delayedItems.length > 0 ? 'bg-red-100' : 'bg-gray-100'} flex items-center justify-center`}>
                                <AlertTriangle className={`w-5 h-5 ${delayedItems.length > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${delayedItems.length > 0 ? 'text-red-700' : 'text-gray-700'}`}>{delayedItems.length}</p>
                                <p className={`text-xs ${delayedItems.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>Delayed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-blue-700">{vendorStats.arrived}/{vendors.length}</p>
                                <p className="text-xs text-blue-600">Vendors Arrived</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-purple-700">{progressPercent.toFixed(0)}%</p>
                                <p className="text-xs text-purple-600">Progress</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Progress Bar */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Overall Progress</span>
                        <span className="text-sm text-gray-500">{stats.completed} of {stats.total} tasks</span>
                    </div>
                    <Progress value={progressPercent} className="h-3 [&>div]:bg-gradient-to-r [&>div]:from-orange-400 [&>div]:to-amber-400" />
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Upcoming Tasks */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5 text-orange-500" />
                            Upcoming Tasks
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {upcomingItems.length === 0 ? (
                            <div className="text-center py-6 text-gray-400">
                                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                                <p>All tasks completed!</p>
                            </div>
                        ) : (
                            upcomingItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${index === 0 ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'
                                        }`}
                                >
                                    <div className="text-center min-w-[50px]">
                                        <p className="font-mono font-bold text-lg">{item.startTime}</p>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium">{item.title}</p>
                                        <p className="text-sm text-gray-500">{item.owner}</p>
                                    </div>
                                    <div className="flex gap-1">
                                        {item.status === 'pending' && (
                                            <Button
                                                size="sm"
                                                className="bg-blue-500 hover:bg-blue-600"
                                                onClick={() => handleStatusChange(item.id, 'in_progress')}
                                            >
                                                <Play className="w-3 h-3 mr-1" /> Start
                                            </Button>
                                        )}
                                        {item.status === 'in_progress' && (
                                            <Button
                                                size="sm"
                                                className="bg-green-500 hover:bg-green-600"
                                                onClick={() => handleStatusChange(item.id, 'completed')}
                                            >
                                                <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Vendor Status */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-500" />
                            Vendor Arrivals
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {vendors.length === 0 ? (
                            <div className="text-center py-6 text-gray-400">
                                <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>No vendors assigned</p>
                            </div>
                        ) : (
                            vendors.map(vendor => (
                                <div
                                    key={vendor.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${vendor.arrivedAt ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${vendor.arrivedAt ? 'bg-green-100' : 'bg-amber-100'
                                        }`}>
                                        {vendor.arrivedAt ? (
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        ) : (
                                            <Clock className="w-5 h-5 text-amber-600" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium">{vendor.vendorName}</p>
                                        <p className="text-sm text-gray-500">{vendor.vendorCategory}</p>
                                    </div>
                                    {vendor.arrivedAt ? (
                                        <Badge className="bg-green-100 text-green-700">Arrived</Badge>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleMarkArrival(vendor.id, vendor.vendorName)}
                                        >
                                            Mark Arrival
                                        </Button>
                                    )}
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delayed Items Alert */}
            {delayedItems.length > 0 && (
                <Card className="border-red-300 bg-red-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Delayed Items - Needs Attention
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {delayedItems.map(item => (
                            <div key={item.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-red-200">
                                <div className="text-center min-w-[50px]">
                                    <p className="font-mono font-bold text-red-600">{item.startTime}</p>
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">{item.title}</p>
                                    <p className="text-sm text-red-500">{item.owner} - Expected at {item.startTime}</p>
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-green-500 hover:bg-green-600"
                                    onClick={() => handleStatusChange(item.id, 'completed')}
                                >
                                    Mark Done
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
