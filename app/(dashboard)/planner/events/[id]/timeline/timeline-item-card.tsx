'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, User, Clock, GripVertical, CheckCircle2, Circle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface TimelineItemProps {
    item: {
        id: string
        title: string
        description?: string
        start_time: string
        end_time?: string
        location?: string
        status: string
        vendors?: {
            company_name: string
        }
    }
}

export function TimelineItemCard({ item }: TimelineItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const formatTime = (time: string) => {
        // Assume HH:mm:ss or HH:mm
        const [h, m] = time.split(':')
        const hours = parseInt(h)
        const date = new Date()
        date.setHours(hours)
        date.setMinutes(parseInt(m))
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div ref={setNodeRef} style={style} className={cn("mb-3", isDragging && "opacity-50 z-50")}>
            <Card className="hover:shadow-md transition-shadow cursor-default group">
                <CardContent className="p-4 flex gap-4 items-start">
                    {/* Drag Handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                    >
                        <GripVertical className="w-5 h-5" />
                    </div>

                    {/* Time Column */}
                    <div className="min-w-[80px] text-sm font-medium text-gray-600 flex flex-col items-center border-r pr-4">
                        <span className="text-indigo-600 font-bold">{formatTime(item.start_time)}</span>
                        {item.end_time && (
                            <span className="text-gray-400 text-xs mt-1">{formatTime(item.end_time)}</span>
                        )}
                        <div className="h-full w-px bg-gray-100 flex-1 my-2" />
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                            <h4 className="font-semibold text-gray-900 leading-none">{item.title}</h4>
                            <Badge variant="outline" className={cn(
                                "text-xs capitalize",
                                item.status === 'completed' ? "bg-green-50 text-green-700 border-green-200" :
                                    item.status === 'in_progress' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                        "bg-gray-50 text-gray-500 border-gray-200"
                            )}>
                                {item.status.replace('_', ' ')}
                            </Badge>
                        </div>

                        {item.description && (
                            <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                        )}

                        <div className="flex gap-4 pt-2 mt-1">
                            {item.location && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <MapPin className="w-3 h-3" />
                                    <span>{item.location}</span>
                                </div>
                            )}
                            {item.vendors && (
                                <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
                                    <User className="w-3 h-3" />
                                    <span>{item.vendors.company_name}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
