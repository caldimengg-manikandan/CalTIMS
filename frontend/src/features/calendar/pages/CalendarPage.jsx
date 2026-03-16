import React, { useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarAPI, leaveAPI } from '@/services/endpoints'
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import CalendarEventModal from '../components/CalendarEventModal'
import { toast } from 'react-hot-toast'
import { Plus, Globe, User, X, Palmtree, Pencil, Trash2 } from 'lucide-react'

const localizer = momentLocalizer(moment)

// ─── Leave Info Popup (read-only) ─────────────────────────────────────────────
function LeaveInfoPopup({ event, onClose }) {
    if (!event) return null
    const leave = event.resource
    const leaveTypeColors = {
        annual: 'bg-amber-100 text-amber-800 border-amber-200',
        sick: 'bg-red-100 text-red-800 border-red-200',
        casual: 'bg-purple-100 text-purple-800 border-purple-200',
        unpaid: 'bg-gray-100 text-gray-800 border-gray-200',
        maternity: 'bg-pink-100 text-pink-800 border-pink-200',
        paternity: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    }
    const colorClass = leaveTypeColors[leave.leaveType] || 'bg-amber-100 text-amber-800 border-amber-200'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slide-in">
                {/* Color strip */}
                <div className="h-1.5 w-full" style={{ backgroundColor: leave.color || '#f59e0b' }} />
                <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                style={{ backgroundColor: (leave.color || '#f59e0b') + '22' }}>
                                🏖️
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white text-base">
                                    {leave.employee?.name || 'Employee'}
                                </p>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorClass} mt-0.5 capitalize`}>
                                    {leave.leaveType} Leave
                                </span>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                            <X size={16} />
                        </button>
                    </div>

                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/10">
                            <span className="text-slate-500 dark:text-slate-400">From</span>
                            <span className="font-semibold text-slate-700 dark:text-white">
                                {moment(leave.startDate).format('MMM D, YYYY')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/10">
                            <span className="text-slate-500 dark:text-slate-400">To</span>
                            <span className="font-semibold text-slate-700 dark:text-white">
                                {moment(leave.endDate).format('MMM D, YYYY')}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-slate-500 dark:text-slate-400">Duration</span>
                            <span className="font-semibold text-slate-700 dark:text-white">
                                {leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10">
                        <p className="text-xs text-slate-400 text-center">
                            ✅ Approved leave — read only
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}


export default function CalendarPage() {
    const queryClient = useQueryClient()
    const { user, isAdmin } = useAuthStore()
    const [selectedEvent, setSelectedEvent] = useState(null)
    const [selectedLeave, setSelectedLeave] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [viewOnlyEvent, setViewOnlyEvent] = useState(null)   // global event read-only
    const [personalEventPopup, setPersonalEventPopup] = useState(null) // own event detail popup
    const [currentDate, setCurrentDate] = useState(new Date())
    const [range, setRange] = useState({
        from: moment().startOf('month').toISOString(),
        to: moment().endOf('month').toISOString(),
    })

    // Fetch calendar events (regular events)
    const { data: eventsData, isLoading } = useQuery({
        queryKey: ['calendar', range],
        queryFn: () => calendarAPI.getAll(range).then(r => r.data.data),
    })

    // Fetch approved leave events (visible to everyone)
    const { data: leaveEventsData } = useQuery({
        queryKey: ['calendar-leaves', range],
        queryFn: () => leaveAPI.getCalendar(range).then(r => r.data.data),
    })

    const createMutation = useMutation({
        mutationFn: (data) => {
            // Non-admins always create personal (isPublic: false)
            const payload = isAdmin() ? data : { ...data, isPublic: false }
            return calendarAPI.create(payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['calendar'])
            toast.success('Event created successfully')
            setIsModalOpen(false)
        },
        onError: () => toast.error('Failed to create event'),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => calendarAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['calendar'])
            toast.success('Event updated successfully')
            setIsModalOpen(false)
        },
        onError: () => toast.error('Failed to update event'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => calendarAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['calendar'])
            toast.success('Event deleted successfully')
            setIsModalOpen(false)
        },
        onError: () => toast.error('Failed to delete event'),
    })

    // Merge calendar events + leave events
    const calendarEvents = eventsData?.map(ev => ({
        id: ev._id,
        title: ev.title,
        start: new Date(ev.startDate),
        end: new Date(ev.endDate ?? ev.startDate),
        resource: ev,
        isLeave: false,
    })) ?? []

    const leaveEvents = leaveEventsData?.map(lv => ({
        id: `leave-${lv._id}`,
        title: lv.title,
        start: new Date(lv.startDate),
        end: new Date(lv.endDate),
        resource: lv,
        isLeave: true,
    })) ?? []

    const events = [...calendarEvents, ...leaveEvents]

    const eventStyleGetter = (event) => {
        return {
            style: {
                backgroundColor: event.resource.color || '#6366f1',
                borderRadius: '6px',
                border: 'none',
                color: 'white',
                display: 'block',
                cursor: 'pointer',
                opacity: event.isLeave ? 0.92 : 1,
            },
        }
    }

    const handleSelectSlot = ({ start, end }) => {
        setSelectedEvent({ start, end })
        setIsModalOpen(true)
    }

    const handleSelectEvent = (event) => {
        // Leave events are read-only — show info popup
        if (event.isLeave) {
            setSelectedLeave(event)
            return
        }

        const createdById = event.resource.createdBy?._id?.toString() ?? event.resource.createdBy?.toString()
        const isCreator = createdById && createdById === user?.id?.toString()

        if (isAdmin()) {
            // Admin always goes straight to edit modal
            setSelectedEvent(event)
            setIsModalOpen(true)
        } else if (isCreator) {
            // Own personal event → show detail popup with Edit button
            setPersonalEventPopup(event)
        } else {
            // Global event (not owned) → read-only popup
            setViewOnlyEvent(event)
        }
    }

    const handleSave = (data) => {
        if (selectedEvent?.id) {
            updateMutation.mutate({ id: selectedEvent.id, data })
        } else {
            createMutation.mutate(data)
        }
    }

    const handleDelete = (id) => {
        if (window.confirm('Are you sure you want to delete this event?')) {
            deleteMutation.mutate(id)
        }
    }

    const handleNavigate = (date) => {
        setCurrentDate(date)
        setRange({
            from: moment(date).startOf('month').toISOString(),
            to: moment(date).endOf('month').toISOString(),
        })
    }

    const { general } = useSettingsStore()
    const monthName = moment(currentDate).format('MMMM')
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1)
    const pageTitle = `${capitalizedMonth} ${moment(currentDate).format('YYYY')}`

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <PageHeader title={pageTitle} />

            {/* Leave info popup */}
            {selectedLeave && (
                <LeaveInfoPopup
                    event={selectedLeave}
                    onClose={() => setSelectedLeave(null)}
                />
            )}

            {/* ── Personal Event Detail Popup (own event – with Edit button) ── */}
            {personalEventPopup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setPersonalEventPopup(null)} />
                    <div className="relative bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slide-in">
                        <div className="h-1.5 w-full" style={{ backgroundColor: personalEventPopup.resource.color || '#10b981' }} />
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ backgroundColor: (personalEventPopup.resource.color || '#10b981') + '22' }}>
                                        <User size={18} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-base">{personalEventPopup.title}</p>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 mt-0.5 capitalize">
                                            {personalEventPopup.resource.eventType || 'Personal'}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setPersonalEventPopup(null)} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/10">
                                    <span className="text-slate-500 dark:text-slate-400">From</span>
                                    <span className="font-semibold text-slate-700 dark:text-white">
                                        {moment(personalEventPopup.start).format('MMM D, YYYY HH:mm')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/10">
                                    <span className="text-slate-500 dark:text-slate-400">To</span>
                                    <span className="font-semibold text-slate-700 dark:text-white">
                                        {moment(personalEventPopup.end).format('MMM D, YYYY HH:mm')}
                                    </span>
                                </div>
                                {personalEventPopup.resource.description && (
                                    <div className="py-2">
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Description</p>
                                        <p className="text-slate-700 dark:text-white text-sm">{personalEventPopup.resource.description}</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                                <p className="text-xs text-slate-400">👤 Personal</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            handleDelete(personalEventPopup.id)
                                            setPersonalEventPopup(null)
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 text-xs font-bold rounded-lg transition-all"
                                        title="Delete Event"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedEvent(personalEventPopup)
                                            setPersonalEventPopup(null)
                                            setIsModalOpen(true)
                                        }}
                                        className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e294b] hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-all"
                                    >
                                        <Pencil size={12} />
                                        Edit
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Global Event Read-Only Popup (not owned by current user) ── */}
            {viewOnlyEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setViewOnlyEvent(null)} />
                    <div className="relative bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-slide-in">
                        <div className="h-1.5 w-full" style={{ backgroundColor: viewOnlyEvent.resource.color || '#6366f1' }} />
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: (viewOnlyEvent.resource.color || '#6366f1') + '22' }}>
                                        <Globe size={18} className="text-indigo-500" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-white text-base">{viewOnlyEvent.title}</p>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border bg-indigo-50 text-primary-700 border-indigo-200 mt-0.5 capitalize">
                                            {viewOnlyEvent.resource.eventType || 'Event'}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setViewOnlyEvent(null)} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-700">
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/10">
                                    <span className="text-slate-500 dark:text-slate-400">From</span>
                                    <span className="font-semibold text-slate-700 dark:text-white">
                                        {moment(viewOnlyEvent.start).format('MMM D, YYYY HH:mm')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-white/10">
                                    <span className="text-slate-500 dark:text-slate-400">To</span>
                                    <span className="font-semibold text-slate-700 dark:text-white">
                                        {moment(viewOnlyEvent.end).format('MMM D, YYYY HH:mm')}
                                    </span>
                                </div>
                                {viewOnlyEvent.resource.description && (
                                    <div className="py-2">
                                        <p className="text-slate-500 dark:text-slate-400 text-xs mb-1">Description</p>
                                        <p className="text-slate-700 dark:text-white text-sm">{viewOnlyEvent.resource.description}</p>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10">
                                <p className="text-xs text-slate-400 text-center">🌐 Global event — read only</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-4 mr-4 px-4 py-2 bg-white dark:bg-black rounded-xl border border-slate-100 dark:border-white shadow-sm text-xs flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <Globe size={14} className="text-blue-500" />
                            <span className="text-slate-600 dark:text-white">Global</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-slate-100 dark:border-white pl-4">
                            <User size={14} className="text-emerald-500" />
                            <span className="text-slate-600 dark:text-white">Personal</span>
                        </div>
                        <div className="flex items-center gap-1.5 border-l border-slate-100 dark:border-white pl-4">
                            <span className="text-base leading-none">🏖️</span>
                            <span className="text-slate-600 dark:text-white">Leave</span>
                        </div>
                    </div>
                    {/* <button
                        onClick={() => {
                            setSelectedEvent(null)
                            setIsModalOpen(true)
                        }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus size={20} />
                        <span>Add Event</span>
                    </button> */}
                </div>
            </div>

            <div className="card shadow-xl border-none p-4" style={{ height: 'calc(100vh - 250px)', minHeight: 600 }}>
                <BigCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    selectable
                    onSelectSlot={handleSelectSlot}
                    onSelectEvent={handleSelectEvent}
                    eventPropGetter={eventStyleGetter}
                    onNavigate={handleNavigate}
                    style={{ height: '100%', fontFamily: 'Inter, sans-serif' }}
                    popup
                    components={{
                        event: ({ event }) => (
                            <div className="flex items-center gap-1 px-1 py-0.5 overflow-hidden">
                                {event.isLeave ? (
                                    <span className="flex-shrink-0 text-[10px]">🏖️</span>
                                ) : event.resource.isPublic ? (
                                    <Globe size={10} className="flex-shrink-0" />
                                ) : (
                                    <User size={10} className="flex-shrink-0" />
                                )}
                                <span className="truncate">{event.title}</span>
                            </div>
                        )
                    }}
                />
            </div>

            <CalendarEventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                event={selectedEvent}
                onSave={handleSave}
                onDelete={handleDelete}
                isAdmin={isAdmin()}
            />
        </div>
    )
}

