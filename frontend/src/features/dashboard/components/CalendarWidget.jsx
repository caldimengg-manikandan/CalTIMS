import React, { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { calendarAPI } from '@/services/endpoints'
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isToday
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings2 } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'

// ── Color map ─────────────────────────────────────────────────────────────────
const TYPE_BAR = {
    holiday: 'bg-orange-400',
    company_event: 'bg-blue-400',
    leave: 'bg-emerald-400',
    personal_event: 'bg-purple-400',
    'company-event': 'bg-blue-400',
    meeting: 'bg-cyan-400',
    deadline: 'bg-rose-400',
}
const TYPE_NUM = {
    holiday: 'text-orange-600 dark:text-orange-400 font-black',
    company_event: 'text-blue-600 dark:text-blue-400 font-black',
    leave: 'text-emerald-600 dark:text-emerald-400 font-black',
    personal_event: 'text-purple-600 dark:text-purple-400 font-black',
    'company-event': 'text-blue-600 dark:text-blue-400 font-black',
    meeting: 'text-cyan-600 dark:text-cyan-400 font-black',
    deadline: 'text-rose-600 dark:text-rose-400 font-black',
}
const TYPE_LABEL = {
    holiday: 'Holiday',
    company_event: 'Company Event',
    leave: 'Leave',
    personal_event: 'Personal',
    'company-event': 'Company Event',
    meeting: 'Meeting',
    deadline: 'Deadline',
}

const getBar = (t) => TYPE_BAR[t] || 'bg-slate-300'
const getNum = (t) => TYPE_NUM[t] || 'text-slate-600 dark:text-slate-400 font-semibold'
const getLabel = (t) => TYPE_LABEL[t] || t

const EVENT_PRIORITY = { holiday: 0, company_event: 1, leave: 2, personal_event: 3 }

const LEGEND = [
    { type: 'holiday', label: 'Holiday', bar: 'bg-orange-400' },
    { type: 'company_event', label: 'Company', bar: 'bg-blue-400' },
    { type: 'leave', label: 'Leave', bar: 'bg-emerald-400' },
]

function eventsOnDay(events, day) {
    return (events ?? []).filter(e => {
        try {
            const s = new Date(e.startDate); s.setHours(0, 0, 0, 0)
            const en = new Date(e.endDate); en.setHours(23, 59, 59, 999)
            return day >= s && day <= en
        } catch { return false }
    })
}

// ── Fixed Tooltip rendered at document level ──────────────────────────────────
function Tooltip({ events, anchorRect }) {
    if (!events || events.length === 0 || !anchorRect) return null

    // Position: above the cell, centered
    const tooltipWidth = 180
    const left = anchorRect.left + anchorRect.width / 2 - tooltipWidth / 2
    const top = anchorRect.top + window.scrollY - 8 // 8px gap above cell

    return (
        <div
            style={{
                position: 'absolute',
                top,
                left: Math.max(8, left),
                width: tooltipWidth,
                zIndex: 9999,
                transform: 'translateY(-100%)',
                pointerEvents: 'none',
            }}
        >
            <div className="bg-slate-900 text-white rounded-xl shadow-2xl px-3 py-2.5 space-y-2">
                {events.map((e, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${getBar(e.eventType)}`} />
                        <div className="min-w-0">
                            <p className="text-[9px] text-slate-400 uppercase tracking-wide leading-none mb-0.5">
                                {getLabel(e.eventType)}
                            </p>
                            <p className="text-[12px] font-bold text-white leading-tight">
                                {e.title}
                            </p>
                            {e.description && (
                                <p className="text-[9px] text-slate-300 mt-0.5 leading-tight">
                                    {e.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {/* Arrow */}
            <div
                style={{ marginLeft: Math.min(tooltipWidth - 16, Math.max(8, anchorRect.left + anchorRect.width / 2 - Math.max(8, left) - 6)) }}
                className="w-3 h-3 bg-slate-900 rotate-45 -mt-1.5"
            />
        </div>
    )
}

// ── Main Widget ───────────────────────────────────────────────────────────────
export default function CalendarWidget() {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [tooltip, setTooltip] = useState(null) // { events, rect }
    const containerRef = useRef(null)
    const { user } = useAuthStore()
    const navigate = useNavigate()
    const isAdmin = user?.role === 'admin'

    const { data: events, isLoading } = useQuery({
        queryKey: ['calendar-events', format(currentMonth, 'yyyy-MM')],
        queryFn: () => calendarAPI.getAll({ month: format(currentMonth, 'yyyy-MM') }).then(r => r.data.data ?? []),
        staleTime: 60_000,
    })

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 })
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
        return eachDayOfInterval({ start, end })
    }, [currentMonth])

    const handleMouseEnter = (dayEvents, el) => {
        if (!dayEvents.length) return
        const rect = el.getBoundingClientRect()
        const containerRect = containerRef.current?.getBoundingClientRect()
        // Rect relative to container (which is position:relative)
        setTooltip({
            events: dayEvents,
            anchorRect: {
                left: rect.left - containerRect.left,
                top: rect.top - containerRect.top,
                width: rect.width,
                height: rect.height,
            }
        })
    }
    const handleMouseLeave = () => setTooltip(null)

    const prev = () => setCurrentMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })
    const next = () => setCurrentMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })

    return (
        <div className="card !p-0 bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-white/10">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-black text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                    <CalendarIcon size={15} className="text-indigo-500" />
                    Calendar
                </h3>
                <div className="flex items-center gap-0.5">
                    <button onClick={prev} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition-colors">
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 min-w-[90px] text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                    <button onClick={next} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 transition-colors">
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            <div className="p-3">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                        <div key={i} className="text-center text-[9px] font-black text-slate-400 uppercase py-1">{d}</div>
                    ))}
                </div>

                {isLoading ? (
                    <div className="h-44 flex items-center justify-center"><Spinner size="sm" /></div>
                ) : (
                    /* position:relative so the tooltip absolute positions inside it */
                    <div ref={containerRef} className="relative grid grid-cols-7 gap-0.5">

                        {days.map((day, i) => {
                            const inMonth = isSameMonth(day, currentMonth)
                            const todayDay = isToday(day)
                            const dayEvents = inMonth ? eventsOnDay(events, day) : []

                            const primary = dayEvents.length > 0
                                ? dayEvents.reduce((a, b) =>
                                    (EVENT_PRIORITY[a.eventType] ?? 99) <= (EVENT_PRIORITY[b.eventType] ?? 99) ? a : b)
                                : null

                            return (
                                <div key={i}
                                    onMouseEnter={e => dayEvents.length && handleMouseEnter(dayEvents, e.currentTarget)}
                                    onMouseLeave={handleMouseLeave}
                                    className={`
                                        rounded-lg flex flex-col min-h-[44px] cursor-default transition-colors
                                        ${inMonth
                                            ? 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5'
                                            : 'opacity-20'}
                                        ${dayEvents.length ? 'cursor-pointer' : ''}
                                    `}
                                >
                                    {/* 3px colored top accent bar */}
                                    <div className={`h-[3px] w-full rounded-t-lg ${primary ? getBar(primary.eventType) : 'bg-transparent'}`} />

                                    {/* Day number */}
                                    <div className="flex items-center justify-center flex-1 py-1">
                                        <span className={`text-[12px] leading-none
                                            ${todayDay
                                                ? 'w-6 h-6 flex items-center justify-center rounded-full btn-primary text-white font-black'
                                                : primary ? getNum(primary.eventType) : 'text-slate-600 dark:text-slate-400 font-semibold'
                                            }
                                        `}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Tooltip rendered inside the relative container, pops above cells */}
                        {tooltip && (
                            <Tooltip events={tooltip.events} anchorRect={tooltip.anchorRect} />
                        )}
                    </div>
                )}

                {/* Legend */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-white/10 flex gap-4 flex-wrap">
                    {LEGEND.map(l => (
                        <div key={l.type} className="flex items-center gap-1.5">
                            <div className={`w-5 h-[3px] rounded-full ${l.bar}`} />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{l.label}</span>
                        </div>
                    ))}
                </div>

                {isAdmin && (
                    <button onClick={() => navigate('/calendar/manage')}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] font-bold text-indigo-500 hover:text-primary dark:text-indigo-400 transition-colors uppercase tracking-widest py-1">
                        <Settings2 size={10} /> Manage Events
                    </button>
                )}
            </div>
        </div>
    )
}
