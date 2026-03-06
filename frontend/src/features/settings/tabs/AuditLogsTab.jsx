import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Search, Filter } from 'lucide-react'
import { settingsAPI, auditAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import { SectionCard } from '../components/SharedUI'

export default function AuditLogsTab() {
    const [page, setPage] = useState(1)
    const limit = 20

    const { data: logData, isLoading } = useQuery({
        queryKey: ['settings', 'audit', page],
        queryFn: () => auditAPI.getAll({ page, limit }).then(r => r.data),
    })

    const logs = logData?.data || []
    const total = logData?.total || 0
    const totalPages = Math.ceil(total / limit)

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Audit Logs</h2>
                    <p className="text-sm text-slate-400">Track system-wide administrative changes and activities</p>
                </div>
                {/* Future: Add filters here (date range, user, action type) */}
            </div>

            <SectionCard icon={History}>
                {isLoading ? (
                    <div className="flex justify-center py-16"><Spinner size="lg" /></div>
                ) : logs.length === 0 ? (
                    <div className="py-20 text-center">
                        <History size={36} className="text-slate-300 mx-auto mb-3" />
                        <p className="font-semibold text-slate-500">No audit logs found</p>
                        <p className="text-sm text-slate-400 mt-1">Actions performed by admins will appear here</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-white/10">
                                <tr>
                                    <th className="p-3 pl-4 rounded-tl-xl">Timestamp</th>
                                    <th className="p-3">User</th>
                                    <th className="p-3">Action</th>
                                    <th className="p-3">Entity</th>
                                    <th className="p-3">Details</th>
                                    <th className="p-3 pr-4 rounded-tr-xl">IP Address</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {logs.map((log) => (
                                    <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-3 pl-4 text-xs font-medium text-slate-500">
                                            {new Date(log.createdAt).toLocaleString('en-IN')}
                                        </td>
                                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                                            {log.userId?.name || 'System'}
                                        </td>
                                        <td className="p-3">
                                            <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold font-mono">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600 dark:text-slate-400 font-medium">
                                            {log.entityType}
                                        </td>
                                        <td className="p-3">
                                            <details className="text-xs text-slate-500 cursor-pointer">
                                                <summary className="font-semibold text-primary/80 hover:text-primary mb-1 outline-none">
                                                    View JSON
                                                </summary>
                                                <pre className="mt-2 bg-slate-50 dark:bg-black p-2 rounded-lg border border-slate-200 dark:border-white/10 max-w-xs overflow-x-auto">
                                                    {JSON.stringify(log.details, null, 2)}
                                                </pre>
                                            </details>
                                        </td>
                                        <td className="p-3 pr-4 text-xs text-slate-400 font-mono">
                                            {log.ipAddress || '--'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 border-t border-slate-100 dark:border-white/10 pt-4 px-2">
                        <span className="text-xs text-slate-500">
                            Showing page {page} of {totalPages} ({total} logs)
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                                className="px-3 py-1.5 rounded bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold transition disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                                className="px-3 py-1.5 rounded bg-slate-100 dark:bg-white/10 hover:bg-slate-200 text-xs font-bold transition disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </SectionCard>
        </div>
    )
}
