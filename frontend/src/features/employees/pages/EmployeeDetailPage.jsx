import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { userAPI, timesheetAPI, leaveAPI } from '@/services/endpoints'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'

export default function EmployeeDetailPage() {
    const { id } = useParams()

    const { data: emp, isLoading } = useQuery({
        queryKey: ['user', id],
        queryFn: () => userAPI.getById(id).then(r => r.data.data),
        enabled: !!id && id !== 'new',
    })

    const { data: timesheets } = useQuery({
        queryKey: ['timesheets', 'user', id],
        queryFn: () => timesheetAPI.getAll({ userId: id, limit: 5 }).then(r => r.data.data),
        enabled: !!id && id !== 'new',
    })

    const { data: balance } = useQuery({
        queryKey: ['leave-balance', id],
        queryFn: () => leaveAPI.getBalance(id).then(r => r.data.data),
        enabled: !!id && id !== 'new',
    })

    if (isLoading) return <div className="flex justify-center pt-20"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6 animate-fade-in max-w-3xl">
            <Link to="/employees" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft size={16} /> Back to Employees
            </Link>

            {/* Profile Card */}
            <div className="card">
                <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-white text-3xl font-bold">
                        {emp?.name?.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{emp?.name}</h2>
                        <p className="text-slate-500">{emp?.email}</p>
                        <div className="flex gap-2 mt-2">
                            <StatusBadge status={emp?.role} />
                            <span className={`badge ${emp?.isActive ? 'badge-success' : 'badge-danger'}`}>
                                {emp?.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-white">
                    {[
                        ['Employee ID', emp?.employeeId],
                        ['Department', emp?.department ?? '—'],
                        ['Designation', emp?.designation ?? '—'],
                        ['Joining Date', emp?.joiningDate ? format(new Date(emp.joiningDate), 'MMM d, yyyy') : '—'],
                    ].map(([label, value]) => (
                        <div key={label}>
                            <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                            <p className="text-sm font-medium text-slate-700 dark:text-white mt-0.5">{value}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Leave Balance */}
            {balance && (
                <div className="card">
                    <h3 className="text-slate-700 dark:text-white mb-4">Leave Balance</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {Object.entries(balance).map(([type, days]) => (
                            <div key={type} className="bg-surface-50 dark:bg-black rounded-xl p-4 text-center">
                                <p className="text-2xl font-bold text-primary-600">{days}</p>
                                <p className="text-xs text-slate-500 capitalize mt-1">{type}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Timesheets */}
            <div className="card">
                <h3 className="text-slate-700 dark:text-white mb-4">Recent Timesheets</h3>
                {!timesheets?.length ? (
                    <p className="text-slate-400 text-sm">No timesheets found</p>
                ) : (
                    <div className="space-y-2">
                        {timesheets.map((ts) => (
                            <div key={ts._id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-white last:border-0">
                                <p className="text-sm text-slate-700 dark:text-white">{ts.projectId?.name}</p>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-primary-600">{ts.totalHours}h</span>
                                    <StatusBadge status={ts.status} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
