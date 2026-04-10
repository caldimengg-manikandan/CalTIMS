import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { timesheetAPI, attendanceAPI, settingsAPI } from '@/services/endpoints'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import { format, isValid, addDays } from 'date-fns'
import { Calendar, Clock, Briefcase, FileText, AlertCircle, User, Zap } from 'lucide-react'

export default function TimesheetDetailsModal({ weekStartDate, userId, isOpen, onClose }) {
    const formatHours = (hours) => {
        const decimal = Number(hours) || 0
        const h = Math.floor(decimal)
        const m = Math.round((decimal - h) * 60)
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    const safeFormat = (date, formatStr) => {
        if (!date) return ''
        let d = new Date(date)
        if (!isValid(d)) return ''

        // Handle timezone shifts for midnight dates (Common in YYYY-MM-DD or ISO strings)
        if (typeof date === 'string') {
            const datePart = date.includes('T') ? date.split('T')[0] : date
            if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                const [y, m, day] = datePart.split('-').map(Number)
                d = new Date(y, m - 1, day) // Create local midnight
            }
        }
        return format(d, formatStr)
    }

    const { data: timesheets, isLoading } = useQuery({
        queryKey: ['timesheets', 'details', weekStartDate, userId],
        queryFn: () => {
            const dateStr = safeFormat(weekStartDate, 'yyyy-MM-dd')
            return timesheetAPI.getAll({
                from: dateStr,
                to: dateStr,
                userId: userId,
                limit: 100 // Get all projects for this week
            }).then(r => r.data)
        },
        enabled: !!weekStartDate && isOpen && isValid(new Date(weekStartDate)),
    })

    const { data: fullSettings } = useQuery({
        queryKey: ['settings', 'full'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
        enabled: isOpen,
        staleTime: 5 * 60 * 1000,
    })

    const { data: attendanceLogs } = useQuery({
        queryKey: ['attendance', safeFormat(weekStartDate, 'yyyy-MM-dd'), userId],
        queryFn: () => {
            const start = new Date(weekStartDate)
            // Ensure we use the same week start logic
            const dateStr = safeFormat(start, 'yyyy-MM-dd')
            return attendanceAPI.getAll({
                from: dateStr,
                to: safeFormat(addDays(start, 6), 'yyyy-MM-dd'),
                userId: userId
            }).then(r => r.data.data)
        },
        enabled: !!weekStartDate && isOpen && !!userId,
    })

    const isAttendanceEnabled = React.useMemo(() => {
        if (!fullSettings?.hardwareGateways) return false;
        return Object.values(fullSettings.hardwareGateways).some(gw => gw.enabled);
    }, [fullSettings])


    const calculateSwipeHours = (date) => {
        if (!attendanceLogs) return 0
        const dateStr = safeFormat(date, 'yyyy-MM-dd')
        const dayLogs = attendanceLogs.filter(log => safeFormat(log.timestamp, 'yyyy-MM-dd') === dateStr)
        if (dayLogs.length < 2) return 0

        const timestamps = dayLogs.map(log => new Date(log.timestamp).getTime())
        const start = Math.min(...timestamps)
        const end = Math.max(...timestamps)
        return (end - start) / (1000 * 60 * 60)
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Timesheet Details: ${safeFormat(weekStartDate, 'MMM d, yyyy')}`}
            maxWidth="max-w-4xl"
        >
            {isLoading ? (
                <div className="py-20 flex justify-center">
                    <Spinner size="md" />
                </div>
            ) : !timesheets?.data?.[0] || timesheets.data[0].rows.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                    <AlertCircle size={48} className="mx-auto text-slate-300" />
                    <p className="text-slate-500 font-medium">No details found for this week.</p>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-in">
                    {/* Header: User Info & Status */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                        {timesheets?.data?.[0]?.userId && (
                            <div className="flex items-center gap-4 bg-white dark:bg-black p-4 rounded-2xl border border-slate-100 dark:border-white shadow-sm flex-1">
                                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-100 dark:shadow-none shrink-0 uppercase">
                                    {(timesheets.data[0].userId.name || '?').charAt(0)}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white leading-tight">
                                        {timesheets.data[0].userId.name}
                                        <span className="text-slate-400 font-bold ml-2">
                                            ({timesheets.data[0].userId.employeeId || 'N/A'})
                                        </span>
                                    </h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <Briefcase size={14} className="text-primary" />
                                            {timesheets.data[0].userId.department || 'Employee'}
                                        </div>
                                        <span className="text-slate-300">•</span>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            <Clock size={14} className="text-primary" />
                                            {formatHours(timesheets.data[0].totalHours || 0)} Week Total
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col items-end gap-2 bg-slate-50 dark:bg-black/50 p-4 rounded-2xl border border-slate-100 dark:border-white shadow-sm shrink-0 min-w-[180px]">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Week Status</span>
                            <StatusBadge status={timesheets.data[0].status} />
                            {timesheets.data[0].submittedAt && (
                                <span className="text-[10px] text-slate-400 font-medium mt-1">
                                    Finalized: {safeFormat(timesheets.data[0].submittedAt, 'MMM d, HH:mm')}
                                </span>
                            )}
                        </div>
                    </div>

                    {timesheets.data[0].rows.map((row) => (
                        <div key={row.id || row._id} className="bg-slate-50 dark:bg-black/50 rounded-2xl border border-slate-100 dark:border-white overflow-hidden">
                            {/* Row Header */}
                            <div className="px-6 py-4 bg-white dark:bg-black border-b border-slate-100 dark:border-white flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-black text-primary dark:text-white rounded-lg">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-white">
                                            {row.projectId?.name || 'Unknown Project'} <span className="text-slate-400 font-normal">({row.projectId?.code || 'N/A'})</span>
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            <span>{row.category}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1"><Clock size={12} /> {formatHours(row.totalHours || 0)} hrs</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Daily Breakdown */}
                            <div className="p-6">
                                <div className="grid grid-cols-7 gap-2 mb-6">
                                    {row.entries.map((entry, idx) => {
                                        const swipeHrs = calculateSwipeHours(entry.date)
                                        return (
                                            <div key={idx} className="flex flex-col items-center">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                    {safeFormat(entry.date, 'EEE')}
                                                </span>
                                                <div className={`w-full p-2 rounded-xl border text-center transition-all ${entry.hoursWorked > 0
                                                    ? 'btn-primary border-primary text-white shadow-sm shadow-indigo-100'
                                                    : 'bg-white dark:bg-black border-slate-100 dark:border-white text-slate-400'
                                                    }`}>
                                                    <div className="text-xs font-bold leading-none mb-0.5">{safeFormat(entry.date, 'd')}</div>
                                                    <div className="text-[10px] opacity-90">{formatHours(entry.hoursWorked || 0)}</div>
                                                </div>
                                                
                                                {/* Swipe Hours Display */}
                                                {swipeHrs > 0 && (
                                                    <div className="mt-1.5 flex flex-col items-center">
                                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter" title="Office Presence (Swipe Hours)">
                                                            <Zap size={8} className="text-amber-500" />
                                                            {formatHours(swipeHrs)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Tasks for this project */}
                                <div className="space-y-3">
                                    {/* <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        <FileText size={14} /> Task Descriptions
                                    </div> */}
                                    <div className="grid grid-cols-1 gap-2">
                                        {row.entries.filter(e => e.taskDescription).map((entry, idx) => (
                                            <div key={idx} className="flex gap-3 p-3 bg-white dark:bg-black rounded-xl border border-slate-100 dark:border-white">
                                                <div className="shrink-0 w-12 text-center py-1 bg-slate-50 dark:bg-black rounded-lg text-[10px] font-bold text-slate-500 uppercase">
                                                    {safeFormat(entry.date, 'MMM d')}
                                                </div>
                                                <div className="text-sm text-slate-600 dark:text-white">
                                                    {entry.taskDescription}
                                                </div>
                                            </div>
                                        ))}
                                        {/* {row.entries.every(e => !e.taskDescription) && (
                                            <p className="text-sm text-slate-400 italic py-2">No task descriptions provided.</p>
                                        )} */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Rejection Reason if any */}
                    {timesheets.data[0].rejectionReason && (
                        <div className="p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20 shadow-sm flex gap-3">
                            <AlertCircle className="text-rose-500 shrink-0" size={20} />
                            <div>
                                <h5 className="text-[10px] text-rose-600 dark:text-rose-400 uppercase tracking-widest font-bold">Rejection Feedback</h5>
                                <p className="text-sm text-rose-700 dark:text-rose-200 leading-relaxed font-medium italic break-words whitespace-pre-wrap mt-1">
                                    "{timesheets.data[0].rejectionReason}"
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}
