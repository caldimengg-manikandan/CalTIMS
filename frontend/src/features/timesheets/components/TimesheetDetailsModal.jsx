import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { timesheetAPI } from '@/services/endpoints'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import { format, isValid } from 'date-fns'
import { Calendar, Clock, Briefcase, FileText, AlertCircle } from 'lucide-react'

export default function TimesheetDetailsModal({ weekStartDate, userId, isOpen, onClose }) {
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

    const formatHours = (hours) => {
        const h = Math.floor(hours)
        const m = Math.round((hours - h) * 60)
        return `${h}:${String(m).padStart(2, '0')}`
    }

    const safeFormat = (date, formatStr) => {
        if (!date) return ''
        let d = new Date(date)
        if (!isValid(d)) return ''
        // If it's a UTC midnight date (common from server), it might shift to previous day locally.
        // We ensure we read it based on its "intended" date.
        // Simple trick: if it's close to 00:00:00 (due to TZ shift), we can add offset.
        // But the most robust way for "YYYY-MM-DD" is to treat it as local.
        if (typeof date === 'string' && date.includes('T00:00:00')) {
            // It's a midnight date from server
            const [y, m, day] = date.split('T')[0].split('-').map(Number)
            d = new Date(y, m - 1, day) // Create local midnight
        }
        return format(d, formatStr)
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
                    {/* The week status is now top-level */}
                    <div className="flex justify-end px-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase">Week Status:</span>
                            <StatusBadge status={timesheets.data[0].status} />
                        </div>
                    </div>

                    {timesheets.data[0].rows.map((row) => (
                        <div key={row._id} className="bg-slate-50 dark:bg-black/50 rounded-2xl border border-slate-100 dark:border-white overflow-hidden">
                            {/* Row Header */}
                            <div className="px-6 py-4 bg-white dark:bg-black border-b border-slate-100 dark:border-white flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-black text-indigo-600 dark:text-white rounded-lg">
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
                                    {row.entries.map((entry, idx) => (
                                        <div key={idx} className="flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                                {safeFormat(entry.date, 'EEE')}
                                            </span>
                                            <div className={`w-full p-2 rounded-xl border text-center transition-all ${entry.hoursWorked > 0
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-100'
                                                : 'bg-white dark:bg-black border-slate-100 dark:border-white text-slate-400'
                                                }`}>
                                                <div className="text-xs font-bold leading-none mb-0.5">{safeFormat(entry.date, 'd')}</div>
                                                <div className="text-[10px] opacity-90">{entry.hoursWorked}h</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Tasks for this project */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                                        <FileText size={14} /> Task Descriptions
                                    </div>
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
                                        {row.entries.every(e => !e.taskDescription) && (
                                            <p className="text-sm text-slate-400 italic py-2">No task descriptions provided.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Rejection Reason if any */}
                    {timesheets.data[0].rejectionReason && (
                        <div className="p-4 bg-rose-50 dark:bg-black border border-rose-100 dark:border-white/20 rounded-xl flex gap-3">
                            <AlertCircle className="text-rose-500 shrink-0" size={20} />
                            <div>
                                <h5 className="text-sm font-bold text-rose-800 dark:text-white">Rejection Feedback</h5>
                                <p className="text-sm text-rose-600 dark:text-white mt-1">
                                    {timesheets.data[0].rejectionReason}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}
