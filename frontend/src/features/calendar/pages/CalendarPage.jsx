import React, { useState } from 'react'
import PageHeader from '@/components/ui/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarAPI } from '@/services/endpoints'
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import CalendarEventModal from '../components/CalendarEventModal'
import { toast } from 'react-hot-toast'
import { Plus, Globe, User, X, Palmtree, Pencil, Trash2, Calendar as CalendarIcon, Info } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

const localizer = momentLocalizer(moment)

// ─── Unified Event Popup ─────────────────────────────────────────────────────
function EventInfoPopup({ event, onClose, onEdit, onDelete, isAdmin, currentUserId }) {
    if (!event) return null
    const resource = event.resource
    const isLeave = resource.eventType === 'leave'
    const isExternal = resource.eventType === 'external'
    const isPublic = resource.isPublic
    
    const createdById = resource.createdBy?._id?.toString() ?? resource.createdBy?.toString()
    const isCreator = createdById && createdById === currentUserId
    const canEdit = isAdmin || (isCreator && !isLeave && !isExternal)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Decorative top bar */}
                <div className="h-2 w-full" style={{ backgroundColor: resource.color || '#6366f1' }} />
                
                <div className="p-6">
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner bg-slate-50 dark:bg-white/5"
                                style={{ color: resource.color || '#6366f1' }}>
                                {isLeave ? '🏖️' : isExternal ? (resource.source === 'google' ? '💎' : '📘') : <CalendarIcon size={24} />}
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 dark:text-white text-lg leading-tight uppercase tracking-tight">
                                    {event.title}
                                </h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-white/10 ${isLeave ? 'bg-amber-50 text-amber-600' : isExternal ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {resource.eventType}
                                    </span>
                                    {isExternal && (
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            via {resource.source}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="text-slate-400"><Info size={14} /></div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Schedule</span>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                    {moment(event.start).format('MMM D, YYYY')} 
                                    {!event.allDay && ` • ${moment(event.start).format('HH:mm')} - ${moment(event.end).format('HH:mm')}`}
                                </span>
                            </div>
                        </div>

                        {resource.location && (
                            <div className="flex items-center gap-3">
                                <div className="text-slate-400"><Globe size={14} /></div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Location</span>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{resource.location}</span>
                                </div>
                            </div>
                        )}

                        {resource.description && (
                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description</span>
                                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                    {resource.description}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                             {isLeave ? (
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified Leave</span>
                             ) : isExternal ? (
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">External Sync</span>
                             ) : isPublic ? (
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Company Event</span>
                             ) : (
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Personal Task</span>
                             )}
                        </div>
                        
                        {canEdit && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onDelete(event.id)}
                                    className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm"
                                    title="Delete Event"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <button
                                    onClick={() => onEdit(event)}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-black text-white text-[10px] font-black rounded-xl transition-all shadow-xl"
                                >
                                    <Pencil size={14} />
                                    EDIT DETAILS
                                </button>
                            </div>
                        )}
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
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [detailPopup, setDetailPopup] = useState(null)
    const [currentDate, setCurrentDate] = useState(new Date())
    const [range, setRange] = useState({
        from: moment().startOf('month').toISOString(),
        to: moment().endOf('month').toISOString(),
    })

    // Fetch merged calendar events (Internal + Leaves + External)
    const { data: eventsData, isLoading } = useQuery({
        queryKey: ['calendar', range],
        queryFn: () => calendarAPI.getAll(range).then(r => r.data.data),
    })

    const createMutation = useMutation({
        mutationFn: (data) => {
            const payload = isAdmin() ? data : { ...data, isPublic: false }
            return calendarAPI.create(payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['calendar'])
            toast.success('Event created!')
            setIsModalOpen(false)
        },
        onError: () => toast.error('Failed to create event'),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => calendarAPI.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries(['calendar'])
            toast.success('Event updated!')
            setIsModalOpen(false)
        },
        onError: () => toast.error('Failed to update event'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => calendarAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries(['calendar'])
            toast.success('Event deleted')
            setIsModalOpen(false)
            setDetailPopup(null)
        },
        onError: () => toast.error('Failed to delete event'),
    })

    const calendarEvents = eventsData?.map(ev => ({
        id: ev.id || ev._id,
        title: ev.title,
        start: new Date(ev.startDate),
        end: new Date(ev.endDate ?? ev.startDate),
        allDay: ev.allDay || (ev.eventType === 'holiday' || ev.eventType === 'leave'),
        resource: ev,
    })) ?? []

    const eventStyleGetter = (event) => {
        const isExternal = event.resource.eventType === 'external'
        return {
            style: {
                backgroundColor: event.resource.color || '#6366f1',
                borderRadius: '8px',
                border: isExternal ? '1px dashed rgba(255,255,255,0.4)' : 'none',
                color: 'white',
                display: 'block',
                cursor: 'pointer',
                fontSize: '11px',
                padding: '2px 6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            },
        }
    }

    const handleSelectSlot = ({ start, end }) => {
        setSelectedEvent({ start, end })
        setIsModalOpen(true)
    }

    const handleSelectEvent = (event) => {
        setDetailPopup(event)
    }

    const handleSave = (data) => {
        if (selectedEvent?.id) {
            updateMutation.mutate({ id: selectedEvent.id, data })
        } else {
            createMutation.mutate(data)
        }
    }

    const [deleteEventId, setDeleteEventId] = useState(null)

    const handleDelete = (id) => {
        setDeleteEventId(id)
    }

    const confirmDelete = () => {
        if (deleteEventId) {
            deleteMutation.mutate(deleteEventId)
            setDeleteEventId(null)
        }
    }

    const handleNavigate = (date) => {
        setCurrentDate(date)
        setRange({
            from: moment(date).startOf('month').toISOString(),
            to: moment(date).endOf('month').toISOString(),
        })
    }

    const pageTitle = `${moment(currentDate).format('MMMM')} ${moment(currentDate).format('YYYY')}`

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="flex items-center justify-between">
                <PageHeader title={pageTitle} />
                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-4 px-5 py-2.5 bg-white dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm text-[10px] font-black uppercase tracking-widest">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Internal</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Leaves</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Google</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-sky-500" /> Outlook</div>
                    </div>
                </div>
            </div>

            {detailPopup && (
                <EventInfoPopup
                    event={detailPopup}
                    onClose={() => setDetailPopup(null)}
                    onEdit={(ev) => {
                        setSelectedEvent(ev)
                        setDetailPopup(null)
                        setIsModalOpen(true)
                    }}
                    onDelete={handleDelete}
                    isAdmin={isAdmin()}
                    currentUserId={user?.id}
                />
            )}

            <div className="card shadow-2xl border-none p-5 rounded-[2.5rem] bg-white dark:bg-slate-900/50 backdrop-blur-xl" style={{ height: 'calc(100vh - 260px)', minHeight: 650 }}>
                <BigCalendar
                    localizer={localizer}
                    events={calendarEvents}
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
                            <div className="flex items-center gap-1.5 overflow-hidden py-0.5">
                                <span className="flex-shrink-0">
                                    {event.resource.eventType === 'leave' ? '🏖️' : 
                                     event.resource.eventType === 'external' ? (event.resource.source === 'google' ? '💎' : '📘') :
                                     event.resource.isPublic ? <Globe size={10} /> : <User size={10} />}
                                </span>
                                <span className="truncate font-bold">{event.title}</span>
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

            <ConfirmModal
                isOpen={!!deleteEventId}
                onClose={() => setDeleteEventId(null)}
                onConfirm={confirmDelete}
                title="Permanently Delete Event?"
                message={(
                    <span>
                        Are you sure you want to delete this event? 
                        You won't be able to see this data again and this action <strong>cannot be undone</strong>.
                    </span>
                )}
                confirmText="Yes, Delete Event"
                isLoading={deleteMutation.isPending}
                danger
            />
        </div>
    )
}
