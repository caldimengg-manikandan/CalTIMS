import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { calendarAPI } from '@/services/endpoints'
import {
    format, parseISO, addMonths, subMonths,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, isToday
} from 'date-fns'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import Spinner from '@/components/ui/Spinner'
import {
    Plus, Edit2, Trash2, X, Save, Calendar,
    ChevronLeft, ChevronRight, Globe, Lock
} from 'lucide-react'

// ── Constants ───────────────────────────────────────────────────────────────
const EVENT_TYPES = [
    { value: 'holiday', label: 'Holiday', color: 'orange' },
    { value: 'company_event', label: 'Company Event', color: 'blue' },
    { value: 'leave', label: 'Leave', color: 'emerald' },
    { value: 'personal_event', label: 'Personal', color: 'purple' },
]

const TYPE_COLORS = {
    holiday: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
    company_event: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    leave: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    personal_event: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
    // Legacy values from old schema
    'company-event': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
    meeting: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', badge: 'bg-cyan-100 text-cyan-700', dot: 'bg-cyan-500' },
    deadline: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', badge: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
}

// Fallback so unknown eventType never crashes
const DEFAULT_COLOR = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' }
const getColor = (eventType) => TYPE_COLORS[eventType] || DEFAULT_COLOR

// Safe date formatter — handles ISO strings and JS Date objects
const safeFmt = (dateVal, fmt) => {
    try {
        if (!dateVal) return ''
        const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal
        return format(d, fmt)
    } catch { return '' }
}

const EMPTY_FORM = {
    title: '',
    eventType: 'company_event',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    isGlobal: true,
}

// ── EventModal ───────────────────────────────────────────────────────────────
function EventModal({ event, onClose, onSave, isSaving }) {
    const [form, setForm] = useState(event ? {
        title: event.title,
        eventType: EVENT_TYPES.find(t => t.value === event.eventType) ? event.eventType : 'company_event',
        startDate: safeFmt(event.startDate, 'yyyy-MM-dd'),
        endDate: safeFmt(event.endDate, 'yyyy-MM-dd'),
        description: event.description || '',
        isGlobal: event.isGlobal ?? true,
    } : { ...EMPTY_FORM })

    const update = (k, v) => setForm(f => ({ ...f, [k]: v }))
    const isEdit = !!event

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center shadow-lg">
                            <Calendar size={18} className="text-white" />
                        </div>
                        <h3 className="font-black text-slate-800 dark:text-white">
                            {isEdit ? 'Edit Event' : 'New Calendar Event'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
                        <X size={18} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4 overflow-y-auto">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                            Event Title *
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => update('title', e.target.value)}
                            placeholder="e.g. Holi, Team Outing, Sprint Planning..."
                            className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 transition-all"
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">
                            Event Type *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {EVENT_TYPES.map(t => {
                                const c = TYPE_COLORS[t.value]
                                const isActive = form.eventType === t.value
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => update('eventType', t.value)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
                                            ${isActive ? `${c.border} ${c.bg} ${c.text}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        <div className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                                        {t.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">Start Date *</label>
                            <input type="date" value={form.startDate} onChange={e => {
                                update('startDate', e.target.value)
                                if (e.target.value > form.endDate) update('endDate', e.target.value)
                            }}
                                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">End Date *</label>
                            <input type="date" value={form.endDate} min={form.startDate} onChange={e => update('endDate', e.target.value)}
                                className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide mb-1.5">Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => update('description', e.target.value)}
                            rows={3}
                            placeholder="Optional description or notes..."
                            className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 outline-none bg-white dark:bg-slate-800 resize-none transition-all"
                        />
                    </div>

                    {/* Visibility */}
                    <div className={`flex items-center justify-between p-3.5 rounded-xl border ${form.isGlobal ? 'border-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'} transition-all cursor-pointer`}
                        onClick={() => update('isGlobal', !form.isGlobal)}>
                        <div className="flex items-center gap-3">
                            {form.isGlobal
                                ? <Globe size={18} className="text-primary dark:text-indigo-400" />
                                : <Lock size={18} className="text-slate-500" />
                            }
                            <div>
                                <p className={`text-sm font-bold ${form.isGlobal ? 'text-primary-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {form.isGlobal ? 'Visible to All Employees' : 'Private Event'}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {form.isGlobal ? 'Appears on everyone\'s dashboard calendar' : 'Only you can see this'}
                                </p>
                            </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full transition-colors relative ${form.isGlobal ? 'btn-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isGlobal ? 'translate-x-5' : 'translate-x-0.5'}`} />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3 bg-slate-50 dark:bg-black">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm">
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={!form.title.trim() || isSaving}
                        className="px-5 py-2 btn-primary hover:bg-primary-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-colors flex items-center gap-2 text-sm"
                    >
                        {isSaving ? <Spinner size="sm" /> : <Save size={15} />}
                        {isEdit ? 'Update Event' : 'Create Event'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminCalendarPage() {
    const queryClient = useQueryClient()
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [showModal, setShowModal] = useState(false)
    const [editingEvent, setEditingEvent] = useState(null)
    const [selectedDay, setSelectedDay] = useState(null) // For quick-create on day click
    const [filter, setFilter] = useState('all')

    const monthKey = format(currentMonth, 'yyyy-MM')

    const { data: events, isLoading } = useQuery({
        queryKey: ['calendar-events', monthKey],
        queryFn: () => calendarAPI.getAll({ month: monthKey }).then(r => r.data.data ?? []),
    })

    const filteredEvents = events?.filter(e =>
        filter === 'all' || e.eventType === filter
    ) ?? []

    const createMutation = useMutation({
        mutationFn: (data) => calendarAPI.create(data),
        onSuccess: () => {
            toast.success('Event created')
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
            setShowModal(false); setEditingEvent(null)
        },
        onError: e => toast.error(e.response?.data?.message || 'Failed to create')
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }) => calendarAPI.update(id, data),
        onSuccess: () => {
            toast.success('Event updated')
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
            setShowModal(false); setEditingEvent(null)
        },
        onError: e => toast.error(e.response?.data?.message || 'Failed to update')
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => calendarAPI.delete(id),
        onSuccess: () => {
            toast.success('Event deleted')
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] })
        },
        onError: e => toast.error(e.response?.data?.message || 'Failed to delete')
    })

    const handleSave = (form) => {
        if (editingEvent) updateMutation.mutate({ id: editingEvent._id, data: form })
        else createMutation.mutate(form)
    }

    const handleDayClick = (day) => {
        setSelectedDay(day)
        setEditingEvent(null)
        setShowModal(true)
    }

    const handleEdit = (e) => { setEditingEvent(e); setShowModal(true) }

    // Calendar grid
    const days = (() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
        return eachDayOfInterval({ start, end })
    })()

    const getEventsForDay = (day) =>
        events?.filter(e => {
            const s = new Date(e.startDate); const en = new Date(e.endDate)
            s.setHours(0, 0, 0, 0); en.setHours(23, 59, 59, 999)
            return day >= s && day <= en
        }) ?? []

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-12">
            <PageHeader title="Calendar Management">
                <button
                    onClick={() => { setEditingEvent(null); setShowModal(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 btn-primary hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all text-sm"
                >
                    <Plus size={16} /> Add Event
                </button>
            </PageHeader>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                {/* ── Left: Calendar Grid (3 cols) */}
                <div className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
                    {/* Month nav */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-500 transition-colors">
                            <ChevronLeft size={18} />
                        </button>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-slate-500 transition-colors">
                            <ChevronRight size={18} />
                        </button>
                    </div>

                    <div className="p-4">
                        {/* Day-of-week headers */}
                        <div className="grid grid-cols-7 mb-2">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-1">{d}</div>
                            ))}
                        </div>

                        {isLoading ? (
                            <div className="h-64 flex items-center justify-center"><Spinner /></div>
                        ) : (
                            <div className="grid grid-cols-7 gap-1">
                                {days.map((day, i) => {
                                    const dayEvents = getEventsForDay(day)
                                    const inMonth = isSameMonth(day, currentMonth)
                                    const todayDay = isToday(day)

                                    const primary = dayEvents[0]
                                    const c = primary ? getColor(primary.eventType) : null

                                    return (
                                        <div
                                            key={i}
                                            onClick={() => inMonth && handleDayClick(day)}
                                            className={`relative min-h-[52px] rounded-xl p-1.5 transition-all cursor-pointer group
                                                ${inMonth ? (c ? `${c.bg} ${c.border} border` : 'bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-transparent hover:border-indigo-200') : 'opacity-20 cursor-default'}
                                            `}
                                        >
                                            <span className={`block text-xs font-bold text-center mb-1
                                                ${todayDay ? 'w-5 h-5 mx-auto flex items-center justify-center rounded-full btn-primary text-white' :
                                                    c ? c.text : 'text-slate-700 dark:text-slate-300'}`}>
                                                {format(day, 'd')}
                                            </span>

                                            {/* Event pills */}
                                            <div className="space-y-0.5">
                                                {dayEvents.slice(0, 2).map((e, idx) => {
                                                    const ec = getColor(e.eventType)
                                                    return (
                                                        <div key={idx}
                                                            className={`text-[9px] font-bold px-1 py-0.5 rounded ${ec.badge} truncate`}
                                                            title={e.title}
                                                        >{e.title}</div>
                                                    )
                                                })}
                                                {dayEvents.length > 2 && (
                                                    <div className="text-[9px] text-slate-500 font-bold pl-1">+{dayEvents.length - 2} more</div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: Event List (2 cols) */}
                <div className="xl:col-span-2 space-y-4">
                    {/* Filter tabs */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-3 flex gap-1 flex-wrap shadow-sm">
                        {[{ value: 'all', label: 'All' }, ...EVENT_TYPES].map(t => (
                            <button key={t.value} onClick={() => setFilter(t.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-1
                                    ${filter === t.value
                                        ? 'btn-primary text-white shadow-md'
                                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Event cards */}
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {isLoading ? (
                            <div className="h-32 flex items-center justify-center"><Spinner /></div>
                        ) : filteredEvents.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 p-8 text-center">
                                <Calendar size={32} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-sm text-slate-400 font-bold">No events this month</p>
                                <p className="text-xs text-slate-400 mt-1">Click a day or use "Add Event"</p>
                            </div>
                        ) : filteredEvents.map(e => {
                            const c = getColor(e.eventType)
                            return (
                                <div key={e._id}
                                    className={`bg-white dark:bg-slate-900 rounded-2xl border ${c.border} shadow-sm overflow-hidden transition-all hover:shadow-md group`}>
                                    <div className={`h-1 ${c.dot}`} />
                                    <div className="p-4">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${c.badge}`}>
                                                        {EVENT_TYPES.find(t => t.value === e.eventType)?.label || e.eventType}
                                                    </span>
                                                    {e.isGlobal
                                                        ? <span className="text-[9px] font-bold text-primary flex items-center gap-1"><Globe size={9} />Global</span>
                                                        : <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><Lock size={9} />Private</span>
                                                    }
                                                </div>
                                                <h4 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">{e.title}</h4>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {safeFmt(e.startDate, 'MMM d, yyyy')}
                                                    {e.startDate !== e.endDate && ` → ${safeFmt(e.endDate, 'MMM d, yyyy')}`}
                                                </p>
                                                {e.description && (
                                                    <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{e.description}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button onClick={() => handleEdit(e)}
                                                    className="p-1.5 text-slate-400 hover:text-primary hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors">
                                                    <Edit2 size={14} />
                                                </button>
                                                <button onClick={() => {
                                                    if (confirm(`Delete "${e.title}"?`)) deleteMutation.mutate(e._id)
                                                }}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <EventModal
                    event={editingEvent}
                    onClose={() => { setShowModal(false); setEditingEvent(null) }}
                    onSave={handleSave}
                    isSaving={createMutation.isPending || updateMutation.isPending}
                />
            )}
        </div>
    )
}
