import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { timesheetAPI, projectAPI, settingsAPI } from '@/services/endpoints'
import { format, startOfWeek, subDays, addDays } from 'date-fns'
import toast from 'react-hot-toast'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'
import ProGuard from '@/components/ui/ProGuard';
import Spinner from '@/components/ui/Spinner'
import { Calendar, ChevronLeft, ChevronRight, Edit3, X, Save, AlertTriangle, Search, ShieldCheck, Filter, Download } from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'

export default function AdminTimesheetCompliancePage() {
    const queryClient = useQueryClient()
    const { general } = useSettingsStore()
    const weekStartDay = general?.weekStartDay || 'monday'
    const weekStartsOn = weekStartDay === 'sunday' ? 0 : 1

    const [currentDate, setCurrentDate] = useState(() => subDays(new Date(), 7)) // Default to previous week
    const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn }), [currentDate, weekStartsOn])
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

    const [selectedUser, setSelectedUser] = useState(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [rows, setRows] = useState([{ projectId: '', taskType: 'Development', dayHours: Array(7).fill('00:00') }])
    const [searchQuery, setSearchQuery] = useState('')

    // Pagination state
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)

    // Queries
    const { data: complianceRes, isLoading } = useQuery({
        queryKey: ['timesheets', 'compliance', format(weekStart, 'yyyy-MM-dd'), searchQuery, page, limit],
        queryFn: () => timesheetAPI.getCompliance({ weekStartDate: format(weekStart, 'yyyy-MM-dd'), search: searchQuery, page, limit }).then(r => r.data),
    })

    const complianceData = complianceRes?.data || []
    const pagination = complianceRes?.pagination

    const { data: projects } = useQuery({
        queryKey: ['projects', 'active'],
        queryFn: () => projectAPI.getAll({ status: 'active' }).then(r => r.data.data),
    })

    const { data: tsSettings } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
    })
    const TASK_TYPES = tsSettings?.taskCategories || ['Select Task', 'Development', 'Bug Fixing', 'Design', 'Meeting', 'Testing']

    // Mutations
    const fillMutation = useMutation({
        mutationFn: async (payload) => timesheetAPI.adminFill(payload),
        onSuccess: () => {
            toast.success('Timesheet filled successfully')
            setIsModalOpen(false)
            queryClient.invalidateQueries({ queryKey: ['timesheets', 'compliance'] })
        },
        onError: (err) => toast.error(err.response?.data?.message || err.message || 'Failed to fill timesheet')
    })

    // Reset page when search or week changes
    React.useEffect(() => {
        setPage(1)
    }, [searchQuery, weekStart])

    const handleOpenModal = (userItem) => {
        setSelectedUser(userItem.user)
        setRows([{ projectId: '', taskType: 'Development', dayHours: Array(7).fill('00:00') }])
        setIsModalOpen(true)
    }

    const handleSaveAdminFill = () => {
        const payloadRows = rows.filter(r => r.projectId).map(row => ({
            projectId: row.projectId,
            category: row.taskType,
            weekStartDate: format(weekStart, 'yyyy-MM-dd'),
            entries: weekDays.map((day, i) => {
                const [h, m] = row.dayHours[i].split(':').map(Number)
                return { date: format(day, 'yyyy-MM-dd'), hoursWorked: h + (m / 60) }
            })
        }))

        if (payloadRows.length === 0) return toast.error('Please add at least one valid project row.')

        fillMutation.mutate({ targetUserId: selectedUser._id, rows: payloadRows })
    }

    return (
        <ProGuard
            title="Compliance & Locks"
            subtitle="Timesheet compliance monitoring, automated locks, and advanced audit logs are part of the Enterprise Pro tier."
            icon={ShieldCheck}
        >
            <div className="flex flex-col gap-4 fluid-container animate-fade-in overflow-hidden min-h-[calc(100vh-200px)]">
                <PageHeader title="Timesheet Compliance" />

                {/* Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 bg-white dark:bg-black px-4 py-3 rounded-xl shadow-sm border border-slate-100 dark:border-white">
                        <button onClick={() => setCurrentDate(subDays(currentDate, 7))} className="p-1.5 hover:bg-slate-50 rounded-lg">
                            <ChevronLeft size={20} className="text-slate-600" />
                        </button>
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-primary" />
                            <span className="font-semibold">{format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</span>
                        </div>
                        <button
                            onClick={() => setCurrentDate(addDays(currentDate, 7))}
                            disabled={startOfWeek(addDays(currentDate, 7), { weekStartsOn }) > startOfWeek(new Date(), { weekStartsOn })}
                            className={`p-1.5 rounded-lg ${startOfWeek(addDays(currentDate, 7), { weekStartsOn }) > startOfWeek(new Date(), { weekStartsOn }) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
                        >
                            <ChevronRight size={20} className="text-slate-600" />
                        </button>
                    </div>

                    <div className="relative w-full sm:w-auto">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={18} className="text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name or emp id..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full sm:w-80 pl-10 pr-4 py-2.5 bg-white dark:bg-black border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="bg-white dark:bg-black rounded-xl shadow-sm border border-slate-200 dark:border-white overflow-hidden flex flex-col min-h-0">
                    {isLoading ? (
                        <div className="p-10 flex justify-center"><Spinner /></div>
                    ) : (
                        <div className="table-wrapper scroll-v-adaptive rounded-none border-0 shadow-none">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 bg-white dark:bg-black border-b border-slate-200 dark:border-white text-xs uppercase text-slate-500 font-semibold tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">Employee ID</th>
                                        <th className="px-6 py-4">Employee Name</th>
                                        <th className="px-6 py-4">Department</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Total Hours</th>
                                        <th className="px-6 py-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white text-sm">
                                    {complianceData?.map((item) => (
                                        <tr key={item.user._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{item.user.employeeId}</td>
                                            <td className="px-6 py-4 font-medium">{item.user.name}</td>
                                            <td className="px-6 py-4 text-slate-600">{item.user.department || '-'}</td>
                                            <td className="px-6 py-4">
                                                {item.status === 'missing' && <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold uppercase">Missing</span>}
                                                {item.status === 'frozen' && <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-md text-xs font-bold uppercase flex items-center gap-1 w-max"><AlertTriangle size={12} />Frozen</span>}
                                                {item.status === 'admin_filled' && <span className="bg-indigo-100 text-primary-700 px-2 py-1 rounded-md text-xs font-bold uppercase">Admin Filled</span>}
                                                {['draft', 'submitted', 'approved', 'rejected'].includes(item.status) && (
                                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md text-xs font-bold uppercase">{item.status}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-semibold">{(item.totalHours || 0).toFixed(2)}h</td>
                                            <td className="px-6 py-4">
                                                {['missing', 'frozen'].includes(item.status) && (
                                                    <button
                                                        onClick={() => handleOpenModal(item)}
                                                        className="flex items-center gap-1.5 text-primary hover:text-indigo-800 font-semibold text-xs bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        <Edit3 size={14} /> Fill Timesheet
                                                    </button>
                                                )}
                                                {item.status === 'admin_filled' && (
                                                    <span className="text-slate-400 text-xs italic">Resolved by Admin</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {complianceData?.length === 0 && (
                                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">No employees found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!isLoading && complianceData.length > 0 && pagination && (
                        <Pagination
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            totalResults={pagination.total}
                            limit={limit}
                            onPageChange={setPage}
                            onLimitChange={(l) => { setLimit(l); setPage(1); }}
                        />
                    )}
                </div>

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="px-6 py-4 border-b border-slate-100 dark:border-white flex justify-between items-center bg-slate-50 dark:bg-black">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        Fill Timesheet For: <span className="text-primary">{selectedUser?.name}</span>
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1">Week: {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}</p>
                                </div>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg"><X size={20} /></button>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-xs text-slate-500 uppercase">
                                            <th className="pb-3 pr-4">Project</th>
                                            <th className="pb-3 pr-4">Task</th>
                                            {weekDays.map(d => (
                                                <th key={d.toString()} className="pb-3 text-center w-16 px-1">
                                                    {format(d, 'EEE')}<br /><span className="text-[10px]">{format(d, 'dd')}</span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, rIndex) => (
                                            <tr key={rIndex}>
                                                <td className="py-2 pr-4">
                                                    <select
                                                        value={row.projectId}
                                                        onChange={e => {
                                                            const newRows = [...rows];
                                                            newRows[rIndex].projectId = e.target.value;
                                                            setRows(newRows);
                                                        }}
                                                        className="w-full border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-transparent"
                                                    >
                                                        <option value="">Select Project</option>
                                                        {projects?.map(p => <option key={p._id} value={p._id}>{p.code} - {p.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <select
                                                        value={row.taskType}
                                                        onChange={e => {
                                                            const newRows = [...rows];
                                                            newRows[rIndex].taskType = e.target.value;
                                                            setRows(newRows);
                                                        }}
                                                        className="w-full border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-transparent"
                                                    >
                                                        {TASK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                    </select>
                                                </td>
                                                {weekDays.map((d, dIndex) => (
                                                    <td key={dIndex} className="py-2 px-1">
                                                        <input
                                                            type="text"
                                                            value={row.dayHours[dIndex].split(':')[0]}
                                                            onChange={e => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                const newRows = [...rows];
                                                                const m = newRows[rIndex].dayHours[dIndex].split(':')[1] || '00';
                                                                newRows[rIndex].dayHours[dIndex] = `${val.padStart(2, '0')}:${m} `;
                                                                setRows(newRows);
                                                            }}
                                                            className="w-full text-center border-slate-300 dark:border-slate-700 rounded-md text-sm py-1 bg-transparent"
                                                            placeholder="00"
                                                            maxLength={2}
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <button
                                    onClick={() => setRows([...rows, { projectId: '', taskType: 'Development', dayHours: Array(7).fill('00:00') }])}
                                    className="mt-4 text-sm text-primary font-semibold hover:text-indigo-800"
                                >
                                    + Add Another Row
                                </button>
                            </div>

                            <div className="p-6 border-t border-slate-100 dark:border-white bg-slate-50 dark:bg-black flex justify-end gap-3">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
                                <button
                                    onClick={handleSaveAdminFill}
                                    disabled={fillMutation.isPending}
                                    className="px-6 py-2 btn-primary hover:bg-primary-700 text-white font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
                                >
                                    {fillMutation.isPending ? <Spinner size="sm" /> : <Save size={16} />} Save as Admin Fill
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </ProGuard>
    )
}
