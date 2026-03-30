import React, { useState, useEffect } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Clock, CheckCircle, XCircle, AlertCircle, CalendarDays, Award, ChevronRight, ChevronLeft, Activity as LucideActivity, Bell, Megaphone, HelpCircle, FileText, Settings2, Lock, Briefcase, Filter, ChevronDown } from 'lucide-react'
import { timesheetAPI, leaveAPI, announcementAPI, notificationAPI, projectAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { clsx } from 'clsx'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { format, startOfWeek, endOfWeek, isSameDay, addWeeks, subWeeks, addDays, setHours, setMinutes, isAfter, differenceInHours, differenceInMinutes, differenceInDays, setSeconds, setMilliseconds } from 'date-fns'
import CalendarWidget from '@/features/dashboard/components/CalendarWidget'
import { motion, AnimatePresence } from 'framer-motion'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts'

// -- Animation Variants --
const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 }
}

export default function DashboardPage() {
    const { user, isPro } = useAuthStore()
    const { general } = useSettingsStore()
    const isAdmin = ['admin', 'manager'].includes(user?.role)
    const navigate = useNavigate()
 

    const today = new Date()

    const weekStartsOn = general?.weekStartDay?.toLowerCase() === 'sunday' ? 0 : 1
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn }))

    // Reset week to current if the system week start setting changes
    useEffect(() => {
        setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn }))
    }, [weekStartsOn])

    const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn })

    // State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [prefs, setPrefs] = useState(() => {
        const saved = localStorage.getItem('dashboard_prefs')
        return saved ? JSON.parse(saved) : {
            quickActions: true,
            chart: true,
            projects: true,
            announcements: true,
            calendar: true,
            feed: true,
            insights: !isAdmin
        }
    })

    const [selectedProjectId, setSelectedProjectId] = useState('all')

    const togglePref = (key) => {
        const next = { ...prefs, [key]: !prefs[key] }
        setPrefs(next)
        localStorage.setItem('dashboard_prefs', JSON.stringify(next))
    }

    // -- Data Fetching (Parallel) --
    const { data: summaryData, isPending: summaryLoading } = useQuery({
        queryKey: ['dashboard-summary', selectedProjectId, currentWeekStart],
        queryFn: () => timesheetAPI.getDashboardSummary({
            projectId: selectedProjectId,
            weekStartDate: format(currentWeekStart, 'yyyy-MM-dd')
        }).then(r => r.data.data),
        placeholderData: keepPreviousData,
    })

    const { data: projects = [] } = useQuery({
        queryKey: ['projects', 'all'],
        queryFn: () => projectAPI.getAll({ limit: 5000 }).then(r => r.data.data || []),
        enabled: !!user?.id
    })

    const { data: leaveBalance } = useQuery({
        queryKey: ['leave-balance', user?.id],
        queryFn: () => leaveAPI.getBalance(user.id).then(r => r.data.data),
        enabled: !!user?.id && !isAdmin,
    })

    const { data: announcements } = useQuery({
        queryKey: ['announcements', 'active'],
        queryFn: () => announcementAPI.getAll({ limit: 10 }).then(r => r.data.data),
    })

    const { data: notifications } = useQuery({
        queryKey: ['notifications', 'recent'],
        queryFn: () => notificationAPI.getAll({ limit: 5 }).then(r => r.data.data.notifications || []),
    })

    if (summaryLoading) return (
        <div className="flex justify-center items-center h-[70vh]"><Spinner size="lg" /></div>
    )

    // -- Helpers --
    const getGreeting = () => {
        const hour = today.getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 17) return 'Good Afternoon'
        if (hour < 21) return 'Good Evening'
        return 'Good Night'
    }

    // Calculate Hero Progress
    const loggedHoursThisWeek = summaryData?.hoursThisWeek || 0
    const workingHoursPerDay = general?.workingHoursPerDay || 8
    const workingDaysCount = general?.isWeekendWorkable ? 7 : 5
    const targetHours = workingHoursPerDay * workingDaysCount
    const progressPct = Math.min(100, Math.round((loggedHoursThisWeek / targetHours) * 100))
    const isComplete = progressPct === 100

    // Weekly Chart Data
    const chartData = summaryData?.dailyHours || [
        { day: 'Mon', hours: 0 }, { day: 'Tue', hours: 0 }, { day: 'Wed', hours: 0 },
        { day: 'Thu', hours: 0 }, { day: 'Fri', hours: 0 }, { day: 'Sat', hours: 0 }, { day: 'Sun', hours: 0 }
    ]

    const getDeadlineInfo = () => {
        const deadlineStr = summaryData?.submissionDeadline || 'Friday 18:00'

        try {
            const [dayStr, timeStr] = deadlineStr.split(' ')
            const [hours, minutes] = timeStr.split(':').map(Number)

            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            const targetDay = days.indexOf(dayStr)

            if (targetDay === -1) return { label: deadlineStr, remaining: 'Check policy', color: 'text-amber-400' }

            let deadline = startOfWeek(new Date(), { weekStartsOn })
            const offset = (targetDay - weekStartsOn + 7) % 7
            deadline = addDays(deadline, offset)
            deadline = setHours(deadline, hours)
            deadline = setMinutes(deadline, minutes)
            deadline = setSeconds(deadline, 0)
            deadline = setMilliseconds(deadline, 0)

            if (isComplete) {
                return { label: format(deadline, 'EEEE h:mm a'), remaining: 'Required hours met 🎉', color: 'text-emerald-400' }
            }

            if (isAfter(new Date(), deadline)) {
                const diffHours = Math.abs(differenceInHours(new Date(), deadline))
                if (diffHours < 24) return { label: format(deadline, 'EEEE h:mm a'), remaining: `⏳ ${diffHours}h overdue`, color: 'text-rose-400' }
                return { label: format(deadline, 'EEEE h:mm a'), remaining: `⏳ ${differenceInDays(new Date(), deadline)}d overdue`, color: 'text-rose-400' }
            }

            const diffHours = differenceInHours(deadline, new Date())
            if (diffHours < 1) {
                const diffMins = differenceInMinutes(deadline, new Date())
                return { label: format(deadline, 'EEEE h:mm a'), remaining: `⏳ ${diffMins}m remaining`, color: 'text-amber-400' }
            }
            if (diffHours < 48) {
                return { label: format(deadline, 'EEEE h:mm a'), remaining: `⏳ ${diffHours}h remaining`, color: 'text-amber-400' }
            }
            return { label: format(deadline, 'EEEE h:mm a'), remaining: `⏳ ${differenceInDays(deadline, new Date())}d remaining`, color: 'text-amber-400' }

        } catch (err) {
            return { label: 'Friday 6:00 PM', remaining: '48 hours remaining', color: 'text-amber-400' }
        }
    }

    const deadlineInfo = getDeadlineInfo()

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 pb-12">

            {/* 1️⃣ WELCOME HERO */}
            <motion.section
                id="tour-hero"
                initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 md:p-10 shadow-2xl shadow-slate-900/20"
            >
                {/* Decorative background vectors */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary-500/20 blur-3xl rounded-full pointer-events-none" />
                <div className="absolute bottom-0 left-10 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                    <div className="md:col-span-7 space-y-2">
                        <p className="text-slate-300 font-bold tracking-widest uppercase text-xs">
                            {format(today, 'EEEE, MMMM d, yyyy')}
                        </p>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight">
                            {getGreeting()}, {user?.name?.split(' ')[0] || 'User'} <span className="inline-block animate-waving-hand origin-bottom-right">👋</span>
                        </h1>
                        <p className="text-slate-300 text-sm md:text-base font-medium pt-2 max-w-xl">
                            Week: {format(currentWeekStart, 'MMM d')} – {format(currentWeekEnd, 'MMM d')} <span className="opacity-50 mx-2">|</span>
                            {isAdmin ? 'System Operational' : `${Number(loggedHoursThisWeek).toFixed(2)} of ${targetHours.toFixed(2)} hours logged`}
                        </p>

                        {!isAdmin && (
                            <div className="pt-6 max-w-md">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Timesheet Progress</span>
                                    <span className={`text-sm font-black ${isComplete ? 'text-emerald-400' : 'text-primary-400'}`}>{progressPct}%</span>
                                </div>
                                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPct}%` }}
                                        transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                                        className={`h-full rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-primary-500'}`}
                                    />
                                </div>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <button
                                        onClick={() => navigate('/timesheets')}
                                        className="px-6 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-400 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 hover:-translate-y-0.5"
                                    >
                                        {isComplete ? 'Review Timesheet' : 'Continue Timesheet'}
                                    </button>
                                    <button
                                        onClick={() => navigate('/timesheets/history')}
                                        className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        View History
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="md:col-span-5 flex flex-col items-center md:items-end md:justify-end">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="mb-4 sm:mb-12 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                        >
                            <Settings2 size={14} /> Customize Dashboard
                        </button>

                        <div className="w-full max-w-xs transition-all duration-500">
                            {isAdmin ? (
                                <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl group hover:bg-white/15 transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-10 h-10 rounded-2xl bg-primary-500/20 text-primary-400 flex items-center justify-center">
                                            <LucideActivity size={20} />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-white">{summaryData?.notSubmittedCount || 0}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pending Compliance</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigate('/timesheets/compliance')
                                        }}
                                        className={clsx(
                                            "w-full py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all border",
                                            !isPro() ? "bg-slate-700/50 border-white/5 opacity-50 cursor-not-allowed" : "bg-white/10 hover:bg-white/20 border-white/10"
                                        )}
                                    >
                                        Review Compliance
                                    </button>
                                </div>
                            ) : (
                                <div className="p-6 rounded-3xl bg-white/10 backdrop-blur-md border border-white/10 shadow-xl">
                                    <div className="flex items-center gap-3 mb-2 opacity-60">
                                        <Clock size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Next Deadline</span>
                                    </div>
                                    <p className="text-2xl font-black text-white mb-1">{deadlineInfo.label}</p>
                                    <p className={`text-sm font-bold ${deadlineInfo.color}`}>
                                        {deadlineInfo.remaining}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* 2️⃣ ACTION CENTER & FILTERS */}
            <motion.section
                initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4, delay: 0.1 }}
                className="space-y-4"
            >
                {projects?.length > 0 && (
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter By Project</span>
                            <div className="relative group">
                                <Briefcase size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-500" />
                                <select
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                    className="appearance-none pl-8 pr-10 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer hover:border-primary-400 transition-colors focus:ring-1 focus:ring-primary-500 outline-none"
                                >
                                    <option value="all">All Projects</option>
                                    {projects.map(p => (
                                        <option key={p._id} value={p._id}>{p.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-primary-500 transition-colors" />
                            </div>
                        </div>

                        {selectedProjectId !== 'all' && (
                            <button
                                onClick={() => setSelectedProjectId('all')}
                                className="text-[10px] font-black uppercase tracking-widest text-primary-500 hover:text-primary-600 transition-colors"
                            >
                                Clear Filter
                            </button>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    <div
                        onClick={() => isAdmin ? navigate('/timesheets/manage?status=Approved') : navigate('/leaves')}
                        className="card p-5 group hover:border-emerald-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer"
                    >
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CheckCircle size={20} />
                            </div>
                            <span className="text-2xl font-black text-slate-800">{isAdmin ? summaryData?.approvedTimesheets : (leaveBalance?.annual || 0)}</span>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-sm font-bold text-slate-700">{isAdmin ? 'Approved' : 'Annual Leave'}</h4>
                            <p className="text-xs text-slate-400 font-medium mt-1">{isAdmin ? 'Finalized timesheets' : 'Available balance'}</p>
                        </div>
                    </div>

                    <div
                        onClick={() => isAdmin ? navigate('/timesheets/manage?status=Submitted') : navigate('/timesheets/history')}
                        className="card p-5 group hover:border-amber-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer"
                    >
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <AlertCircle size={20} />
                            </div>
                            <span className="text-2xl font-black text-slate-800">{summaryData?.pendingTimesheets || 0}</span>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-sm font-bold text-slate-700">{isAdmin ? 'Pending Approval' : 'Pending Sheets'}</h4>
                            <p className="text-xs text-slate-400 font-medium mt-1">Waiting for review</p>
                        </div>
                    </div>

                    <div
                        onClick={(e) => {
                            isAdmin ? navigate('/timesheets/compliance') : navigate('/timesheets')
                        }}
                        className={clsx(
                            "card p-5 group hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer",
                            isAdmin && !isPro() ? "opacity-60 grayscale cursor-not-allowed" : "hover:border-rose-500/30"
                        )}
                    >
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <XCircle size={20} />
                            </div>
                            <span className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                {isAdmin ? summaryData?.notSubmittedCount : summaryData?.rejectedTimesheets}
                                {isAdmin && !isPro() && <Lock size={14} style={{ color: '#9333ea' }} />}
                            </span>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-sm font-bold text-slate-700">{isAdmin ? 'Not Submitted' : 'Rejected'}</h4>
                            <p className="text-xs text-slate-400 font-medium mt-1">{isAdmin ? 'Missing from staff' : 'Needs your correction'}</p>
                        </div>
                    </div>

                    <div
                        onClick={() => isAdmin ? navigate('/employees') : navigate('/leaves')}
                        className="card p-5 group hover:border-primary-500/30 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer"
                    >
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <CalendarDays size={20} />
                            </div>
                            <span className="text-2xl font-black text-slate-800">{isAdmin ? summaryData?.totalEmployees : (leaveBalance?.casual || 0)}</span>
                        </div>
                        <div className="mt-4">
                            <h4 className="text-sm font-bold text-slate-700">{isAdmin ? 'Active Staff' : 'Casual Leave'}</h4>
                            <p className="text-xs text-slate-400 font-medium mt-1">{isAdmin ? 'System users' : 'Available balance'}</p>
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* MAIN 3-COLUMN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* 3️⃣ INSIGHTS ROW (Left 8 cols) */}
                <motion.div
                    initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4, delay: 0.2 }}
                    className="lg:col-span-8 flex flex-col gap-5"
                >
                    {/* Weekly Productivity Chart */}
                    {prefs.chart && (
                        <div id="tour-productivity-chart" className="card p-6 flex flex-col h-96">
                            <div className="flex items-center justify-between xl:justify-start gap-4 mb-6">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <LucideActivity size={18} className="text-primary-500" /> Hourly Productivity
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1">Logged hours this week</p>
                                </div>

                                <div className="mx-auto flex items-center gap-4 py-1 px-4 bg-slate-100 rounded-xl shadow-inner border border-slate-200/50">
                                    <button
                                        onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
                                        className="p-1.5 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-primary-600"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-700 whitespace-nowrap uppercase tracking-wider">
                                        <CalendarDays size={14} className="text-primary-500" />
                                        {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
                                    </div>
                                    <button
                                        onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
                                        disabled={startOfWeek(addWeeks(currentWeekStart, 1), { weekStartsOn }) > startOfWeek(new Date(), { weekStartsOn })}
                                        className={`p-1.5 rounded-lg transition-colors ${startOfWeek(addWeeks(currentWeekStart, 1), { weekStartsOn }) > startOfWeek(new Date(), { weekStartsOn }) ? 'text-slate-300 opacity-50 cursor-not-allowed' : 'text-slate-500 hover:text-primary-600 hover:bg-white'}`}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                <div className="text-right">
                                    <p className="text-2xl font-black text-slate-800">{(loggedHoursThisWeek || 0).toFixed(2)}h</p>
                                    <p className="text-[10px] font-black uppercase text-slate-400">Total Week</p>
                                </div>
                            </div>

                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                                        <RechartsTooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [`${Number(value).toFixed(2)}h`, 'Hours']}
                                        />
                                        <Bar dataKey="hours" radius={[6, 6, 6, 6]} barSize={40}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.hours >= workingHoursPerDay ? '#10b981' : entry.hours > 0 ? '#6366f1' : '#e2e8f0'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Top Projects */}
                    {prefs.projects && (() => {
                        // Merge all projects with their hours from summaryData
                        const hourMap = {}
                        summaryData?.projectTotals?.forEach(p => {
                            if (p.projectId) hourMap[p.projectId] = p.totalHours || 0
                        })
                        const allProjectRows = projects.map(p => ({
                            _id: p._id,
                            name: p.name,
                            hours: hourMap[p._id] || 0,
                            budgetHours: p.budgetHours || 0,
                        })).sort((a, b) => b.hours - a.hours)

                        const maxH = allProjectRows[0]?.hours || 1
                        const pinned = allProjectRows.slice(0, 4)
                        const rest = allProjectRows.slice(4)

                        const ProjectRow = ({ p }) => {
                            const pct = p.budgetHours > 0 
                                ? Math.min(100, (p.hours / p.budgetHours) * 100)
                                : (p.hours / maxH) * 100
                            const isSelected = selectedProjectId === p._id
                            const isOverBudget = p.budgetHours > 0 && p.hours > p.budgetHours

                            return (
                                <div
                                    key={p._id}
                                    className={`group cursor-pointer px-3 py-2 rounded-xl transition-all ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                                    onClick={() => setSelectedProjectId(isSelected ? 'all' : p._id)}
                                >
                                    <div className="flex justify-between items-end mb-1.5">
                                        <div className="flex flex-col min-w-0">
                                            <span className={`text-sm font-bold transition-colors truncate ${isSelected ? 'text-primary-600' : 'text-slate-700 group-hover:text-primary-600'}`}>
                                                {p.name}
                                            </span>
                                            {p.budgetHours > 0 && (
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[10px] font-black uppercase tracking-tight ${isOverBudget ? 'text-rose-500' : 'text-slate-400'}`}>
                                                        {Math.round((p.hours / p.budgetHours) * 100)}% Used
                                                    </span>
                                                    <span className="text-[10px] text-slate-300">•</span>
                                                    <span className="text-[10px] font-medium text-slate-400">Budget: {p.budgetHours}h</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0 ml-2">
                                            <span className={`text-sm font-black ${isSelected ? 'text-primary-700' : 'text-slate-800 dark:text-white'}`}>
                                                {(p.hours || 0).toFixed(1)}<span className="text-[10px] font-bold opacity-40 ml-0.5">h</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                isOverBudget ? 'bg-rose-500' :
                                                isSelected ? 'bg-primary-500' : 
                                                'bg-gradient-to-r from-primary-400 to-primary-600'
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            )
                        }

                        return (
                            <div className="card p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <Award size={18} className="text-amber-500" /> Top Active Projects
                                    </h3>
                                    <div className="flex items-center gap-3">
                                        {selectedProjectId !== 'all' && (
                                            <button
                                                onClick={() => setSelectedProjectId('all')}
                                                className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                Clear
                                            </button>
                                        )}
                                        <button
                                            onClick={() => navigate('/projects')}
                                            className="text-[10px] font-black uppercase text-primary-500 hover:text-primary-600 transition-colors"
                                        >
                                            View Projects
                                        </button>
                                    </div>
                                </div>

                                {allProjectRows.length === 0 ? (
                                    <p className="text-sm text-center text-slate-400 font-bold py-6">No projects found</p>
                                ) : (
                                    <>
                                        {/* Pinned first 4 - always visible */}
                                        <div className="space-y-1">
                                            {pinned.map(p => <ProjectRow key={p._id} p={p} />)}
                                        </div>

                                        {/* Remaining projects in scrollable area */}
                                        {rest.length > 0 && (
                                            <div className="mt-2 max-h-[160px] overflow-y-auto space-y-1 custom-scrollbar border-t border-slate-100 dark:border-slate-700 pt-2">
                                                {rest.map(p => <ProjectRow key={p._id} p={p} />)}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })()}
                </motion.div>

                {/* 4️⃣ WORKSPACE HUB (Right 4 cols) */}
                <motion.div
                    initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4, delay: 0.3 }}
                    className="lg:col-span-4 flex flex-col gap-5"
                >
                    {/* Smart Insight Widget */}
                    {!isAdmin && prefs.insights !== false && (
                        <div className="card p-5 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/10 dark:to-transparent border-primary-100 dark:border-primary-900/30">
                            <div className="flex gap-3">
                                <div className="mt-0.5 text-primary-500 shrink-0">
                                    <HelpCircle size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white mb-1">Insights</h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-3">
                                        You logged 20% fewer hours this week compared to last week. Would you like to review your entries?
                                    </p>
                                    <button
                                        onClick={() => navigate('/timesheets')}
                                        className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-primary-400 hover:text-primary-700 transition-colors flex items-center gap-1"
                                    >
                                        Review Entries <ChevronRight size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Quick Actions Shortcuts */}
                    {prefs.quickActions && (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => navigate('/timesheets')}
                                className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <Clock size={20} />
                                </div>
                                <span className="text-xs font-bold text-slate-600 text-center">Log Time</span>
                            </button>
                            <button
                                onClick={() => navigate('/leaves')}
                                className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary-200 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                    <FileText size={20} />
                                </div>
                                <span className="text-xs font-bold text-slate-600 text-center">Leaves</span>
                            </button>
                        </div>
                    )}

                    {/* Company Announcements */}
                    {prefs.announcements && (
                        <div className="card !p-0 overflow-hidden border-slate-100">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Megaphone size={16} className="text-rose-500" />
                                    <h3 className="font-black text-slate-800 text-sm">Announcements</h3>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => navigate('/announcements')}
                                        className="text-[10px] font-black uppercase text-primary-500 hover:text-primary-600 transition-colors"
                                    >
                                        View All
                                    </button>
                                )}
                            </div>
                            <div className="p-2 space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar">
                                {announcements?.length ? (
                                    [...announcements]
                                        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                                        .map(ann => (
                                            <div
                                                key={ann._id}
                                                className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                                                onClick={() => isAdmin ? navigate('/announcements') : null}
                                            >
                                                <p className="text-xs font-bold text-slate-800 mb-1">{ann.title}</p>
                                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed line-clamp-2">{ann.content}</p>
                                            </div>
                                        ))
                                ) : (
                                    <p className="p-4 text-xs text-center text-slate-400 font-bold">No recent announcements</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Calendar Widget */}
                    {prefs.calendar && (
                        <div className="rounded-3xl overflow-hidden shadow-sm border border-slate-100 relative group">
                            <CalendarWidget />
                        </div>
                    )}

                </motion.div>
            </div>

            {/* 5️⃣ ACTIVITY FEED */}
            {/* {prefs.feed && (
                <motion.section
                    initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4, delay: 0.4 }}
                    className="card p-6"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <LucideActivity size={20} className="text-primary-500" /> Recent Activity
                            </h3>
                            <p className="text-xs font-bold text-slate-400 mt-1">Latest system-wide events and updates</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {notifications?.length ? (
                            notifications.map((notif, index) => (
                                <div key={notif._id} className="flex gap-4 p-4 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-primary-500 transition-colors">
                                        <LucideActivity size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-slate-800 mb-0.5">{notif.title}</p>
                                        <p className="text-xs text-slate-500 font-medium">{notif.message}</p>
                                    </div>
                                    <div className="text-[10px] items-center text-slate-400 font-bold uppercase hidden sm:flex">
                                        {format(new Date(notif.createdAt), 'MMM d, h:mm a')}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-6 text-sm text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">No recent system activity detected.</p>
                        )}
                    </div>
                </motion.section>
            )} */}

            {/* Dashboard Settings Modal */}
            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Dashboard Settings" maxWidth="max-w-md">
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-slate-500 font-medium mb-4">Toggle visibility of dashboard widgets.</p>

                    {[
                        { key: 'quickActions', label: 'Quick Actions Shortcuts' },
                        { key: 'chart', label: 'Hourly Productivity Chart' },
                        { key: 'projects', label: 'Top Active Projects' },
                        { key: 'announcements', label: 'Announcements Hub' },
                        { key: 'calendar', label: 'Calendar Widget' },
                        // { key: 'feed', label: 'Recent Activity Feed' },
                    ].map(widget => (
                        <div key={widget.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                            <span className="text-sm font-bold text-slate-700">{widget.label}</span>
                            <button
                                onClick={() => togglePref(widget.key)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${prefs[widget.key] ? 'bg-primary-500' : 'bg-slate-300'}`}
                            >
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${prefs[widget.key] ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                    ))}

                    <button
                        onClick={() => setIsSettingsOpen(false)}
                        className="w-full mt-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                    >
                        Save Preferences
                    </button>
                </div>
            </Modal>

        </div>
    )
}
