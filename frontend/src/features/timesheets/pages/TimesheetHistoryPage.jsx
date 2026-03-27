import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timesheetAPI, userAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
    Filter,
    Download,
    Eye,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    XCircle,
    Calendar,
    AlertTriangle,
    Search,
    Lock,
} from 'lucide-react'
import { clsx } from 'clsx'
import TimesheetDetailsModal from '../components/TimesheetDetailsModal'
import CreateIncidentModal from '@/components/incidents/CreateIncidentModal'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'

const YEARS = ['All Years', '2026', '2025', '2024']
const MONTHS = [
    'All Months', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]
const STATUSES = ['All Status', 'draft', 'submitted', 'approved', 'rejected']


export default function TimesheetHistoryPage() {
    const { user, isPro } = useAuthStore()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'

    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [filters, setFilters] = useState({
        year: 'All Years',
        month: 'All Months',
        status: 'All Status',
        userId: user?.id
    })
    const [tempFilters, setTempFilters] = useState(filters)
    const [selectedWeek, setSelectedWeek] = useState(null)
    const [selectedUserId, setSelectedUserId] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false)
    const [incidentTimesheetId, setIncidentTimesheetId] = useState(null)
    const [search, setSearch] = useState('')



    const effectiveSearch = search.trim().length >= 2 ? search.trim() : ''

    const { data, isLoading } = useQuery({
        queryKey: ['timesheets', 'history', page, limit, filters, effectiveSearch],
        queryFn: () => timesheetAPI.getHistory({
            page,
            limit,
            ...filters,
            search: effectiveSearch
        }).then(r => r.data),
    })

    const { mutate: deleteTimesheet } = useMutation({
        mutationFn: (id) => timesheetAPI.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timesheets'] });
            toast.success('Draft deleted successfully');
        },
        onError: () => toast.error('Failed to delete draft'),
    })

    const handleFilterChange = (key, value) => {
        setTempFilters(prev => ({ ...prev, [key]: value }))
    }

    const clearFilters = () => {
        const reset = {
            year: 'All Years',
            month: 'All Months',
            status: 'All Status',
            userId: user?.id
        }
        setTempFilters(reset)
        setFilters(reset)
        setSearch('')
        setPage(1)
    }

    const handleViewDetails = (weekStartDate, userId) => {
        setSelectedWeek(weekStartDate);
        setSelectedUserId(userId);
        setIsModalOpen(true);
    };

    const formatHours = (hours) => {
        return (Number(hours) || 0).toFixed(2)
    }

    const resolveStatus = (statuses) => {
        if (statuses.includes('rejected')) return 'rejected'
        if (statuses.includes('submitted')) return 'submitted'
        if (statuses.includes('approved')) return 'approved'
        return 'draft'
    }

    const handleExportCSV = async () => {
        try {
            // Fetch more results for export (up to 100, capped by backend MAX_LIMIT)
            const exportData = await timesheetAPI.getHistory({
                ...filters,
                limit: 100,
                page: 1
            }).then(r => r.data.data)

            if (!exportData || exportData.length === 0) {
                toast.error('No data to export')
                return
            }

            const headers = ['Employee ID', 'Name', 'Week Start', 'Week End', 'Project Code', 'Project Name', 'Category', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Project Total', 'Week Total', 'Status', 'Last Updated']
            const csvRows = []

            exportData.forEach(row => {
                const empId = row.userId?.employeeId || ''
                const empName = row.userId?.name || ''
                const weekStart = format(new Date(row.weekStartDate), 'yyyy-MM-dd')
                const weekEnd = format(new Date(row.weekEndDate), 'yyyy-MM-dd')
                const status = resolveStatus(row.statuses)
                const lastUpdated = format(new Date(row.lastUpdated), 'yyyy-MM-dd')

                // For each project row in the week
                row.rows.forEach(pRow => {
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
                        const dateObj = new Date(row.weekStartDate)
                        dateObj.setDate(dateObj.getDate() + i)
                        const dateStr = format(dateObj, 'yyyy-MM-dd')
                        daily.push(formatHours(daysMap[dateStr] || 0))
                    }

                    csvRows.push([
                        empId,
                        empName,
                        weekStart,
                        weekEnd,
                        pRow.projectCode || 'N/A',
                        pRow.projectName || 'Unknown',
                        pRow.category || 'N/A',
                        ...daily,
                        formatHours(pRow.totalHours || 0),
                        formatHours(row.totalHours || 0),
                        status,
                        lastUpdated
                    ])
                })
            })

            const csvContent = [headers, ...csvRows]
                .map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
                .join("\n")

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.setAttribute("href", url)
            link.setAttribute("download", `timesheet_history_${format(new Date(), 'yyyyMMdd')}.csv`)
            link.click()
            URL.revokeObjectURL(url)
            toast.success('Timesheet history exported!')
        } catch (error) {
            console.error('Export failed:', error)
            toast.error('Failed to export CSV')
        }
    }

    // Colors for dots
    const COLORS = ['bg-blue-500', 'bg-primary-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-slate-500']

    return (
        <div className="h-[calc(100vh-160px)] flex flex-col gap-4 animate-fade-in overflow-hidden">
            <PageHeader title="History" />
            {/* Filter Section */}
            <div className="card p-4 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-white font-semibold">
                        <Filter size={20} className="text-slate-400" />
                        <h2>Filter Timesheets</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={clearFilters}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Clear Filters
                        </button>
                        <button
                            onClick={() => {
                                setFilters(tempFilters)
                                setPage(1)
                            }}
                            className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
                        >
                            <Filter size={16} /> Apply Filters
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-3 h-9 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-semibold transition-all active:scale-95"
                        >
                            <Download size={15} /> Export CSV
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="input pl-9 h-9 text-sm w-full"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Year</label>
                        <select
                            value={tempFilters.year}
                            onChange={(e) => handleFilterChange('year', e.target.value)}
                            className="input h-9 text-sm w-full"
                        >
                            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Month</label>
                        <select
                            value={tempFilters.month}
                            onChange={(e) => handleFilterChange('month', e.target.value)}
                            className="input h-9 text-sm w-full"
                        >
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</label>
                        <select
                            value={tempFilters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                            className="input h-9 text-sm w-full capitalize"
                        >
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="card p-0 flex flex-col overflow-hidden min-h-0">
                <div className="table-wrapper lg:max-h-[calc(100vh-480px)] overflow-y-auto rounded-none border-0 shadow-none text-sm flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-white dark:bg-black border-b border-slate-100 dark:border-white/10">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Week</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Projects</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Project Code</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Total Hours</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Last Updated</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-12"><Spinner className="mx-auto" /></td>
                                </tr>
                            ) : data?.data?.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-20 text-center">
                                        <XCircle size={40} className="mx-auto text-slate-300 mb-3" />
                                        <p className="text-slate-500 font-medium">No results found for current filters</p>
                                        <button onClick={clearFilters} className="mt-2 text-primary font-semibold text-sm">Reset all filters</button>
                                    </td>
                                </tr>
                            ) : (
                                data.data.map((row) => (
                                    <tr key={row._id} className="hover:bg-slate-50/50 dark:hover:bg-white dark:hover:text-black transition-colors group">
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 dark:bg-black rounded-lg text-slate-400">
                                                    <Calendar size={18} />
                                                </div>
                                                <div className="font-semibold text-slate-700 dark:text-white">
                                                    {format(new Date(row.weekStartDate), 'MMM d')} - {format(new Date(new Date(row.weekStartDate).getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM d, yyyy')}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="space-y-1.5">
                                                {row.projects.map((p, i) => (
                                                    <div key={p} className="flex items-center gap-2 text-slate-600 dark:text-white">
                                                        <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                                                        <span>{p}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="space-y-2">
                                                {row.projectCodes.map((c, i) => (
                                                    <div key={c} className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${COLORS[i % COLORS.length]}`} />
                                                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-black rounded text-[10px] font-bold text-slate-500 uppercase border border-slate-200 dark:border-white">{c || 'N/A'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <span className="text-sm font-bold text-slate-700 dark:text-white bg-slate-50 dark:bg-black border border-slate-100 dark:border-white px-3 py-1 rounded-lg">
                                                {formatHours(row.totalHours)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <StatusBadge status={resolveStatus(row.statuses)} />
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="text-sm text-slate-500 dark:text-white">
                                                {format(new Date(row.lastUpdated), 'MMM d, yyyy')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleViewDetails(row.weekStartDate, row.userId?._id || row.userId)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-indigo-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-all active:scale-95"
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                {resolveStatus(row.statuses) === 'draft' && (
                                                    <>
                                                        <button
                                                            onClick={() => navigate(`/timesheets?id=${row._id}&date=${format(new Date(row.weekStartDate), 'yyyy-MM-dd')}`)}
                                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-all active:scale-95"
                                                            title="Edit Draft"
                                                        >
                                                            <Pencil size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('Are you sure you want to delete this draft?')) {
                                                                    deleteTimesheet(row._id)
                                                                }
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-all active:scale-95"
                                                            title="Delete Draft"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (!isPro()) {
                                                            toast.error('Reporting issues via incidents is an Enterprise Pro feature.', {
                                                                icon: '🔒',
                                                                style: { borderRadius: '12px', background: '#1e293b', color: '#fff' }
                                                            });
                                                            return;
                                                        }
                                                        setIncidentTimesheetId(row._id);
                                                        setIsIncidentModalOpen(true);
                                                    }}
                                                    className={clsx(
                                                        "p-2 rounded-lg transition-all active:scale-95",
                                                        !isPro()
                                                            ? "text-slate-300 cursor-not-allowed grayscale"
                                                            : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-white dark:hover:text-black"
                                                    )}
                                                    title={!isPro() ? "Unlock Pro to Report Issues" : "Report Issue"}
                                                >
                                                    {!isPro() ? <Lock size={16} /> : <AlertTriangle size={18} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!isLoading && data?.data?.length > 0 && (
                    <Pagination
                        currentPage={data.pagination.page}
                        totalPages={data.pagination.totalPages}
                        totalResults={data.pagination.total}
                        limit={limit}
                        onPageChange={setPage}
                        onLimitChange={(l) => { setLimit(l); setPage(1); }}
                    />
                )}
            </div>

            <TimesheetDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                weekStartDate={selectedWeek}
                userId={selectedUserId}
            />

            <CreateIncidentModal
                isOpen={isIncidentModalOpen}
                onClose={() => {
                    setIsIncidentModalOpen(false);
                    setIncidentTimesheetId(null);
                }}
                relatedTimesheetId={incidentTimesheetId}
                onSuccess={() => { /* maybe refresh list or just notify user */ }}
            />
        </div >
    )
}
