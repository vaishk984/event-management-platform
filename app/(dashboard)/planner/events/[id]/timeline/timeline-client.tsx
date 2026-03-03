'use client'

import { useState } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { format } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { reorderTimelineItems } from '@/actions/timeline'
import { TimelineItemCard } from './timeline-item-card'
import { AddTimelineItemDialog } from './add-timeline-item-dialog'
import { AddFunctionDialog } from './add-function-dialog'


interface TimelineClientProps {
    eventId: string
    items: any[]
    functions: any[]
    vendors: any[]
}

export function TimelineClient({ eventId, items: initialItems, functions, vendors }: TimelineClientProps) {
    const [items, setItems] = useState(initialItems)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    // Group items by functionId
    const groupedItems = functions.map(f => ({
        ...f,
        items: items.filter((i: any) => i.function_id === f.id)
    }))

    // Add unassigned items
    const unassignedItems = items.filter((i: any) => !i.function_id)
    if (unassignedItems.length > 0) {
        groupedItems.push({
            id: 'unassigned',
            name: 'Unassigned / General',
            date: null,
            items: unassignedItems
        })
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event

        if (over && active.id !== over.id) {
            setItems((items: any[]) => {
                const oldIndex = items.findIndex(i => i.id === active.id)
                const newIndex = items.findIndex(i => i.id === over.id)

                const newItems = arrayMove(items, oldIndex, newIndex)

                // Determine new sort orders
                // We only reorder locally. For persistence, we need to call server.
                // Filter items in the SAME group to calculate relative order?
                // Or just send all updated orders.

                const updates = newItems.map((item, index) => ({
                    id: item.id,
                    sort_order: index
                }))

                // Fire and forget (optimistic)
                reorderTimelineItems(updates, eventId)

                return newItems
            })
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Run Sheet</h2>
                <div className="flex gap-2">
                    <AddFunctionDialog eventId={eventId} />
                    <AddTimelineItemDialog eventId={eventId} functions={functions} vendors={vendors} />
                </div>
            </div>


            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="space-y-8">
                    {groupedItems.map((group) => (
                        <div key={group.id} className="space-y-4">
                            {/* Group Header */}
                            <div className="flex items-center gap-2 border-b pb-2">
                                <CalendarDays className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-medium text-lg text-gray-900">{group.name}</h3>
                                {group.date && (
                                    <span className="text-sm text-gray-500">
                                        {format(new Date(group.date), 'EEEE, MMMM d, yyyy')}
                                    </span>
                                )}
                            </div>

                            {/* Sortable List */}
                            <SortableContext
                                items={group.items.map((i: any) => i.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-3 min-h-[50px]">
                                    {group.items.length === 0 ? (
                                        <div className="text-sm text-gray-400 italic py-4 text-center bg-gray-50 rounded-lg border border-dashed">
                                            No items scheduled
                                        </div>
                                    ) : (
                                        group.items.map((item: any) => (
                                            <TimelineItemCard key={item.id} item={item} />
                                        ))
                                    )}
                                </div>
                            </SortableContext>
                        </div>
                    ))}
                </div>
            </DndContext>
        </div>
    )
}
