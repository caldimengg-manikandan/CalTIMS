import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timesheetAPI, projectAPI, userAPI } from '@/services/endpoints'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import { format, getISOWeek } from 'date-fns'
import {
    Users, Clock, CheckCircle2, XCircle, Calendar,
    Briefcase, Download, Eye, FileText, ChevronDown,
    Search, ChevronLeft, ChevronRight, SlidersHorizontal,
    X, RotateCcw, AlertCircle, Send, Save
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import TimesheetDetailsModal from '../components/TimesheetDetailsModal'
import Pagination from '@/components/ui/Pagination'

/* ─── Shared Modal Shell ─────────────────────────────────────── */
function Modal({ open, onClose, maxWidth = 'max-w-md', children }) {
    if (!open) return null
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className={`w-full ${maxWidth} bg-white dark:bg-black dark:border border-[#333333] midnight:border-[#1a1a1a] rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
                style={{ maxHeight: '90vh' }}>
                {children}
            </div>
        </div>
    )
}

/* ─── Reject Modal ───────────────────────────────────────────── */
function RejectModal({ ts, onReject, onClose }) {
    const [reason, setReason] = React.useState('')
    const projects = ts.rows?.map(r => r.projectId?.name).filter(Boolean).join(', ') || '—'
    return (
        <Modal open onClose={onClose} maxWidth="max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#333333] midnight:border-[#1a1a1a] shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <XCircle size={20} className="text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Reject Timesheet</h2>
                        <p className="text-xs text-slate-400">{ts.userId?.name || 'Employee'}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-[#111111] midnight:hover:bg-[#0a0a0a] transition-colors">
                    <X size={18} />
                </button>
            </div>
            <div className="px-6 py-5 space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-[#0a0a0a] midnight:bg-[#050505] rounded-xl text-sm">
                    <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Projects</span>
                    <span className="text-slate-700 dark:text-white font-medium">{projects}</span>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Reason for rejection *</label>
                    <textarea
                        className="input resize-none"
                        rows={3}
                        placeholder="Explain why the timesheet is being rejected…"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#333333] midnight:border-[#1a1a1a] bg-slate-50 dark:bg-[#0a0a0a] midnight:bg-[#050505]">
                <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button
                    onClick={() => {
                        if (!reason.trim()) return toast.error('Please provide a reason')
                        onReject(reason)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                >
                    <XCircle size={15} /> Reject
                </button>
            </div>
        </Modal>
    )
}

/* ─── Helpers ────────────────────────────────────────────────── */
const formatDuration = (totalHours) => {
    return (Number(totalHours) || 0).toFixed(2)
}

const formatWeek = (weekStartDate) => {
    try {
        if (!weekStartDate) return '—'
        let d = new Date(weekStartDate)
        // Correct for UTC midnights shifted by local TZ
        if (typeof weekStartDate === 'string' && weekStartDate.includes('T00:00:00')) {
            const [y, m, day] = weekStartDate.split('T')[0].split('-').map(Number)
            d = new Date(y, m - 1, day)
        }
        return `${format(d, 'yyyy')}-W${String(getISOWeek(d)).padStart(2, '0')}`
    } catch { return '—' }
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function AdminTimesheetPage() {
    const queryClient = useQueryClient()

    const [showFilters, setShowFilters] = React.useState(false)
    const [search, setSearch] = React.useState('')
    const [viewingTs, setViewingTs] = React.useState(null)
    const [rejectTarget, setRejectTarget] = React.useState(null)

    const [filters, setFilters] = React.useState({
        employeeId: '',
        userId: '',
        status: '',
        projectId: '',
        year: '',
        week: '',
        page: 1,
        limit: 10
    })
    const [tempFilters, setTempFilters] = React.useState(filters)

    /* ── Queries ── */
    const { data: stats } = useQuery({
        queryKey: ['timesheets', 'admin-stats'],
        queryFn: () => timesheetAPI.getAdminSummary().then(r => r.data.data)
    })

    const effectiveSearch = search.trim().length >= 2 ? search.trim() : ''

    const { data: listData, isLoading, isError } = useQuery({
        queryKey: ['timesheets', 'admin-list', filters, effectiveSearch],
        queryFn: () => timesheetAPI.getAdminList({ ...filters, search: effectiveSearch }).then(r => r.data),
        retry: false
    })

    const { data: filterOptions } = useQuery({
        queryKey: ['timesheets', 'admin-filters'],
        queryFn: () => timesheetAPI.getAdminFilters().then(r => r.data.data)
    })

    const { data: projects = [] } = useQuery({
        queryKey: ['projects', 'all'],
        queryFn: () => projectAPI.getAll({ limit: 5000 }).then(r => r.data.data || [])
    })

    const { data: employees = [] } = useQuery({
        queryKey: ['employees', 'all'],
        queryFn: () => userAPI.getAll({ limit: 5000 }).then(r => r.data.data || [])
    })

    /* ── Mutations ── */
    const { mutate: approve } = useMutation({
        mutationFn: (id) => timesheetAPI.approve(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Timesheet approved!') },
        onError: () => toast.error('Failed to approve timesheet'),
    })

    const { mutate: reject } = useMutation({
        mutationFn: ({ id, reason }) => timesheetAPI.reject(id, reason),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Timesheet rejected'); setRejectTarget(null) },
        onError: () => toast.error('Failed to reject timesheet'),
    })
    const { mutate: submitOverride } = useMutation({
        mutationFn: (id) => timesheetAPI.submit(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); toast.success('Timesheet submitted!') },
        onError: () => toast.error('Failed to submit timesheet'),
    })

    const activeFilterCount = [filters.employeeId, filters.userId, filters.status, filters.projectId, filters.year, filters.week].filter(Boolean).length

    const resetFilters = () => setFilters({ employeeId: '', userId: '', status: '', projectId: '', year: '', week: '', page: 1, limit: 10 })

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > (listData?.pagination?.totalPages || 1)) return
        setFilters(f => ({ ...f, page: newPage }))
    }

    /* ── CSV Export ── */
    const handleExportCSV = async () => {
        try {
            // Fetch up to 5000 matching results for export (capped by backend MAX_LIMIT)
            const res = await timesheetAPI.getAdminList({ ...filters, search, limit: 5000, page: 1 })
            const rows = res.data.data || []

            if (!rows.length) { toast.error('No data to export'); return }

            const headers = ['Employee ID', 'Name', 'Week', 'Project Code', 'Project Name', 'Category', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Project Total', 'Week Total', 'Status', 'Submitted At']
            const data = []

            rows.forEach(ts => {
                const empId = ts.userId?.employeeId || ''
                const empName = ts.userId?.name || ''
                const weekStr = formatWeek(ts.weekStartDate)
                const status = ts.status || ''
                const submittedAt = ts.submittedAt ? format(new Date(ts.submittedAt), 'yyyy-MM-dd') : ''

                // For each project row in the week
                ts.rows?.forEach(pRow => {
                    const entries = pRow.entries || []
                    // Build daily hours map
                    const daysMap = {}
                    entries.forEach(e => {
                        const d = format(new Date(e.date), 'yyyy-MM-dd')
                        daysMap[d] = e.hoursWorked || 0
                    })

                    // Get values for Mon-Sun (weekStartDate to weekStartDate + 6)
                    const daily = []
                    for (let i = 0; i < 7; i++) {
                        const dateObj = new Date(ts.weekStartDate)
                        dateObj.setDate(dateObj.getDate() + i)
                        const dateStr = format(dateObj, 'yyyy-MM-dd')
                        daily.push(formatDuration(daysMap[dateStr] || 0))
                    }

                    data.push([
                        empId,
                        empName,
                        weekStr,
                        pRow.projectId?.code || 'N/A',
                        pRow.projectId?.name || 'Unknown',
                        pRow.category || 'N/A',
                        ...daily,
                        formatDuration(pRow.totalHours || 0),
                        formatDuration(ts.totalHours || 0),
                        status,
                        submittedAt
                    ])
                })
            })
            const csv = [headers, ...data].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
            const blob = new Blob([csv], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `timesheets_export_${format(new Date(), 'yyyyMMdd')}.csv`; a.click()
            URL.revokeObjectURL(url)
            toast.success('All matching records exported!')
        } catch (error) {
            console.error('Export failed:', error)
            toast.error('Failed to export CSV')
        }
    }

    return (
        <div className="h-[calc(100vh-160px)] flex flex-col gap-4 animate-fade-in overflow-hidden">
            <PageHeader title="Manage Timesheets" subtitle="Review and approve submitted employee timesheets" />

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[
                    { title: 'Total', value: stats?.totalTimesheets || 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { title: 'Pending', value: stats?.pendingReview || 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    { title: 'Approved', value: stats?.approved || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { title: 'Rejected', value: stats?.rejected || 0, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
                    { title: 'Users', value: stats?.totalEmployees || 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
                    { title: 'Hours', value: formatDuration(stats?.totalHours || 0) + 'h', icon: Clock, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-900/20' },
                ].map((st) => (
                    <div key={st.title} className="card p-4 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${st.bg} ${st.color} shrink-0`}><st.icon size={18} /></div>
                        <div>
                            <p className="text-lg font-bold text-slate-800 dark:text-white leading-none mb-0.5">{st.value}</p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{st.title}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="card p-3">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search overall (min. 2 characters)..."
                            className="input pl-9 h-9 text-sm w-full"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setFilters(f => ({ ...f, page: 1 })) }}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Filter Button */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (!showFilters) setTempFilters(filters)
                                    setShowFilters(p => !p)
                                }}
                                className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0
                                    ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-slate-200 dark:border-[#333333] midnight:border-[#1a1a1a] text-slate-600 dark:text-[#e2e2e9] midnight:text-[#a0a0a5] hover:bg-slate-50 dark:hover:bg-[#111111] midnight:hover:bg-[#0a0a0a]'}`}
                            >
                                <SlidersHorizontal size={15} />
                                Filters
                                {activeFilterCount > 0 && (
                                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-[10px] font-bold">
                                        {activeFilterCount}
                                    </span>
                                )}
                                <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Quick Clear */}
                            {activeFilterCount > 0 && !showFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="px-2 h-9 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                                    title="Clear all filters"
                                >
                                    <X size={14} /> Clear
                                </button>
                            )}

                            {/* Filter Dropdown */}
                            {showFilters && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowFilters(false)} />
                                    <div className="absolute right-0 top-11 z-30 w-80 bg-white dark:bg-black border border-slate-200 dark:border-[#333333] midnight:border-[#1a1a1a] rounded-2xl shadow-2xl p-5 space-y-5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Filter By</span>
                                            {activeFilterCount > 0 && (
                                                <button onClick={() => {
                                                    const reset = { ...filters, employeeId: '', userId: '', status: '', projectId: '', year: '', week: '', page: 1 }
                                                    setTempFilters(reset)
                                                    setFilters(reset)
                                                }}
                                                    className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider">
                                                    Reset All
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {/* Employee ID */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Employee ID</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                    value={tempFilters.userId}
                                                    onChange={e => setTempFilters(f => ({ ...f, userId: e.target.value }))}
                                                >
                                                    <option value="">All Employees</option>
                                                    {employees?.map(emp => (
                                                        <option key={emp._id} value={emp._id}>
                                                            {emp.employeeId} — {emp.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Project */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Project</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                    value={tempFilters.projectId}
                                                    onChange={e => setTempFilters(f => ({ ...f, projectId: e.target.value }))}
                                                >
                                                    <option value="">All Projects</option>
                                                    {projects?.map(p => (
                                                        <option key={p._id} value={p._id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Status + Year (2-col) */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
                                                    <select
                                                        className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                        value={tempFilters.status}
                                                        onChange={e => setTempFilters(f => ({ ...f, status: e.target.value }))}
                                                    >
                                                        <option value="">All Status</option>
                                                        <option value="submitted">Pending</option>
                                                        <option value="approved">Approved</option>
                                                        <option value="rejected">Rejected</option>
                                                    </select>
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Year</label>
                                                    <select
                                                        className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                        value={tempFilters.year}
                                                        onChange={e => setTempFilters(f => ({ ...f, year: e.target.value }))}
                                                    >
                                                        <option value="">All Years</option>
                                                        {filterOptions?.years?.map(y => (
                                                            <option key={y} value={y}>{y}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Week */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Week</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                    value={tempFilters.week}
                                                    onChange={e => setTempFilters(f => ({ ...f, week: e.target.value }))}
                                                >
                                                    <option value="">All Weeks</option>
                                                    {filterOptions?.weeks?.map(w => (
                                                        <option key={w} value={w}>{formatWeek(w)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => setTempFilters({ ...filters, employeeId: '', userId: '', status: '', projectId: '', year: '', week: '', page: 1 })}
                                                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-[#111111] midnight:bg-[#0a0a0a] dark:text-[#e2e2e9] text-slate-600 midnight:text-[#a0a0a5] rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setFilters({ ...tempFilters, page: 1 })
                                                    setShowFilters(false)
                                                }}
                                                className="flex-[2] h-11 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-[0.98]"
                                            >
                                                Apply Filters
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 h-9 rounded-lg border border-slate-200 dark:border-[#333333] midnight:border-[#1a1a1a] text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#111111] midnight:hover:bg-[#0a0a0a] transition-colors">
                            <Download size={15} /> Export CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card p-0 flex flex-col overflow-hidden min-h-0">
                {isLoading ? (
                    <div className="py-20 flex justify-center"><Spinner size="lg" /></div>
                ) : (
                    <div className="table-wrapper max-h-[800px] lg:max-h-[calc(100vh-450px)] overflow-y-auto rounded-none border-0 shadow-none">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-20 bg-white dark:bg-black border-b border-slate-100 dark:border-white/10">
                                <tr>
                                    <th>Employee</th>
                                    <th>Emp ID</th>
                                    <th>Week</th>
                                    <th>Projects</th>
                                    <th className="text-center">Hours</th>
                                    <th className="text-center">Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isError ? (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center">
                                            <AlertCircle size={32} className="mx-auto text-red-300 mb-2" />
                                            <p className="text-red-400 text-sm font-semibold">Failed to load timesheets</p>
                                            <button onClick={() => queryClient.invalidateQueries({ queryKey: ['timesheets', 'admin-list'] })}
                                                className="text-xs text-primary-600 hover:underline mt-1">Try again</button>
                                        </td>
                                    </tr>
                                ) : listData?.data?.length > 0 ? (
                                    listData.data.map((ts) => {
                                        const projectsText = ts.rows?.map(r => r.projectId?.name).filter(Boolean).join(', ') || '—'
                                        const userId = ts.userId?._id || ts.userId
                                        return (
                                            <tr key={ts._id}>
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                            {(ts.userId?.name || '?').charAt(0)}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-800 dark:text-white">{ts.userId?.name || '—'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <p className="text-xs text-slate-500 font-mono font-medium">{ts.userId?.employeeId || '—'}</p>
                                                </td>
                                                <td>
                                                    <p className="text-sm font-medium text-slate-600 dark:text-white">{formatWeek(ts.weekStartDate)}</p>
                                                    {ts.submittedAt && (
                                                        <p className="text-[10px] text-slate-400">
                                                            Submitted {format(new Date(ts.submittedAt), 'MMM d')}
                                                        </p>
                                                    )}
                                                </td>
                                                <td>
                                                    <p className="text-sm text-slate-600 dark:text-white max-w-[200px] truncate" title={projectsText}>
                                                        {projectsText}
                                                    </p>
                                                </td>
                                                <td className="text-center">
                                                    <span className="font-bold text-slate-800 dark:text-white font-mono text-sm">
                                                        {formatDuration(ts.totalHours)}h
                                                    </span>
                                                </td>
                                                <td className="text-center">
                                                    <StatusBadge status={ts.status === 'submitted' ? 'pending' : ts.status} />
                                                </td>
                                                <td className="text-right">
                                                    <div className="flex justify-end items-center gap-1">
                                                        {/* View */}
                                                        <button
                                                            onClick={() => setViewingTs({ weekStartDate: ts.weekStartDate, userId })}
                                                            title="View Details"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        {/* Reject / Approve */}
                                                        {ts.status === 'submitted' && (
                                                            <>
                                                                <button
                                                                    onClick={() => setRejectTarget(ts)}
                                                                    title="Reject"
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                                >
                                                                    <XCircle size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => approve(ts._id)}
                                                                    title="Approve"
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                                                >
                                                                    <CheckCircle2 size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="py-20 text-center">
                                            <Search size={40} className="mx-auto text-slate-200 mb-3" />
                                            <p className="text-slate-400 uppercase text-xs tracking-widest font-semibold">No timesheets found</p>
                                            {activeFilterCount > 0 && (
                                                <button onClick={resetFilters} className="mt-2 text-xs text-primary-600 hover:underline font-semibold">
                                                    Clear filters
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!isLoading && listData?.data?.length > 0 && (
                    <Pagination
                        currentPage={listData.pagination.page}
                        totalPages={listData.pagination.totalPages}
                        totalResults={listData.pagination.total}
                        limit={filters.limit}
                        onPageChange={(p) => setFilters(f => ({ ...f, page: p }))}
                        onLimitChange={(l) => setFilters(f => ({ ...f, limit: l, page: 1 }))}
                    />
                )}
            </div>

            {/* ══ Reject Modal ══ */}
            {rejectTarget && (
                <RejectModal
                    ts={rejectTarget}
                    onReject={(reason) => reject({ id: rejectTarget._id, reason })}
                    onClose={() => setRejectTarget(null)}
                />
            )}

            {/* ══ View Details Modal ══ */}
            {viewingTs && (
                <TimesheetDetailsModal
                    isOpen={!!viewingTs}
                    weekStartDate={viewingTs.weekStartDate}
                    userId={viewingTs.userId}
                    onClose={() => setViewingTs(null)}
                />
            )}
        </div>
    )
}
