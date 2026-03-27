import React, { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportAPI, projectAPI, userAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import ProGuard from '@/components/ui/ProGuard'
import Modal from '@/components/ui/Modal'
import PageHeader from '@/components/ui/PageHeader'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell,
    LineChart, Line, Area, AreaChart, Dot, ReferenceLine
} from 'recharts'
import {
    X, Eye, FileText, Calendar, Clock, Download, TrendingUp,
    Users, Briefcase, BarChart2, PieChart as PieIcon, Activity,
    Filter, RefreshCw, AlertCircle, CheckCircle2, Award, Zap, ShieldAlert,
    ChevronDown, FileSpreadsheet
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

// ─── Palette ─────────────────────────────────────────────────────────────────
const PALETTE = [
    '#6366f1', '#22c55e', '#f59e0b', '#ef4444',
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
    '#f97316', '#06b6d4', '#a855f7', '#84cc16'
]

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
                <p key={i} style={{ color: p.color || p.fill, fontWeight: 600 }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{suffix}
                </p>
            ))}
        </div>
    )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, color, sub, trend }) => (
    <div className="card p-5 flex items-center gap-4 border border-slate-100 dark:border-white/5 hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0`}
            style={{ background: `linear-gradient(135deg, ${color}22, ${color}11)`, color }}>
            <Icon size={26} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-semibold mb-1">{label}</p>
            <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">{value}</p>
                {trend && (
                    <span className={`text-xs font-bold ${trend > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            {sub && <p className="text-[11px] text-slate-400 mt-1.5 font-medium">{sub}</p>}
        </div>
    </div>
)

// ─── Section Header ────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, color = '#6366f1', subtitle }) => (
    <div className="mb-5">
        <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
                <Icon size={16} strokeWidth={2.5} />
            </div>
            <h3 className="text-slate-800 dark:text-white font-bold text-lg">{title}</h3>
        </div>
        {subtitle && <p className="text-xs text-slate-500 ml-11 mt-0.5">{subtitle}</p>}
    </div>
)

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyChart = ({ message = 'No data for selected period' }) => (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <AlertCircle size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">{message}</p>
    </div>
)

// ─── Progress Bar Component ────────────────────────────────────────────────────
const ProgressBar = ({ label, value, max, color, isBudget = false }) => {
    const percentage = Math.min(100, Math.max(0, (value / (max || 1)) * 100))
    const isOver = value > max && max > 0
    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-slate-700 dark:text-slate-200 font-bold text-sm truncate">{label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tight ${isOver ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10'}`}>
                        {isOver ? 'Over' : 'Healthy'}
                    </span>
                </div>
                <div className="text-right shrink-0">
                    <span className={isOver ? 'text-rose-500 font-black' : 'text-slate-800 dark:text-white font-black'}>
                        {value.toFixed(1)}h 
                        <span className="text-slate-400 font-medium text-[11px] ml-1">/ {max.toFixed(1)}h {isBudget ? '(Budget)' : '(Cap)'}</span>
                    </span>
                </div>
            </div>
            <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                <div
                    className={`h-full rounded-full transition-all duration-1000 ${isOver ? 'bg-gradient-to-r from-rose-500 to-rose-400' : ''}`}
                    style={{ width: `${percentage}%`, backgroundColor: isOver ? undefined : color }}
                />
            </div>
        </div>
    )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ReportsPage() {
    const { isPro } = useAuthStore()
    const [range, setRange] = useState({ from: '', to: '' })
    const [selectedProjectId, setSelectedProjectId] = useState('all')
    const [selectedUserId, setSelectedUserId] = useState('all')
    const [selectedDepartment, setSelectedDepartment] = useState('all')
    const [period, setPeriod] = useState('monthly')
    const [detailParams, setDetailParams] = useState(null)
    const [exportLoading, setExportLoading] = useState(null) // 'pdf' or 'csv'
    const [exportMenuOpen, setExportMenuOpen] = useState(false)

    const filterParams = {
        ...(range.from && { from: range.from }),
        ...(range.to && { to: range.to }),
        ...(!range.from && !range.to && period && { period }),
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

    const departments = useMemo(() => {
        if (!employees) return []
        const depts = new Set(employees.map(e => e.department).filter(Boolean))
        return Array.from(depts)
    }, [employees])

    const { data: tsData, isLoading: tsLoading } = useQuery({
        queryKey: ['reports', 'timesheet-summary', filterParams],
        queryFn: () => reportAPI.getTimesheetSummary(filterParams).then(r => r.data.data),
    })

    const { data: projData } = useQuery({
        queryKey: ['reports', 'project-utilization', filterParams],
        queryFn: () => reportAPI.getProjectUtilization(filterParams).then(r => r.data.data),
    })

    const { data: leaveData } = useQuery({
        queryKey: ['reports', 'leave-summary', filterParams],
        queryFn: () => reportAPI.getLeaveSummary(filterParams).then(r => r.data.data),
    })

    const { data: weeklyTrend } = useQuery({
        queryKey: ['reports', 'weekly-trend', filterParams],
        queryFn: () => reportAPI.getWeeklyTrend(filterParams).then(r => r.data.data),
    })

    const { data: deptData } = useQuery({
        queryKey: ['reports', 'department-summary', filterParams],
        queryFn: () => reportAPI.getDepartmentSummary(filterParams).then(r => r.data.data),
    })

    const { data: complianceData } = useQuery({
        queryKey: ['reports', 'compliance-summary', filterParams],
        queryFn: () => reportAPI.getComplianceSummary(filterParams).then(r => r.data.data),
    })

    const { data: insightsData } = useQuery({
        queryKey: ['reports', 'smart-insights', filterParams],
        queryFn: () => reportAPI.getSmartInsights(filterParams).then(r => r.data.data),
    })

    const { data: taskDetails, isLoading: tasksLoading } = useQuery({
        queryKey: ['reports', 'timesheet-details', detailParams, range],
        queryFn: () => reportAPI.getTimesheetDetails({
            userId: detailParams?.userId,
            projectId: detailParams?.projectId,
            ...range
        }).then(r => r.data.data),
        enabled: !!detailParams,
    })

    // ─── Derived data ──────────────────────────────────────────────────────────
    let filteredTsData = tsData || []
    if (selectedDepartment !== 'all') {
        filteredTsData = filteredTsData.filter(r => r.user?.department === selectedDepartment)
    }

    const totalHours = filteredTsData.reduce((s, r) => s + (r.totalHours || 0), 0) || 0
    const uniqueEmployees = new Set(filteredTsData.map(r => r._id?.userId)).size || 0

    const complianceRate = useMemo(() => {
        if (!complianceData?.length) return 0
        const approved = complianceData.find(d => d.name === 'Approved')?.value || 0
        const total = complianceData.reduce((s, d) => s + d.value, 0)
        return total ? Math.round((approved / total) * 100) : 0
    }, [complianceData])

    const weeklyAvg = weeklyTrend?.length
        ? (weeklyTrend.reduce((s, w) => s + w.totalHours, 0) / weeklyTrend.length).toFixed(2)
        : 0

    // Trend analysis chart data
    const trendChartData = (weeklyTrend || []).map(w => ({
        week: format(new Date(w.week), 'MMM d'),
        'Total Hours': +(w.totalHours || 0).toFixed(2),
        Employees: w.employeeCount || 0,
        'Avg/Person': w.employeeCount ? +((w.totalHours || 0) / w.employeeCount).toFixed(2) : 0,
    }))

    // Department stacked bar data
    const deptChartData = (deptData || []).map(d => {
        const row = { name: d.department || 'Unassigned', total: +(d.totalHours || 0).toFixed(2) }
        // For a stacked bar, we could put projects as keys, but for simplicity, we'll just show total hours in the bar for now
        // To do full stacked, we'd need dynamic keys. Let's stick to total hours per department.
        return row
    })

    // Top employees for ranking table
    const topPerformers = (tsData || [])
        .reduce((acc, row) => {
            const uid = row._id?.userId
            const existing = acc.find(a => a._id === uid?.toString())
            if (existing) { existing.hours += (row.totalHours || 0); return acc }
            acc.push({
                _id: uid?.toString(), name: row.user?.name || 'Unknown',
                dept: row.user?.department || '—', hours: row.totalHours || 0,
                role: row.user?.role || 'Employee'
            })
            return acc
        }, [])
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5)

    // PDF Export
    const handleExport = useCallback(async (type) => {
        setExportLoading(type)
        setExportMenuOpen(false)
        try {
            const params = {
                ...(range.from && { from: range.from }),
                ...(range.to && { to: range.to }),
                ...(selectedUserId !== 'all' && { userId: selectedUserId }),
                ...(selectedProjectId !== 'all' && { projectId: selectedProjectId }),
            }
            const apiCall = type === 'pdf' ? reportAPI.exportPDF : reportAPI.exportCSV
            const response = await apiCall(params)

            const mimeType = type === 'pdf' ? 'application/pdf' : 'text/csv'
            const ext = type === 'pdf' ? 'pdf' : 'csv'

            const blob = new Blob([response.data], { type: mimeType })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `enterprise-report-${new Date().toISOString().split('T')[0]}.${ext}`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            toast.success(`${type.toUpperCase()} report downloaded!`)
        } catch (err) {
            console.error(err)
            toast.error(`Failed to generate ${type.toUpperCase()}`)
        } finally {
            setExportLoading(null)
        }
    }, [range, selectedUserId, selectedProjectId])

    const resetFilters = () => {
        setRange({ from: '', to: '' })
        setSelectedProjectId('all')
        setSelectedUserId('all')
        setSelectedDepartment('all')
    }

    return (
        <ProGuard
            title="Enterprise Analytics"
            subtitle="Advanced reporting, compliance tracking, AI-powered insights, and department utilization metrics are available in the Enterprise Pro tier."
            icon={Zap}
        >
            <div className="space-y-6 fluid-container animate-fade-in pb-12">
                {/* ── Page Header & Export ── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Enterprise Reports</h1>
                        <p className="text-slate-500 text-sm mt-1">Comprehensive organization analytics and insights</p>
                    </div>
                    <div className="relative">
                        <button
                            onClick={() => setExportMenuOpen(!exportMenuOpen)}
                            disabled={exportLoading !== null}
                            className="btn btn-primary shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                        >
                            {exportLoading ? (
                                <><RefreshCw size={16} className="animate-spin" /> Generating {exportLoading.toUpperCase()}...</>
                            ) : (
                                <><Download size={16} /> Export <ChevronDown size={14} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} /></>
                            )}
                        </button>

                        {exportMenuOpen && !exportLoading && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 animate-fade-in origin-top-right">
                                    <button
                                        onClick={() => handleExport('pdf')}
                                        className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors"
                                    >
                                        <FileText size={16} className="text-indigo-500" /> Export as PDF
                                    </button>
                                    <button
                                        onClick={() => handleExport('csv')}
                                        className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-3 transition-colors border-t border-slate-100 dark:border-slate-700"
                                    >
                                        <FileSpreadsheet size={16} className="text-emerald-500" /> Export as CSV
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── 1. Top Filter Bar (Global Controls) ── */}
                <div className="card p-4 border border-slate-100 dark:border-white/5 shadow-sm sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 text-primary dark:text-indigo-400 font-bold text-sm bg-indigo-50 dark:bg-primary-500/10 px-3 py-1.5 rounded-lg">
                            <Filter size={16} /> Filters
                        </div>

                        <div className="flex items-center gap-2">
                            <input type="date" className="input py-2 text-sm w-36 bg-slate-50 dark:bg-slate-800"
                                value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
                            <span className="text-slate-400 text-xs font-medium">TO</span>
                            <input type="date" className="input py-2 text-sm w-36 bg-slate-50 dark:bg-slate-800"
                                value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
                        </div>

                        <div className="h-8 w-px bg-slate-200 dark:bg-white/10 hidden md:block"></div>

                        <select className="input py-2 text-sm w-40 bg-slate-50 dark:bg-slate-800 font-medium"
                            value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)}>
                            <option value="all">All Departments</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>

                        <select className="input py-2 text-sm w-44 bg-slate-50 dark:bg-slate-800 font-medium"
                            value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                            <option value="all">All Employees</option>
                            {employees?.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                        </select>

                        <select className="input py-2 text-sm w-44 bg-slate-50 dark:bg-slate-800 font-medium border-primary-200 dark:border-primary-500/20"
                            value={period} onChange={e => { setPeriod(e.target.value); setRange({ from: '', to: '' }) }}>
                            <option value="weekly">This Week</option>
                            <option value="monthly">This Month</option>
                            <option value="yearly">This Year</option>
                        </select>

                        <select className="input py-2 text-sm w-44 bg-slate-50 dark:bg-slate-800 font-medium"
                            value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value)}>
                            <option value="all">All Projects</option>
                            {projects?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>

                        {(range.from || range.to || selectedUserId !== 'all' || selectedProjectId !== 'all' || selectedDepartment !== 'all') && (
                            <button onClick={resetFilters} className="ml-auto text-sm font-semibold text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                                <X size={16} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* ── 2. Executive KPI Section ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <KpiCard icon={Clock} label="Total Hours Logged" value={`${totalHours.toFixed(2)}h`}
                        color="#6366f1" sub="Approved hours in period" trend={5.2} />

                    <KpiCard icon={ShieldAlert} label="Timesheet Compliance" value={`${complianceRate}%`}
                        color={complianceRate > 80 ? '#22c55e' : '#f59e0b'} sub="Based on submitted vs draft" />

                    <KpiCard icon={Users} label="Active Employees" value={uniqueEmployees}
                        color="#3b82f6" sub={`In ${selectedDepartment !== 'all' ? selectedDepartment : 'all departments'}`} />

                    <KpiCard icon={TrendingUp} label="Average Weekly Hours" value={`${weeklyAvg}h`}
                        color="#8b5cf6" sub="Per active employee" />
                </div>

                {tsLoading ? (
                    <div className="flex justify-center pt-20 pb-20"><Spinner size="lg" /></div>
                ) : (
                    <>
                        {/* ── 3. Smart Insights ── */}
                        {insightsData?.length > 0 && (
                            <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-1 shadow-lg">
                                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -mr-10 -mt-20 pointer-events-none"></div>
                                    <div className="flex items-start gap-4 relative z-10">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md flex-shrink-0">
                                            <Zap size={24} fill="currentColor" className="opacity-80" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Smart Insights</h3>
                                            <ul className="space-y-2">
                                                {insightsData.map((insight, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-slate-600 dark:text-slate-300 text-sm font-medium">
                                                        <span className="text-indigo-500 mt-0.5">•</span> {insight}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 ultrawide:ultrawide-grid-4 gap-6">

                            {/* ── Compliance Analytics (Donut) ── */}
                            <div className="card lg:col-span-1">
                                <SectionHeader icon={PieIcon} title="Compliance Overview" color="#f59e0b" subtitle="Timesheet submission status" />
                                {complianceData?.length ? (
                                    <div className="relative">
                                        <ResponsiveContainer width="100%" height={260}>
                                            <PieChart>
                                                <Pie
                                                    data={complianceData}
                                                    cx="50%" cy="50%"
                                                    innerRadius={70} outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    cornerRadii={[4, 4, 4, 4]} // smooth inner edges if supported
                                                >
                                                    {complianceData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />
                                                    ))}
                                                </Pie>
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 500 }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-6">
                                            <span className="text-3xl font-black text-slate-800 dark:text-white leading-none">{complianceRate}%</span>
                                            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">Compliant</span>
                                        </div>
                                    </div>
                                ) : <EmptyChart message="No timesheets to analyze" />}
                            </div>

                            {/* ── Project Utilization (Progress Bars) ── */}
                            <div className="card lg:col-span-2 flex flex-col">
                                <SectionHeader icon={Briefcase} title="Project Utilization" color="#3b82f6" subtitle="Actual hours vs Estimated Capacity" />
                                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                                    {projData?.length ? projData.slice(0, 10).map((proj, idx) => (
                                        <div key={proj._id} className="group/proj p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-2xl transition-all">
                                            <ProgressBar
                                                label={proj.project?.name || 'Unknown Project'}
                                                value={proj.totalHours}
                                                max={proj.capacity || (proj.totalHours + Math.max(10, proj.totalHours * 0.2))}
                                                color={PALETTE[idx % PALETTE.length]}
                                                isBudget={!!proj.project?.budgetHours}
                                            />
                                            
                                            {/* Enterprise-style employee-level budget tracker breakdown */}
                                            {proj.employeeDetails?.length > 0 && (
                                                <div className="ml-5 pl-4 border-l-2 border-slate-100 dark:border-white/5 space-y-3 mt-3 animate-fade-in">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Member Utilization Breakdown</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                                                        {proj.employeeDetails.filter(ed => ed.loggedHours > 0 || ed.budgetHours > 0).map((ed, eIdx) => (
                                                            <div key={eIdx} className="flex flex-col gap-1.5">
                                                                <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                                                    <span className="truncate max-w-[120px]">{ed.userId?.name || 'Member'}</span>
                                                                    <span className={ed.loggedHours > ed.budgetHours && ed.budgetHours > 0 ? 'text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded' : 'text-slate-500'}>
                                                                        {ed.loggedHours.toFixed(1)} <span className="text-[9px] font-medium opacity-60">/</span> {ed.budgetHours || '∞'}h
                                                                    </span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                                                                    <div 
                                                                        className={`h-full rounded-full transition-all duration-1000 ${ed.loggedHours > ed.budgetHours && ed.budgetHours > 0 ? 'bg-gradient-to-r from-rose-500 to-rose-400' : 'bg-gradient-to-r from-indigo-400 to-blue-400 dark:from-indigo-500 dark:to-blue-500 shadow-sm'}`}
                                                                        style={{ 
                                                                            width: `${Math.min(100, (ed.loggedHours / (ed.budgetHours || Math.max(ed.loggedHours, 1))) * 100)}%`
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )) : <EmptyChart message="No active projects" />}
                                </div>
                            </div>

                            {/* ── Productivity Trend (Line Chart) ── */}
                            <div className="card lg:col-span-2">
                                <SectionHeader icon={Activity} title="Productivity Trend" color="#22c55e" subtitle="Weekly volume and average per person" />
                                {trendChartData?.length ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart data={trendChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                            <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false} dy={10} />
                                            <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false} dx={-10} />
                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', opacity: 0.4 }} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '15px' }} />
                                            <ReferenceLine y={40} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Target (40h)', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                                            <Line type="monotone" dataKey="Avg/Person" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                                            <Line type="monotone" dataKey="Total Hours" stroke="#22c55e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} strokeDasharray="5 5" />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart message="Not enough weekly data to show trends" />}
                            </div>

                            {/* ── Top Performers Ranking ── */}
                            <div className="card lg:col-span-1 flex flex-col">
                                <SectionHeader icon={Award} title="Top Performers" color="#ec4899" subtitle="Most hours logged" />
                                <div className="flex-1 flex flex-col gap-3">
                                    {topPerformers.length ? topPerformers.map((emp, idx) => (
                                        <div key={emp._id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-pink-200 transition-colors">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0
                                            ${idx === 0 ? 'bg-gradient-to-br from-amber-300 to-amber-500' :
                                                    idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                                                        idx === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-500' :
                                                            'bg-slate-200 text-slate-600'}`}>
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{emp.name}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{emp.dept} • {emp.role}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-pink-500">{emp.hours.toFixed(2)}h</p>
                                            </div>
                                        </div>
                                    )) : <EmptyChart message="No performers found" />}
                                </div>
                            </div>

                            {/* ── Department Workload (Bar Chart) ── */}
                            <div className="card lg:col-span-3">
                                <SectionHeader icon={BarChart2} title="Department Workload" color="#8b5cf6" subtitle="Total productive hours per department" />
                                {deptChartData?.length ? (
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={deptChartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false} />
                                            <YAxis tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false} dx={-10} />
                                            <Tooltip cursor={{ fill: '#f1f5f9', opacity: 0.4 }} content={<CustomTooltip />} />
                                            <Bar dataKey="total" name="Total Hours" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                                {deptChartData.map((_, i) => (
                                                    <Cell key={i} fill={PALETTE[(i + 5) % PALETTE.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart message="No department data available" />}
                            </div>

                        </div>

                        {/* ── Detailed Employee Report Table ── */}
                        <div className="card mt-6">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-white/10 pb-4">
                                <SectionHeader icon={FileText} title="Detailed Employee Report" color="#06b6d4" subtitle="Comprehensive breakdown of individual contributions" />
                            </div>
                            <div className="table-wrapper overflow-x-auto">
                                <table className="w-full min-w-[800px]">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-800/50">
                                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>
                                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Department</th>
                                            <th className="text-left py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Project</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hours Logged</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Sheets</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Utilization</th>
                                            <th className="text-right py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                        {filteredTsData.map((row, i) => {
                                            // Mock utilization based on hours vs a 40h typical week, capped at 100% for display
                                            const utilPercentage = Math.min(100, Math.round((row.totalHours / 40) * 100))

                                            return (
                                                <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-bold text-xs uppercase">
                                                                {(row.user?.name || '?')[0]}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 dark:text-white text-sm">{row.user?.name ?? '—'}</p>
                                                                <p className="text-[10px] text-slate-400 font-medium">#{row.user?.employeeId}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-sm font-medium">
                                                        {row.user?.department || '—'}
                                                    </td>
                                                    <td className="py-3 px-4 hidden md:table-cell">
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                                                            {row.project?.name ?? '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className="font-black text-cyan-600 dark:text-cyan-400 text-base">{row.totalHours?.toFixed(2)}</span><span className="text-slate-400 text-xs ml-0.5">h</span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right text-slate-500 font-semibold hidden sm:table-cell">{row.timesheetCount}</td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{utilPercentage}%</span>
                                                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                                <div className={`h-full rounded-full ${utilPercentage > 80 ? 'bg-emerald-500' : utilPercentage > 50 ? 'bg-cyan-500' : 'bg-amber-500'}`} style={{ width: `${utilPercentage}%` }}></div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <button
                                                            onClick={() => setDetailParams({
                                                                userId: row._id?.userId,
                                                                projectId: row._id?.projectId,
                                                                userName: row.user?.name,
                                                                projectName: row.project?.name,
                                                            })}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-cyan-50 hover:text-cyan-600 hover:border-cyan-200 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                                        >
                                                            <Eye size={14} /> View
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {!filteredTsData?.length && (
                                            <tr><td colSpan={7} className="text-center text-slate-400 py-12 bg-slate-50/50 dark:bg-slate-800/20">
                                                No employee data found for the selected filters
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
                    title="Task Breakdown Analysis"
                    maxWidth="max-w-3xl"
                >
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 flex items-center justify-center shadow-inner">
                                    <Activity size={24} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-white">
                                        {detailParams?.userName}
                                    </h4>
                                    <p className="text-sm text-slate-500 font-medium mt-0.5">
                                        {detailParams?.projectName || 'All Projects'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-left sm:text-right bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 min-w-[120px]">
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Effort</p>
                                <p className="text-2xl font-black text-cyan-600 leading-none">
                                    {taskDetails?.reduce((s, t) => s + t.hoursWorked, 0).toFixed(2)}<span className="text-sm ml-1 text-slate-400">hours</span>
                                </p>
                            </div>
                        </div>

                        {tasksLoading ? <div className="py-20 flex justify-center"><Spinner size="lg" /></div> : (
                            <div className="rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                                <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                    <FileText size={16} className="text-slate-400" />
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Detailed Entries</span>
                                </div>
                                <div className="modal-scroll-adaptive p-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
                                    {taskDetails?.map((task, idx) => (
                                        <div key={idx} className="p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700 flex flex-col sm:flex-row gap-4">
                                            <div className="flex items-start justify-between sm:w-48 flex-shrink-0">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                                        {task.date ? format(new Date(task.date), 'MMM d, yyyy') : 'Unknown Date'}
                                                    </span>
                                                    <span className="text-xs font-semibold text-slate-400 mt-0.5">
                                                        {task.date ? format(new Date(task.date), 'EEEE') : ''}
                                                    </span>
                                                </div>
                                                <div className="flex sm:hidden items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 text-xs font-bold font-mono">
                                                    {task.hoursWorked}h
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                        {task.category || 'General'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                                    {task.taskDescription || <span className="italic opacity-50">No description provided</span>}
                                                </p>
                                            </div>
                                            <div className="hidden sm:flex items-start justify-end flex-shrink-0">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 text-sm font-bold font-mono">
                                                    {task.hoursWorked.toFixed(2)}h
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {!taskDetails?.length && (
                                        <div className="py-16 text-center">
                                            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <FileText size={24} className="text-slate-300" />
                                            </div>
                                            <p className="text-slate-500 font-medium">No verified entries found.</p>
                                            <p className="text-xs text-slate-400 mt-1">This user may not have logged hours for this specific project.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            </div>
        </ProGuard>
    )
}
