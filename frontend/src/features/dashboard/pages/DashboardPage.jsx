import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Clock, CheckCircle, XCircle, AlertCircle,
    CalendarDays, Award, ChevronRight, Activity,
    Bell, Megaphone, HelpCircle, FileText, Settings2, Lock
} from 'lucide-react'
import { timesheetAPI, leaveAPI, announcementAPI, notificationAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import useSystemStore from '@/store/systemStore'
import { clsx } from 'clsx'
import { toast } from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { format, startOfWeek, endOfWeek, isSameDay } from 'date-fns'
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
    const { user } = useAuthStore()
    const { appVersion } = useSystemStore()
    const isAdmin = ['admin', 'manager'].includes(user?.role)
    const navigate = useNavigate()

    // Config
    const weekStartDay = 1 // Monday
    const today = new Date()
    const weekStart = startOfWeek(today, { weekStartsOn: weekStartDay })
    const weekEnd = endOfWeek(today, { weekStartsOn: weekStartDay })

    // State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [prefs, setPrefs] = useState(() => {
        const saved = localStorage.getItem('dashboard_prefs')
        return saved ? JSON.parse(saved) : {
            quickActions: true,
            chart: true,
            projects: isAdmin,
            announcements: true,
            calendar: true,
            feed: true,
            insights: !isAdmin
        }
    })

    const togglePref = (key) => {
        const next = { ...prefs, [key]: !prefs[key] }
        setPrefs(next)
        localStorage.setItem('dashboard_prefs', JSON.stringify(next))
    }

    // -- Data Fetching (Parallel) --
    const { data: summaryData, isLoading: summaryLoading } = useQuery({
        queryKey: ['dashboard-summary'],
        queryFn: () => timesheetAPI.getDashboardSummary({}).then(r => r.data.data),
    })

    const { data: leaveBalance } = useQuery({
        queryKey: ['leave-balance', user?.id],
        queryFn: () => leaveAPI.getBalance(user.id).then(r => r.data.data),
        enabled: !!user?.id && !isAdmin,
    })

    const { data: announcements } = useQuery({
        queryKey: ['announcements', 'active'],
        queryFn: () => announcementAPI.getAll({ limit: 3 }).then(r => r.data.data),
    })

    const { data: notifications } = useQuery({
        queryKey: ['notifications', 'recent'],
        queryFn: () => notificationAPI.getAll({ limit: 5 }).then(r => r.data.data),
    })

    if (summaryLoading) return (
        <div className="flex justify-center items-center h-[70vh]"><Spinner size="lg" /></div>
    )

    // Calculate Hero Progress
    const loggedHoursThisWeek = summaryData?.hoursThisWeek || 0
    const targetHours = 40
    const progressPct = Math.min(100, Math.round((loggedHoursThisWeek / targetHours) * 100))
    const isComplete = progressPct === 100

    // Weekly Chart Data
    const chartData = summaryData?.dailyHours || [
        { day: 'Mon', hours: 0 }, { day: 'Tue', hours: 0 }, { day: 'Wed', hours: 0 },
        { day: 'Thu', hours: 0 }, { day: 'Fri', hours: 0 }, { day: 'Sat', hours: 0 }, { day: 'Sun', hours: 0 }
    ]

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 pb-12">

            {/* 1️⃣ WELCOME HERO */}
            <motion.section
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
                            Good Morning, {user?.name?.split(' ')[0] || 'User'} <span className="inline-block animate-waving-hand origin-bottom-right">👋</span>
                        </h1>
                        <p className="text-slate-300 text-sm md:text-base font-medium pt-2 max-w-xl">
                            Week: {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d')} <span className="opacity-50 mx-2">|</span>
                            {isAdmin ? 'System Operational' : `${loggedHoursThisWeek} of ${targetHours} hours logged`}
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
                                            <Activity size={20} />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-white">{summaryData?.notSubmittedCount || 0}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pending Compliance</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (appVersion === 'basic') {
                                                return toast.error('This feature is available in the Pro version.', { icon: '🔒' })
                                            }
                                            navigate('/timesheets/compliance')
                                        }}
                                        className={clsx(
                                            "w-full py-2.5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all border",
                                            appVersion === 'basic' ? "bg-slate-700/50 border-white/5 opacity-50 cursor-not-allowed" : "bg-white/10 hover:bg-white/20 border-white/10"
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
                                    <p className="text-2xl font-black text-white mb-1">Friday 6:00 PM</p>
                                    <p className={`text-sm font-bold ${isComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {isComplete ? 'Required hours met 🎉' : '⏳ 48 hours remaining'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* 2️⃣ ACTION CENTER */}
            <motion.section
                initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4, delay: 0.1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
            >
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
                        if (isAdmin && appVersion === 'basic') {
                            e.preventDefault()
                            return toast.error('This feature is available in the Pro version.', { icon: '🔒' })
                        }
                        isAdmin ? navigate('/timesheets/compliance') : navigate('/timesheets')
                    }}
                    className={clsx(
                        "card p-5 group hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 cursor-pointer",
                        isAdmin && appVersion === 'basic' ? "opacity-60 grayscale cursor-not-allowed" : "hover:border-rose-500/30"
                    )}
                >
                    <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <XCircle size={20} />
                        </div>
                        <span className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            {isAdmin ? summaryData?.notSubmittedCount : summaryData?.rejectedTimesheets}
                            {isAdmin && appVersion === 'basic' && <Lock size={14} style={{ color: '#9333ea' }} />}
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
                        <div className="card p-6 flex flex-col h-96">
                            <div className="flex items-center justify-between xl:justify-start gap-4 mb-6">
                                <div>
                                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                        <Activity size={18} className="text-primary-500" /> Hourly Productivity
                                    </h3>
                                    <p className="text-xs font-bold text-slate-400 mt-1">Logged hours this week</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className="text-2xl font-black text-slate-800">{loggedHoursThisWeek}h</p>
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
                                        />
                                        <Bar dataKey="hours" radius={[6, 6, 6, 6]} barSize={40}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.hours >= 8 ? '#10b981' : entry.hours > 0 ? '#6366f1' : '#e2e8f0'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Top Projects */}
                    {isAdmin && prefs.projects && (
                        <div className="card p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <Award size={18} className="text-amber-500" /> Top Active Projects
                                </h3>
                                <button
                                    onClick={() => navigate('/projects')}
                                    className="text-[10px] font-black uppercase text-primary-500 hover:text-primary-600 transition-colors"
                                >
                                    View Projects
                                </button>
                            </div>
                            <div className="space-y-4">
                                {summaryData?.projectTotals?.slice(0, 4).map((p, i) => {
                                    const maxH = summaryData.projectTotals[0]?.totalHours || 1
                                    const pct = (p.totalHours / maxH) * 100
                                    return (
                                        <div
                                            key={i}
                                            className="group cursor-pointer"
                                            onClick={() => navigate('/projects')}
                                        >
                                            <div className="flex justify-between items-end mb-1">
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-primary-600 transition-colors">{p.projectName}</span>
                                                <span className="text-sm font-black text-slate-800">{p.totalHours}h</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* 4️⃣ WORKSPACE HUB (Right 4 cols) */}
                <motion.div
                    initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4, delay: 0.3 }}
                    className="lg:col-span-4 flex flex-col gap-5"
                >
                    {/* Smart Insight Widget */}
                    {!isAdmin && prefs.insights !== false && (
                        <div className="card p-5 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-transparent border-indigo-100 dark:border-indigo-900/30">
                            <div className="flex gap-3">
                                <div className="mt-0.5 text-indigo-500 shrink-0">
                                    <HelpCircle size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white mb-1">Insights</h3>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-3">
                                        You logged 20% fewer hours this week compared to last week. Would you like to review your entries?
                                    </p>
                                    <button
                                        onClick={() => navigate('/timesheets')}
                                        className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors flex items-center gap-1"
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
                                className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
                            >
                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
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
                            <div className="p-2 space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                                {announcements?.length ? (
                                    announcements.map(ann => (
                                        <div
                                            key={ann._id}
                                            className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors line-clamp-2"
                                            onClick={() => isAdmin ? navigate('/announcements') : null}
                                        >
                                            <p className="text-xs font-bold text-slate-800 mb-1">{ann.title}</p>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{ann.content}</p>
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
            {prefs.feed && (
                <motion.section
                    initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.4, delay: 0.4 }}
                    className="card p-6"
                >
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <Activity size={20} className="text-primary-500" /> Recent Activity
                            </h3>
                            <p className="text-xs font-bold text-slate-400 mt-1">Latest system-wide events and updates</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {notifications?.length ? (
                            notifications.map((notif, index) => (
                                <div key={notif._id} className="flex gap-4 p-4 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group">
                                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center flex-shrink-0 text-slate-400 group-hover:text-primary-500 transition-colors">
                                        <Activity size={16} />
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
            )}

            {/* Dashboard Settings Modal */}
            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Dashboard Settings" maxWidth="max-w-md">
                <div className="space-y-4 pt-2">
                    <p className="text-sm text-slate-500 font-medium mb-4">Toggle visibility of dashboard widgets.</p>

                    {[
                        { key: 'quickActions', label: 'Quick Actions Shortcuts' },
                        { key: 'chart', label: 'Hourly Productivity Chart' },
                        ...(isAdmin ? [{ key: 'projects', label: 'Top Active Projects' }] : []),
                        { key: 'announcements', label: 'Announcements Hub' },
                        { key: 'calendar', label: 'Calendar Widget' },
                        { key: 'feed', label: 'Recent Activity Feed' },
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
