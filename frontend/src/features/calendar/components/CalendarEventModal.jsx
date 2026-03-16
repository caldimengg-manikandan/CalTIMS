import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import { Trash2 } from 'lucide-react'
import moment from 'moment'

const eventSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    description: z.string().max(1000).optional(),
    eventType: z.string().min(1, 'Event type is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    color: z.string().default('#3B82F6'),
    isPublic: z.boolean().default(false),
})

export default function CalendarEventModal({ isOpen, onClose, event, onSave, onDelete, isAdmin }) {
    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isSubmitting },
    } = useForm({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: '',
            description: '',
            eventType: 'meeting',
            startDate: '',
            endDate: '',
            color: '#3B82F6',
            isPublic: false,
        },
    })

    useEffect(() => {
        if (event) {
            reset({
                title: event.title || '',
                description: event.description || '',
                eventType: event.resource?.eventType || 'meeting',
                startDate: moment(event.start).format('YYYY-MM-DDTHH:mm'),
                endDate: moment(event.end).format('YYYY-MM-DDTHH:mm'),
                color: event.resource?.color || '#3B82F6',
                isPublic: event.resource?.isPublic || false,
            })
        } else {
            reset({
                title: '',
                description: '',
                eventType: 'meeting',
                startDate: moment().format('YYYY-MM-DDTHH:mm'),
                endDate: moment().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
                color: '#3B82F6',
                isPublic: false,
            })
        }
    }, [event, reset, isOpen])

    const onSubmit = (data) => {
        onSave(data)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={event?.id ? 'Edit Event' : 'Create Event'}
            maxWidth="max-w-md"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="label text-[11px] uppercase tracking-wider text-slate-400 font-bold px-1">Title</label>
                    <input
                        type="text"
                        {...register('title')}
                        className={`input py-2 ${errors.title ? 'border-red-500' : 'bg-slate-50/50 border-slate-200 focus:bg-white'}`}
                        placeholder="What's the occasion?"
                    />
                    {errors.title && <p className="mt-1 text-xs text-red-500 pl-1">{errors.title.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="label text-[11px] uppercase tracking-wider text-slate-400 font-bold px-1">Event Type</label>
                        <select {...register('eventType')} className="input py-2 bg-slate-50/50 border-slate-200 focus:bg-white">
                            <option value="meeting">Meeting</option>
                            <option value="holiday">Holiday</option>
                            <option value="deadline">Deadline</option>
                            <option value="company-event">Company Event</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="label text-[11px] uppercase tracking-wider text-slate-400 font-bold px-1">Accent Color</label>
                        <div className="relative flex items-center h-[38px]">
                            <input
                                type="color"
                                {...register('color')}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className="w-full h-full rounded-xl border border-slate-200 overflow-hidden flex items-center px-3 gap-2 bg-slate-50/50">
                                <div className="w-4 h-4 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: watch('color') || '#3B82F6' }}></div>
                                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter italic">Pick color...</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                        <label className="label text-[11px] uppercase tracking-wider text-slate-400 font-bold px-1">Starts At</label>
                        <input
                            type="datetime-local"
                            {...register('startDate')}
                            className={`input text-xs py-2 bg-slate-50/50 ${errors.startDate ? 'border-red-500' : 'border-slate-200 focus:bg-white'}`}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="label text-[11px] uppercase tracking-wider text-slate-400 font-bold px-1">Ends At</label>
                        <input
                            type="datetime-local"
                            {...register('endDate')}
                            className={`input text-xs py-2 bg-slate-50/50 ${errors.endDate ? 'border-red-500' : 'border-slate-200 focus:bg-white'}`}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="label text-[11px] uppercase tracking-wider text-slate-400 font-bold px-1">Description</label>
                    <textarea
                        {...register('description')}
                        className="input py-2 resize-none bg-slate-50/50 border-slate-200 focus:bg-white"
                        rows="3"
                        placeholder="Add some details about this event..."
                    ></textarea>
                </div>

                {isAdmin && (
                    <div className="flex items-center gap-3 p-3 bg-indigo-50/30 dark:bg-black rounded-xl border border-indigo-100/50 dark:border-white/20">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                {...register('isPublic')}
                                id="isPublic"
                                className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-indigo-500 transition-all cursor-pointer"
                            />
                        </div>
                        <label htmlFor="isPublic" className="text-sm font-semibold text-slate-700 dark:text-white cursor-pointer select-none">
                            Broadcast as Global Event
                            <span className="block text-[10px] font-normal text-slate-400">Everyone will see this on their calendar</span>
                        </label>
                    </div>
                )}

                <div className="flex items-center justify-between pt-6 mt-2 border-t border-slate-100 dark:border-white">
                    <div>
                        {event?.id && (
                            <button
                                type="button"
                                onClick={() => onDelete(event.id)}
                                className="flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-white dark:hover:text-black rounded-xl font-semibold text-xs transition-colors group"
                            >
                                <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                                <span>Remove</span>
                            </button>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-sm font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white dark:hover:text-black rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 text-sm font-bold bg-[#1e294b] hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : event?.id ? 'Update' : 'Create'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    )
}
