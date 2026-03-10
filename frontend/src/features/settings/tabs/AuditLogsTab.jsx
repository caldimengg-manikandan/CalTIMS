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
        <div className="space-y-8 pb-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">System Audit Trail</h2>
                    <p className="text-sm text-slate-500 font-medium">Immutable record of administrative activities and system state changes</p>
                </div>
            </div>

            <SectionCard icon={History} title="Global Activity Log" subtitle="Real-time event stream for institutional oversight">
                {isLoading ? (
                    <div className="flex justify-center py-24"><Spinner size="lg" /></div>
                ) : logs.length === 0 ? (
                    <div className="py-24 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <History size={32} />
                        </div>
                        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">Zero Events Recorded</p>
                        <p className="text-sm text-slate-500 mt-2 font-medium">System activities will be indexed here automatically.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto -mx-6">
                        <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
                            <thead className="bg-slate-50/50 dark:bg-white/5 text-slate-400 font-black uppercase tracking-widest text-[10px] sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5">Event Timestamp</th>
                                    <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5">Originator</th>
                                    <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5">Action Type</th>
                                    <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5">Subject Entity</th>
                                    <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5">Metadata</th>
                                    <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-right">Access Point</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {logs.map((log) => (
                                    <tr key={log._id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-5">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                                                    {log.userId?.name?.[0] || 'S'}
                                                </div>
                                                <p className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-tight">
                                                    {log.userId?.name || 'System Engine'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest shadow-sm">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                <Filter size={12} className="text-slate-300" />
                                                {log.entityType}
                                            </p>
                                        </td>
                                        <td className="px-6 py-5">
                                            <details className="text-xs text-slate-500 cursor-pointer group/details">
                                                <summary className="font-black text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 list-none flex items-center gap-1.5 outline-none">
                                                    <span className="w-1 h-3 bg-indigo-600 dark:bg-indigo-400 rounded-full" /> Details
                                                </summary>
                                                <div className="mt-3 relative">
                                                    <pre className="p-4 bg-slate-900 text-indigo-300 rounded-2xl border border-white/10 text-[10px] font-mono leading-relaxed max-w-sm overflow-x-auto shadow-2xl">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </div>
                                            </details>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <p className="text-[10px] text-slate-400 font-mono font-bold tracking-tighter">
                                                {log.ipAddress || '0.0.0.0'}
                                            </p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Sequence <span className="text-slate-600 dark:text-slate-200">{page}</span> of {totalPages} — {total} Events
                        </p>
                        <div className="flex gap-3">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(page - 1)}
                                className="h-9 px-4 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:grayscale"
                            >
                                Prev
                            </button>
                            <button
                                disabled={page === totalPages}
                                onClick={() => setPage(page + 1)}
                                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-30"
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
