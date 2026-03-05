import React, { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportAPI, projectAPI, userAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell,
    LineChart, Line, Area, AreaChart, Dot
} from 'recharts'
import {
    X, Eye, FileText, Calendar, Clock, Download, TrendingUp,
    Users, Briefcase, BarChart2, PieChart as PieIcon, Activity,
    Filter, RefreshCw, AlertCircle
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Palette ─────────────────────────────────────────────────────────────────
const PALETTE = [
    '#6366f1', '#22c55e', '#f59e0b', '#ef4444',
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f97316', '#06b6d4', '#a855f7', '#84cc16'
]

const STATUS_COLORS = {
    approved: '#22c55e',
    submitted: '#f59e0b',
    rejected: '#ef4444',
    draft: '#94a3b8',
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, suffix = 'h' }) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'white', border: '1px solid #e2e8f0',
            borderRadius: 12, padding: '10px 14px',
            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)',
            fontSize: 12, color: '#1e293b'
        }}>
            <p style={{ fontWeight: 700, marginBottom: 4, color: '#475569' }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{suffix}
                </p>
            ))}
        </div>
    )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, color, sub }) => (
    <div className="card flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0`}
            style={{ background: `${color}18` }}>
            <Icon size={22} style={{ color }} />
        </div>
        <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-800 dark:text-white leading-tight">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
    </div>
)

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, color = '#6366f1' }) => (
    <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
            <Icon size={14} style={{ color }} />
        </div>
        <h3 className="text-slate-700 dark:text-white font-semibold">{title}</h3>
    </div>
)

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyChart = ({ message = 'No data for selected period' }) => (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <AlertCircle size={32} className="mb-3 opacity-40" />
        <p className="text-sm">{message}</p>
    </div>
)

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const [range, setRange] = useState({ from: '', to: '' })
    const [selectedProjectId, setSelectedProjectId] = useState('all')
    const [selectedUserId, setSelectedUserId] = useState('all')
    const [selectedLeaveType, setSelectedLeaveType] = useState(null)
    const [detailParams, setDetailParams] = useState(null)
    const [pdfLoading, setPdfLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('overview') // overview | details

    const filterParams = {
        ...(range.from && { from: range.from }),
        ...(range.to && { to: range.to }),
        ...(selectedUserId !== 'all' && { userId: selectedUserId }),
        ...(selectedProjectId !== 'all' && { projectId: selectedProjectId }),
    }

    // ─── Data Queries ──────────────────────────────────────────────────────────
    const { data: projects } = useQuery({
        queryKey: ['projects-minimal'],
        queryFn: () => projectAPI.getAll({ limit: 100 }).then(r => r.data.data),
    })

    const { data: employees } = useQuery({
        queryKey: ['employees-minimal'],
        queryFn: () => userAPI.getAll({ limit: 200, role: 'employee' }).then(r => r.data.data),
    })

    const { data: tsData, isLoading: tsLoading } = useQuery({
        queryKey: ['reports', 'timesheet-summary', filterParams],
        queryFn: () => reportAPI.getTimesheetSummary(filterParams).then(r => r.data.data),
    })

    const { data: projData } = useQuery({
        queryKey: ['reports', 'project-utilization', range],
        queryFn: () => reportAPI.getProjectUtilization({ from: range.from, to: range.to }).then(r => r.data.data),
    })

    const { data: leaveData } = useQuery({
        queryKey: ['reports', 'leave-summary', range],
        queryFn: () => reportAPI.getLeaveSummary({ from: range.from, to: range.to }).then(r => r.data.data),
    })

    const { data: weeklyTrend } = useQuery({
        queryKey: ['reports', 'weekly-trend', filterParams],
        queryFn: () => reportAPI.getWeeklyTrend(filterParams).then(r => r.data.data),
    })

    const { data: deptData } = useQuery({
        queryKey: ['reports', 'department-summary', range],
        queryFn: () => reportAPI.getDepartmentSummary({ from: range.from, to: range.to }).then(r => r.data.data),
    })

    const { data: leaveDetails, isLoading: detailsLoading } = useQuery({
        queryKey: ['reports', 'leave-details', selectedLeaveType, range],
        queryFn: () => reportAPI.getLeaveDetails({ leaveType: selectedLeaveType, ...range }).then(r => r.data.data),
        enabled: !!selectedLeaveType,
    })

    const { data: taskDetails, isLoading: tasksLoading } = useQuery({
        queryKey: ['reports', 'timesheet-details', detailParams, range],
        queryFn: () => reportAPI.getTimesheetDetails({
            userId: detailParams.userId,
            projectId: detailParams.projectId,
            ...range
        }).then(r => r.data.data),
        enabled: !!detailParams,
    })

    // ─── Derived data ──────────────────────────────────────────────────────────
    const totalHours = tsData?.reduce((s, r) => s + (r.totalHours || 0), 0) || 0
    const uniqueEmployees = new Set(tsData?.map(r => r._id?.userId)).size || 0
    const uniqueProjects = (projData?.length) || 0

    const weeklyAvg = weeklyTrend?.length
        ? (weeklyTrend.reduce((s, w) => s + w.totalHours, 0) / weeklyTrend.length).toFixed(1)
        : 0

    // Bar chart: hours by project (top 10)
    const projectChartData = (projData || []).slice(0, 10).map(d => ({
        name: d.project?.name ?? 'Unknown',
        hours: +(d.totalHours || 0).toFixed(1),
        employees: d.employeeCount || 0,
    }))

    // Pie: leave by type
    const leaveChartData = (leaveData || []).reduce((acc, d) => {
        const existing = acc.find(a => a.name === d._id?.leaveType)
        if (existing) { existing.value += d.totalDays; return acc }
        acc.push({ name: d._id?.leaveType, value: d.totalDays })
        return acc
    }, [])

    // Pie: timesheet status overview  
    const statusData = (() => {
        const counts = {}
        tsData?.forEach(r => {
            // not useful here since summary is already approved, show project distribution instead
        })
        return []
    })()

    // Line: weekly trend
    const trendChartData = (weeklyTrend || []).map(w => ({
        week: format(new Date(w.week), 'MMM d'),
        'Total Hours': +(w.totalHours || 0).toFixed(1),
        Employees: w.employeeCount || 0,
        'Avg/Person': w.employeeCount ? +((w.totalHours || 0) / w.employeeCount).toFixed(1) : 0,
    }))

    // Bar: top employees
    const topEmployees = (tsData || [])
        .reduce((acc, row) => {
            const uid = row._id?.userId
            const existing = acc.find(a => a._id === uid?.toString())
            if (existing) { existing.hours += (row.totalHours || 0); return acc }
            acc.push({
                _id: uid?.toString(), name: row.user?.name || 'Unknown',
                dept: row.user?.department || '—', hours: row.totalHours || 0
            })
            return acc
        }, [])
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10)
        .map(e => ({ name: e.name.split(' ')[0], fullName: e.name, dept: e.dept, hours: +e.hours.toFixed(1) }))

    // Stacked bar: dept summary
    const deptChartData = (deptData || []).map(d => ({
        name: d.department || 'Unassigned',
        hours: +(d.totalHours || 0).toFixed(1),
    }))

    // ─── PDF Export ────────────────────────────────────────────────────────────
    const handleExportPDF = useCallback(async () => {
        setPdfLoading(true)
        try {
            const params = {
                ...(range.from && { from: range.from }),
                ...(range.to && { to: range.to }),
                ...(selectedUserId !== 'all' && { userId: selectedUserId }),
            }
            const response = await reportAPI.exportPDF(params)
            const blob = new Blob([response.data], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `timesheet-report-${new Date().toISOString().split('T')[0]}.pdf`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success('PDF report downloaded!')
        } catch (err) {
            console.error(err)
            toast.error('Failed to generate PDF')
        } finally {
            setPdfLoading(false)
        }
    }, [range, selectedUserId])

    const resetFilters = () => {
        setRange({ from: '', to: '' })
        setSelectedProjectId('all')
        setSelectedUserId('all')
    }

    // ─── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <PageHeader title="Reports & Analytics">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportPDF}
                        disabled={pdfLoading}
                        className="btn btn-primary gap-2"
                        id="pdf-export-btn"
                    >
                        {pdfLoading
                            ? <><RefreshCw size={15} className="animate-spin" />Generating...</>
                            : <><Download size={15} />Export PDF</>
                        }
                    </button>
                </div>
            </PageHeader>

            {/* ── Filters ── */}
            <div className="card py-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm font-medium">
                        <Filter size={14} />
                        Filters:
                    </div>
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-slate-500 dark:text-slate-400">From</label>
                        <input id="filter-from" type="date" max="9999-12-31" className="input py-1.5 text-sm w-36"
                            value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <label className="text-xs text-slate-500 dark:text-slate-400">To</label>
                        <input id="filter-to" type="date" max="9999-12-31" className="input py-1.5 text-sm w-36"
                            value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
                    </div>
                    <select id="filter-employee" className="input py-1.5 text-sm w-44"
                        value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                        <option value="all">All Employees</option>
                        {employees?.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                    </select>
                    <select id="filter-project" className="input py-1.5 text-sm w-44"
                        value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                        <option value="all">All Projects</option>
                        {projects?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                    {(range.from || range.to || selectedUserId !== 'all' || selectedProjectId !== 'all') && (
                        <button onClick={resetFilters} className="btn btn-ghost btn-sm gap-1 text-slate-500">
                            <X size={13} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard icon={Clock} label="Total Approved Hours" value={`${totalHours.toFixed(1)}h`}
                    color="#6366f1" sub="From approved timesheets" />
                <KpiCard icon={Users} label="Active Employees" value={uniqueEmployees}
                    color="#22c55e" sub="With approved hours" />
                <KpiCard icon={Briefcase} label="Projects Tracked" value={uniqueProjects}
                    color="#f59e0b" sub="All active projects" />
                <KpiCard icon={TrendingUp} label="Avg Hours / Week" value={`${weeklyAvg}h`}
                    color="#8b5cf6" sub="Across selected period" />
            </div>

            {tsLoading ? (
                <div className="flex justify-center pt-12"><Spinner size="lg" /></div>
            ) : (
                <>
                    {/* ── Chart Grid ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* 1. Hours by Project — Horizontal Bar */}
                        <div className="card">
                            <SectionHeader icon={BarChart2} title="Hours by Project (Top 10)" color="#6366f1" />
                            {projectChartData.length ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={projectChartData} layout="vertical"
                                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="hours" name="Hours" radius={[0, 6, 6, 0]}>
                                            {projectChartData.map((_, i) => (
                                                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart />}
                        </div>

                        {/* 2. Leave by Type — Donut Pie */}
                        <div className="card">
                            <SectionHeader icon={PieIcon} title="Leave Distribution by Type" color="#f59e0b" />
                            {leaveChartData.length ? (
                                <div>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <PieChart>
                                            <Pie
                                                data={leaveChartData}
                                                cx="50%" cy="50%"
                                                innerRadius={60} outerRadius={100}
                                                dataKey="value"
                                                paddingAngle={3}
                                                onClick={d => setSelectedLeaveType(d.name)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {leaveChartData.map((_, i) => (
                                                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                formatter={(val) => [`${val} days`]}
                                                contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.15)' }}
                                            />
                                            <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <p className="text-[10px] text-slate-400 text-center">Click a segment to drill down</p>
                                </div>
                            ) : <EmptyChart message="No leave data for selected period" />}
                        </div>

                        {/* 3. Weekly Hours Trend — Area/Line */}
                        <div className="card lg:col-span-2">
                            <SectionHeader icon={TrendingUp} title="Weekly Hours Trend" color="#22c55e" />
                            {trendChartData.length ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <AreaChart data={trendChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                                        <Area type="monotone" dataKey="Total Hours" stroke="#6366f1" strokeWidth={2.5}
                                            fill="url(#gradTotal)" dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                                        <Area type="monotone" dataKey="Avg/Person" stroke="#22c55e" strokeWidth={2}
                                            fill="url(#gradAvg)" dot={{ r: 3, fill: '#22c55e' }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart message="No weekly trend data for selected period" />}
                        </div>

                        {/* 4. Hours by Department — Bar */}
                        <div className="card">
                            <SectionHeader icon={BarChart2} title="Hours by Department" color="#8b5cf6" />
                            {deptChartData.length ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={deptChartData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={55} />
                                        <YAxis tick={{ fontSize: 10 }} unit="h" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="hours" name="Hours" radius={[6, 6, 0, 0]}>
                                            {deptChartData.map((_, i) => (
                                                <Cell key={i} fill={PALETTE[(i + 4) % PALETTE.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart message="No department data available" />}
                        </div>

                        {/* 5. Top Employees — Bar */}
                        <div className="card">
                            <SectionHeader icon={Users} title="Top 10 Employees by Hours" color="#ef4444" />
                            {topEmployees.length ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={topEmployees} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={55} />
                                        <YAxis tick={{ fontSize: 10 }} unit="h" />
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (!active || !payload?.length) return null
                                                const d = payload[0]?.payload
                                                return (
                                                    <div style={{
                                                        background: 'white', border: '1px solid #e2e8f0',
                                                        borderRadius: 12, padding: '10px 14px',
                                                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)', fontSize: 12
                                                    }}>
                                                        <p style={{ fontWeight: 700, color: '#475569', marginBottom: 4 }}>{d?.fullName}</p>
                                                        <p style={{ color: '#6366f1', fontWeight: 600 }}>Hours: {d?.hours}h</p>
                                                        <p style={{ color: '#94a3b8', fontSize: 11 }}>Dept: {d?.dept}</p>
                                                    </div>
                                                )
                                            }}
                                        />
                                        <Bar dataKey="hours" name="Hours" radius={[6, 6, 0, 0]}>
                                            {topEmployees.map((_, i) => (
                                                <Cell key={i} fill={PALETTE[(i + 2) % PALETTE.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyChart message="No employee hours data" />}
                        </div>

                    </div>

                    {/* ── Leave Drill-down ── */}
                    {selectedLeaveType && (
                        <div className="card border-2 border-amber-100 dark:border-amber-900/30 animate-slide-in">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-amber-400 rounded-full" />
                                    <h3 className="text-slate-700 dark:text-white">
                                        Leave Details — <span className="text-amber-500 capitalize">{selectedLeaveType}</span>
                                    </h3>
                                </div>
                                <button onClick={() => setSelectedLeaveType(null)}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                                    <X size={18} className="text-slate-400" />
                                </button>
                            </div>
                            {detailsLoading ? <div className="py-10 flex justify-center"><Spinner /></div> : (
                                <div className="table-wrapper">
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                <th className="text-left py-3 px-4">Employee</th>
                                                <th className="text-left py-3 px-4">Department</th>
                                                <th className="text-left py-3 px-4">Role</th>
                                                <th className="text-right py-3 px-4">Requests</th>
                                                <th className="text-right py-3 px-4">Total Days</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {leaveDetails?.map((row, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                                                    <td className="py-3 px-4 font-medium">
                                                        {row.user?.name}
                                                        <span className="text-xs text-slate-400 ml-1.5">#{row.user?.employeeId}</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-500">{row.user?.department || '—'}</td>
                                                    <td className="py-3 px-4 capitalize text-slate-500">{row.user?.role}</td>
                                                    <td className="py-3 px-4 text-right text-slate-700">{row.leaveCount}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-amber-600">{row.totalDays}d</td>
                                                </tr>
                                            ))}
                                            {!leaveDetails?.length && (
                                                <tr><td colSpan={5} className="text-center py-8 text-slate-400">No approved leave found</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Timesheet Summary Table ── */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-4">
                            <SectionHeader icon={FileText} title="Employee Hours Summary" color="#6366f1" />
                        </div>
                        <div className="table-wrapper">
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left py-3 px-4">Employee</th>
                                        <th className="text-left py-3 px-4">Department</th>
                                        <th className="text-left py-3 px-4">Project</th>
                                        <th className="text-right py-3 px-4">Total Hours</th>
                                        <th className="text-right py-3 px-4">Timesheets</th>
                                        <th className="text-right py-3 px-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    {tsData?.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-slate-800 dark:text-white">{row.user?.name ?? '—'}</p>
                                                <p className="text-xs text-slate-400">#{row.user?.employeeId}</p>
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-sm">
                                                {row.user?.department || '—'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                                    {row.project?.name ?? '—'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-indigo-600">
                                                {row.totalHours?.toFixed(1)}h
                                            </td>
                                            <td className="py-3 px-4 text-right text-slate-500">{row.timesheetCount}</td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    onClick={() => setDetailParams({
                                                        userId: row._id?.userId,
                                                        projectId: row._id?.projectId,
                                                        userName: row.user?.name,
                                                        projectName: row.project?.name,
                                                    })}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition-colors"
                                                >
                                                    <Eye size={13} />Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!tsData?.length && (
                                        <tr><td colSpan={6} className="text-center text-slate-400 py-10">
                                            No approved hours found for selected period
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ── Timesheet Detail Modal ── */}
            <Modal
                isOpen={!!detailParams}
                onClose={() => setDetailParams(null)}
                title={`Task Breakdown — ${detailParams?.userName ?? ''}`}
            >
                <div className="space-y-5">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center">
                                <FileText size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                    {detailParams?.projectName || 'All Projects'}
                                </p>
                                <p className="text-xs text-slate-400">Approved task breakdown</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-400">Total</p>
                            <p className="text-xl font-bold text-indigo-600">
                                {taskDetails?.reduce((s, t) => s + t.hoursWorked, 0).toFixed(1)}h
                            </p>
                        </div>
                    </div>

                    {tasksLoading ? <div className="py-12 flex justify-center"><Spinner /></div> : (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                            {taskDetails?.map((task, idx) => (
                                <div key={idx} className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 flex gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center text-slate-400 shadow-sm flex-shrink-0">
                                        <Calendar size={13} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                {task.date ? format(new Date(task.date), 'EEE, MMM d, yyyy') : 'Unknown Date'}
                                            </p>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-[10px] font-bold">
                                                <Clock size={9} />{task.hoursWorked}h
                                            </div>
                                        </div>
                                        {task.taskDescription && (
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{task.taskDescription}</p>
                                        )}
                                        <p className="text-[10px] text-slate-400 mt-0.5">Category: {task.category}</p>
                                    </div>
                                </div>
                            ))}
                            {!taskDetails?.length && (
                                <p className="text-center text-slate-400 py-10 text-sm">No task records found.</p>
                            )}
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    )
}
