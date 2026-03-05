import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Clock, CheckCircle, XCircle, AlertCircle,
    FolderOpen, Users, BarChart2, TrendingUp,
    Megaphone, ChevronDown, Timer, Activity,
    ListFilter, Award, Layers, ShieldCheck, UserCheck
} from 'lucide-react'
import { timesheetAPI, leaveAPI, announcementAPI, projectAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import StatCard from '@/components/charts/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { useSettingsStore } from '@/store/settingsStore'
import { format, startOfWeek, endOfWeek, subWeeks, getWeek } from 'date-fns'
import PageHeader from '@/components/ui/PageHeader'

// ─── Format Hours Display ──────────────────────────────────────────────────
const formatHoursDisplay = (totalHours) => {
    if (!totalHours) return '0h';
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}.${String(m).padStart(2, '0')}h`;
};

// ─── KPI Options for admin dropdown ────────────────────────────────────────
const KPI_OPTIONS = [
    { value: 'project-hours', label: 'Project Hours', icon: FolderOpen, description: 'Hours logged per project' },
    { value: 'status-overview', label: 'Status Overview', icon: BarChart2, description: 'Timesheet status breakdown' },
    { value: 'employee-activity', label: 'Employee Activity', icon: Users, description: 'Hours by employee' },
]

// ─── Status color maps ──────────────────────────────────────────────────────
const STATUS_COLORS = {
    draft: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
    submitted: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-400' },
    approved: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-400' },
    rejected: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-400' },
}

// ─── KPI Dropdown ───────────────────────────────────────────────────────────
function KpiDropdown({ selected, onChange }) {
    const [open, setOpen] = useState(false)
    const current = KPI_OPTIONS.find(k => k.value === selected) || KPI_OPTIONS[0]
    const Icon = current.icon

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-all duration-200 text-sm font-medium text-slate-700 dark:text-white shadow-sm"
                id="kpi-dropdown-btn"
            >
                <ListFilter size={15} className="text-primary-500" />
                <Icon size={14} className="text-slate-500 dark:text-slate-300" />
                <span className="text-primary-600 dark:text-primary-400 font-semibold">{current.label}</span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-2xl border border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden animate-fade-in">
                        {KPI_OPTIONS.map(opt => {
                            const OptIcon = opt.icon
                            const isActive = opt.value === selected
                            return (
                                <button
                                    key={opt.value}
                                    onClick={() => { onChange(opt.value); setOpen(false) }}
                                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isActive ? 'bg-primary-100 dark:bg-primary-800 text-primary-600 dark:text-primary-300' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300'}`}>
                                        <OptIcon size={15} />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-semibold ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-white'}`}>{opt.label}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{opt.description}</p>
                                    </div>
                                    {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />}
                                </button>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

// ─── Project Hours KPI Table ────────────────────────────────────────────────
function ProjectHoursKpi({ data }) {
    if (!data?.length) return <EmptyState message="No project data yet" />
    const max = Math.max(...data.map(d => d.totalHours), 1)

    return (
        <div className="space-y-4">
            {data.map((item, i) => (
                <div key={i} className="group">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 group-hover:bg-primary-500 group-hover:text-white transition-colors">{i + 1}</span>
                            <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-white">{item.label}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.code}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-slate-800 dark:text-white">{formatHoursDisplay(item.totalHours)}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">logged</p>
                        </div>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${(item.totalHours / max) * 100}%` }}
                        />
                    </div>
                    <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-amber-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Submitted: {item.submittedCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-emerald-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Approved: {item.approvedCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-rose-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Rejected: {item.rejectedCount}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ─── Status Overview KPI ────────────────────────────────────────────────────
function StatusOverviewKpi({ data }) {
    if (!data?.length) return <EmptyState message="No timesheet data yet" />
    const total = data.reduce((s, d) => s + d.count, 0)

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {data.map((item, i) => {
                    const style = STATUS_COLORS[item.label] || STATUS_COLORS.draft
                    return (
                        <div key={i} className={`group relative rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 ${style.bg} border border-transparent hover:border-white/10 shadow-sm hover:shadow-md`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className={`w-2 h-2 rounded-full ${style.dot} shadow-lg shadow-black/5`} />
                                <span className={`text-[9px] font-black uppercase tracking-widest ${style.text}`}>{item.label}</span>
                            </div>
                            <p className={`text-2xl font-black ${style.text}`}>{item.count}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-tighter">{formatHoursDisplay(item.totalHours)} total</p>
                        </div>
                    )
                })}
            </div>
            <div className="card p-4 bg-slate-50 dark:bg-white/5 border-0 rounded-2xl">
                <div className="flex items-center justify-between mb-3 px-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weightage</p>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{total} Sheets</p>
                </div>
                <div className="h-4 rounded-xl flex overflow-hidden p-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-inner">
                    {data.map((item, i) => {
                        const style = STATUS_COLORS[item.label] || STATUS_COLORS.draft
                        const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : 0
                        return (
                            <div
                                key={i}
                                className={`h-full ${style.dot} rounded-lg transition-all duration-1000 ease-out mx-0.5`}
                                style={{ width: `${pct}%`, minWidth: item.count > 0 ? '4%' : '0%' }}
                                title={`${item.label}: ${pct}%`}
                            />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─── Employee Activity KPI Table ────────────────────────────────────────────
function EmployeeActivityKpi({ data }) {
    if (!data?.length) return <EmptyState message="No employee data yet" />
    const max = Math.max(...data.map(d => d.totalHours), 1)

    return (
        <div className="space-y-3">
            {data.map((item, i) => (
                <div key={i} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0 text-white shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
                        <span className="text-sm font-black">{item.label?.[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                            <div className="min-w-0">
                                <p className="text-sm font-black text-slate-800 dark:text-white truncate">{item.label}</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.department || 'Staff'}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-black text-primary-600 dark:text-primary-400">{formatHoursDisplay(item.totalHours)}</p>
                            </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-primary-500 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${(item.totalHours / max) * 100}%` }}
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-100/50 dark:border-emerald-500/20">A: {item.approvedCount}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase px-1.5 py-0.5 bg-rose-50 dark:bg-rose-900/20 rounded border border-rose-100/50 dark:border-rose-500/20">R: {item.rejectedCount}</span>
                            </div>
                            <div className="flex items-center gap-1 ml-auto">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{item.totalTimesheets} sheets</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function EmptyState({ message }) {
    return <p className="text-sm text-slate-400 py-6 text-center">{message}</p>
}

// ─── Main Dashboard Page ────────────────────────────────────────────────────
export default function DashboardPage() {
    const { user } = useAuthStore()
    const isAdmin = user?.role === 'admin'
    const isManager = user?.role === 'manager'
    const isEmployee = user?.role === 'employee'

    const { general } = useSettingsStore()
    const weekStartDay = general?.weekStartDay || 'monday'
    const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1

    const [kpiView, setKpiView] = useState('project-hours')
    const [selectedProjectId, setSelectedProjectId] = useState('all')
    const [weekStartDate, setWeekStartDate] = useState('all')
    const [detailsModal, setDetailsModal] = useState(null) // {type: 'submitted' | 'not-submitted', employees: [] }

    // ── Data fetching ─────────────────────────────────────────────────────
    // Admin-only projects for filtering
    const { data: projects } = useQuery({
        queryKey: ['projects', 'all-list'],
        queryFn: () => projectAPI.getAll({ limit: 100 }).then(r => r.data.data),
        enabled: isAdmin,
    })

    // ── Queries ──
    const { data: summaryData, isLoading: summaryLoading } = useQuery({
        queryKey: ['dashboard-summary', { weekStartDate: weekStartDate === 'all' ? undefined : weekStartDate, projectId: selectedProjectId === 'all' ? undefined : selectedProjectId }],
        queryFn: () => timesheetAPI.getDashboardSummary({
            weekStartDate: weekStartDate,
            projectId: selectedProjectId === 'all' ? undefined : selectedProjectId
        }).then(r => r.data.data),
    })

    const { data: balanceData } = useQuery({
        queryKey: ['leave-balance', user?.id],
        queryFn: () => leaveAPI.getBalance(user.id).then(r => r.data.data),
        enabled: !!user?.id && !isAdmin,
    })

    const { data: announcements } = useQuery({
        queryKey: ['announcements', 'active'],
        queryFn: () => announcementAPI.getAll({ limit: 5 }).then(r => r.data.data),
    })

    const { data: recentTimesheets } = useQuery({
        queryKey: ['timesheets', 'recent'],
        queryFn: () => timesheetAPI.getAll({ limit: 5 }).then(r => r.data.data),
    })

    // Admin-only KPI data
    const { data: kpiData, isLoading: kpiLoading } = useQuery({
        queryKey: ['timesheet-kpi', kpiView],
        queryFn: () => timesheetAPI.getAdminKpi(kpiView).then(r => r.data.data),
        enabled: isAdmin,
    })

    if (summaryLoading) return (
        <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>
    )

    const roleLabel = isAdmin ? 'Admin' : isManager ? 'Manager' : 'Employee'

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in pb-12">
            <PageHeader title="Overview">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Project</span>
                            <div className="relative group/sel">
                                <select
                                    className="appearance-none bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl pl-4 pr-10 py-1.5 text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none w-44 shadow-sm"
                                    value={selectedProjectId}
                                    onChange={(e) => setSelectedProjectId(e.target.value)}
                                >
                                    <option value="all">All Projects</option>
                                    {projects?.map(p => (
                                        <option key={p._id} value={p._id}>{p.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover/sel:text-primary-500 transition-colors" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Period</span>
                            <div className="relative group/sel">
                                <select
                                    className="appearance-none bg-white dark:bg-black border border-slate-200 dark:border-white/10 rounded-xl pl-4 pr-10 py-1.5 text-xs font-bold text-slate-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none w-52 shadow-sm"
                                    value={weekStartDate}
                                    onChange={(e) => setWeekStartDate(e.target.value)}
                                >
                                    <option value="all">All Time</option>
                                    {[...Array(12)].map((_, i) => {
                                        const start = startOfWeek(subWeeks(new Date(), i), { weekStartsOn })
                                        const end = endOfWeek(start, { weekStartsOn })
                                        return (
                                            <option key={i} value={format(start, 'yyyy-MM-dd')}>
                                                {format(start, 'MMM d')} - {format(end, 'MMM d')} (W{getWeek(start)})
                                            </option>
                                        )
                                    })}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover/sel:text-primary-500 transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>
            </PageHeader>

            <div className="flex flex-col gap-1 ml-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {format(new Date(), 'EEEE, MMMM do yyyy')} · Welcome back, <span className="text-primary-600 dark:text-primary-400 font-bold">{user?.name?.split(' ')[0]}</span>
                </p>
                <div className="h-0.5 w-16 bg-primary-500/20 rounded-full" />
            </div>


            {/* ── Main Dashboard Layout ──────────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                {/* Left Column (8 units) */}
                <div className="xl:col-span-8 space-y-8">

                    {/* 1. Stat Grid */}
                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
                        <StatCard
                            title={isAdmin ? 'Submitted' : 'This Week'}
                            value={isAdmin ? (summaryData?.submittedCount ?? 0) : (summaryData?.hoursThisWeek ?? 0)}
                            icon={isAdmin ? CheckCircle : Clock}
                            color={isAdmin ? 'success' : 'primary'}
                            description={isAdmin ? 'Compliance' : 'Hours logged'}
                            onClick={() => isAdmin && setDetailsModal({ type: 'submitted', employees: summaryData?.submittedEmployees })}
                        />
                        <StatCard
                            title={isAdmin ? 'Not Submitted' : 'Awaiting Approval'}
                            value={isAdmin ? (summaryData?.notSubmittedCount ?? 0) : (summaryData?.pendingTimesheets ?? 0)}
                            icon={isAdmin ? XCircle : AlertCircle}
                            color={isAdmin ? 'danger' : 'warning'}
                            description={isAdmin ? 'Missing sheets' : 'Ready for review'}
                            onClick={() => isAdmin && setDetailsModal({ type: 'not-submitted', employees: summaryData?.notSubmittedEmployees })}
                        />
                        <StatCard
                            title={isAdmin ? 'Pending Approval' : 'Approved'}
                            value={isAdmin ? (summaryData?.pendingTimesheets ?? 0) : (summaryData?.approvedTimesheets ?? 0)}
                            icon={isAdmin ? AlertCircle : CheckCircle}
                            color={isAdmin ? 'warning' : 'success'}
                            description={isAdmin ? 'Review required' : 'Finalized'}
                            onClick={() => isAdmin && setDetailsModal({
                                type: 'submitted',
                                title: 'Compliance: Pending Approval',
                                employees: summaryData?.submittedEmployees?.filter(e => e.status === 'submitted')
                            })}
                        />
                        {isAdmin ? (
                            <>
                                <StatCard
                                    title="Approved"
                                    value={summaryData?.approvedTimesheets ?? 0}
                                    icon={CheckCircle}
                                    color="success"
                                    description="Finalized"
                                    onClick={() => setDetailsModal({
                                        type: 'submitted',
                                        title: 'Compliance: Approved',
                                        employees: summaryData?.submittedEmployees?.filter(e => e.status === 'approved')
                                    })}
                                />
                                <StatCard
                                    title="Rejected"
                                    value={summaryData?.rejectedTimesheets ?? 0}
                                    icon={XCircle}
                                    color="danger"
                                    description="Disapproved"
                                    onClick={() => setDetailsModal({
                                        type: 'submitted',
                                        title: 'Compliance: Rejected',
                                        employees: summaryData?.submittedEmployees?.filter(e => e.status === 'rejected')
                                    })}
                                />
                            </>
                        ) : (
                            <StatCard
                                title="Rejected"
                                value={summaryData?.rejectedTimesheets ?? 0}
                                icon={XCircle}
                                color="danger"
                                description="Action required"
                            />
                        )}
                    </div>

                    {isAdmin && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="Total Employees"
                                value={summaryData?.totalEmployees ?? 0}
                                icon={Users}
                                color="info"
                                description="Active staff"
                            />
                            <StatCard
                                title="Total Managers"
                                value={summaryData?.totalManagers ?? 0}
                                icon={UserCheck}
                                color="primary"
                                description="Active managers"
                            />
                            <StatCard
                                title="Total Admins"
                                value={summaryData?.totalAdmins ?? 0}
                                icon={ShieldCheck}
                                color="success"
                                description="System admins"
                            />
                        </div>
                    )}

                    {/* 2. Admin Extra Stats or Employee Dashboard */}
                    {isAdmin ? (
                        <div className="grid grid-cols-1 gap-4">
                            <div className="group p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl transition-all duration-300">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Top Active Projects</p>
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">{summaryData?.projectTotals?.length ?? 0}</h3>
                                    </div>
                                    <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                        <FolderOpen size={20} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {summaryData?.projectTotals?.slice(0, 3).map((p, i) => {
                                        const maxH = summaryData.projectTotals[0]?.totalHours || 1
                                        return (
                                            <div key={i} className="space-y-1">
                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                    <span>{p.projectName}</span>
                                                    <span>{formatHoursDisplay(p.totalHours)}</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-purple-400 to-primary-500 rounded-full" style={{ width: `${(p.totalHours / maxH) * 100}%` }} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-900 dark:to-primary-950 border-0 overflow-hidden relative">
                            {/* Decorative circles */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-400/10 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none" />

                            <div className="relative">
                                <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                                    <Activity size={18} className="text-primary-200" />
                                    Quick Summary
                                </h3>

                                {balanceData && (
                                    <div className="grid grid-cols-3 gap-6">
                                        {Object.entries(balanceData).map(([type, days]) => {
                                            const colors = {
                                                annual: 'bg-emerald-400/20 text-emerald-100 border-emerald-400/20',
                                                sick: 'bg-rose-400/20 text-rose-100 border-rose-400/20',
                                                casual: 'bg-amber-400/20 text-amber-100 border-amber-400/20'
                                            }
                                            return (
                                                <div key={type} className={`p-4 rounded-2xl border backdrop-blur-sm ${colors[type] || 'bg-white/10 text-white border-white/10'} text-center`}>
                                                    <p className="text-3xl font-black">{days}</p>
                                                    <p className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">{type} Leave</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. KPI / Recent activity block */}
                    <div className="card !p-0 overflow-hidden">
                        <div className="p-6 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
                                    {isAdmin ? <BarChart2 size={20} /> : <Timer size={20} />}
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 dark:text-white">{isAdmin ? 'Project ' : 'Recent Timesheets'}</h3>
                                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{isAdmin ? 'Live breakdown' : 'Journal'}</p>
                                </div>
                            </div>
                            {isAdmin && <KpiDropdown selected={kpiView} onChange={setKpiView} />}
                        </div>

                        <div className="p-6">
                            {isAdmin ? (
                                kpiLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
                                    <div className="animate-fade-in">
                                        {kpiView === 'project-hours' && <ProjectHoursKpi data={kpiData?.data} />}
                                        {kpiView === 'status-overview' && <StatusOverviewKpi data={kpiData?.data} />}
                                        {kpiView === 'employee-activity' && <EmployeeActivityKpi data={kpiData?.data} />}
                                    </div>
                                )
                            ) : (
                                !recentTimesheets?.length ? (
                                    <EmptyState message="You haven't submitted any timesheets yet" />
                                ) : (
                                    <div className="space-y-4">
                                        {recentTimesheets.map((ts) => (
                                            <div key={ts._id} className="group flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-all duration-300">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex flex-col items-center justify-center border border-slate-100 dark:border-white/10 shadow-sm group-hover:scale-105 transition-transform text-center">
                                                        <span className="text-[10px] font-bold text-slate-400 capitalize">{format(new Date(ts.weekStartDate), 'MMM')}</span>
                                                        <span className="text-lg font-black text-primary-600 dark:text-primary-400 leading-none">{format(new Date(ts.weekStartDate), 'd')}</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700 dark:text-white line-clamp-1">
                                                            Week of {format(new Date(ts.weekStartDate), 'MMMM d, yyyy')}
                                                        </p>
                                                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                                                            {ts.rows?.length || 0} entries · {formatHoursDisplay(ts.totalHours)} total
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right hidden sm:block">
                                                        <p className="text-sm font-black text-slate-800 dark:text-white">{formatHoursDisplay(ts.totalHours)}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Total</p>
                                                    </div>
                                                    <StatusBadge status={ts.status} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column (4 units) - Announcements & Context Info */}
                <div className="xl:col-span-4 space-y-8">

                    {/* 1. Announcements */}
                    <div className="card !p-0 overflow-hidden border-0 bg-slate-50 dark:bg-white/5 ring-1 ring-slate-200 dark:ring-white/10">
                        <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/10">
                            <h3 className="text-slate-800 dark:text-white font-black flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-rose-500 text-white shadow-lg shadow-rose-500/20 animate-pulse">
                                    <Megaphone size={16} />
                                </div>
                                Company Updates
                            </h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Latest company updates</p>
                        </div>

                        <div className="p-4 space-y-4">
                            {!announcements?.length ? (
                                <div className="py-12 flex flex-col items-center justify-center opacity-50">
                                    <Megaphone size={32} className="text-slate-300 mb-2" />
                                    <p className="text-sm font-bold text-slate-400">All quiet for now</p>
                                </div>
                            ) : (
                                announcements.slice(0, 5).map((ann) => {
                                    const typeConfig = {
                                        urgent: {
                                            icon: '🚨',
                                            bg: 'bg-rose-50 dark:bg-rose-950/40',
                                            text: 'text-rose-700 dark:text-rose-300',
                                            accent: 'bg-rose-500'
                                        },
                                        warning: {
                                            icon: '⚠️',
                                            bg: 'bg-amber-50 dark:bg-amber-950/40',
                                            text: 'text-amber-700 dark:text-amber-300',
                                            accent: 'bg-amber-500'
                                        },
                                        info: {
                                            icon: '💡',
                                            bg: 'bg-primary-50 dark:bg-primary-950/40',
                                            text: 'text-primary-700 dark:text-primary-300',
                                            accent: 'bg-primary-500'
                                        },
                                    }[ann.type] || { icon: '📢', bg: 'bg-slate-50', text: 'text-slate-600', accent: 'bg-slate-400' }

                                    return (
                                        <div key={ann._id} className="relative group p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-300">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                                                    {typeConfig.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="text-sm font-black text-slate-800 dark:text-white truncate pr-2">{ann.title}</h4>
                                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${typeConfig.bg} ${typeConfig.text}`}>
                                                            {ann.type}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-medium mb-2">
                                                        {ann.content}
                                                    </p>
                                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50 dark:border-white/5">
                                                        <span className="text-[10px] text-slate-400 font-bold">{format(new Date(ann.createdAt), 'MMM d, y')}</span>
                                                        <button className="text-[10px] font-black text-primary-500 uppercase tracking-widest hover:underline">Read More</button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            {announcements?.length > 0 && (
                                <button className="w-full py-3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 text-xs font-black text-slate-400 hover:text-primary-500 hover:border-primary-500/30 transition-all uppercase tracking-widest">
                                    View All News
                                </button>
                            )}
                        </div>
                    </div>



                </div>
            </div>

            {/* Details Modal for Admins */}
            <Modal
                isOpen={!!detailsModal}
                onClose={() => setDetailsModal(null)}
                title={detailsModal?.title || (detailsModal?.type === 'submitted' ? 'Timesheet Compliance: Submitted' : 'Timesheet Compliance: Not Submitted')}
                maxWidth="max-w-4xl"
            >
                <div className="space-y-4">
                    <div className="table-wrapper">
                        <table className="w-full">
                            <thead className="bg-slate-50 dark:bg-white/5">
                                <tr>
                                    <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Employee</th>
                                    <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Departments</th>
                                    {detailsModal?.type === 'submitted' && (
                                        <>
                                            <th className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Projects</th>
                                            <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Total Hours</th>
                                            <th className="py-3 px-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                                {detailsModal?.employees?.map(emp => (
                                    <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center font-bold text-xs">
                                                    {emp.name?.[0]}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 dark:text-white tracking-tight">{emp.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 tracking-widest">{emp.employeeId}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">
                                            {emp.department || '—'}
                                        </td>
                                        {detailsModal?.type === 'submitted' && (
                                            <>
                                                <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={emp.projects}>
                                                    {emp.projects || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <span className="font-black text-primary-600 dark:text-primary-400">{formatHoursDisplay(emp.totalHours)}</span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <StatusBadge status={emp.status} />
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {detailsModal?.employees?.length === 0 && (
                                    <tr>
                                        <td colSpan={detailsModal?.type === 'submitted' ? 5 : 2} className="py-8 text-center text-slate-400 font-bold">
                                            No employees found for the selected criteria.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
