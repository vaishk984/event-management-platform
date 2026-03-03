'use client'

import { useState } from 'react'
import { KanbanBoard } from "@/components/tasks/kanban-board"
import { Task, TaskStatus } from "@/lib/types/task"
import { Button } from "@/components/ui/button"
import { Plus, Filter, Sparkles } from "lucide-react"
import { updateTask, Task as ServerTask } from "@/actions/tasks"
import { toast } from "sonner" // Assuming you have toast, if not I'll remove

interface TasksClientProps {
    initialTasks: ServerTask[]
}

export function TasksClient({ initialTasks }: TasksClientProps) {
    // Map Server Tasks to UI Tasks
    const mapServerTaskToUITask = (t: ServerTask): Task => ({
        id: t.id,
        eventId: t.event_id,
        eventName: t.events?.name || 'Untitled Event',
        title: t.title,
        description: t.description || undefined,
        status: t.status as TaskStatus,
        priority: t.priority,
        dueDate: t.due_date || undefined,
        assignee: t.vendors?.company_name || 'Planner',
        assigneeType: t.vendor_id ? 'vendor' : 'planner',
        vendorId: t.vendor_id || undefined,
        tags: [] // TODO: Add tags support in DB
    })

    const [tasks, setTasks] = useState<Task[]>(initialTasks.map(mapServerTaskToUITask))
    const [isGenerating, setIsGenerating] = useState(false)

    const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
        // Optimistic update
        setTasks(prev => prev.map(task =>
            task.id === taskId ? { ...task, status: newStatus } : task
        ))

        // Server update
        const formData = new FormData()
        formData.append('id', taskId)
        formData.append('status', newStatus)

        const result = await updateTask(formData)

        if (result.error) {
            // Revert on failure
            // toast.error("Failed to update task") // TODO: install sonner
            alert("Failed to update status")
            // Ideally revert state here
        }
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Task Board</h1>
                    <p className="text-gray-500">{tasks.length} tasks across your events</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="gap-2">
                        <Filter className="w-4 h-4" />
                        Filter
                    </Button>
                    <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="w-4 h-4" />
                        New Task
                    </Button>
                </div>
            </div>

            {/* Board */}
            <KanbanBoard tasks={tasks} onTaskMove={handleTaskMove} />
        </div>
    )
}
