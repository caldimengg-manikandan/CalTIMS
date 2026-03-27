import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
    History, Search, Filter, Eye, X, 
    ArrowRight, ShieldCheck, Download, 
    Calendar, User, Tag, ChevronDown, ChevronUp
} from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import { SectionCard } from '../components/SharedUI'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function PermissionAuditLogsTab() {
    const [filters, setFilters] = useState({
        roleName: '',
        changedByName: '',
        action: '',
        startDate: '',
        endDate: '',
        search: ''
    })
    const [selectedLog, setSelectedLog] = useState(null)
    const [isExporting, setIsExporting] = useState(false)

    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['settings', 'permission-audit-logs', filters],
        queryFn: () => settingsAPI.getPermissionAuditLogs(filters).then(r => r.data.data),
    })

    const handleExport = () => {
        if (!logs.length) return toast.error('No logs to export')
        setIsExporting(true)
        
        try {
            const headers = ['Date', 'User', 'Action', 'Role', 'Changes']
            const rows = logs.map(log => [
                new Date(log.timestamp).toLocaleString(),
                log.changedByName,
                log.action,
                log.roleName,
                log.changes.map(c => `${c.module} > ${c.submodule} > ${c.action}: ${c.previous} -> ${c.current}`).join(' | ')
            ])

            const csvContent = "data:text/csv;charset=utf-8," 
                + headers.join(",") + "\n"
                + rows.map(r => r.join(",")).join("\n")

            const encodedUri = encodeURI(csvContent)
            const link = document.createElement("a")
            link.setAttribute("href", encodedUri)
            link.setAttribute("download", `permission_audit_logs_${new Date().toISOString().split('T')[0]}.csv`)
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            toast.success('Audit logs exported successfully')
        } catch (err) {
            toast.error('Export failed')
        } finally {
            setIsExporting(false)
        }
    }

    const getActionBadge = (action) => {
        const styles = {
            CREATE_ROLE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
            UPDATE_PERMISSION: 'bg-primary/10 text-primary border-primary/20',
            DELETE_ROLE: 'bg-rose-500/10 text-rose-600 border-rose-500/20'
        }
        return (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${styles[action] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {action.replace('_', ' ')}
            </span>
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                        <ShieldCheck className="text-primary" size={24} />
                        Permission Audit History
                    </h2>
                    <p className="text-sm text-slate-500 font-medium">Traceable, immutable record of every RBAC change</p>
                </div>
                <button 
                    onClick={handleExport}
                    disabled={isExporting || !logs.length}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-lg hover:opacity-90 transition-all disabled:opacity-30"
                >
                    {isExporting ? <Spinner size="sm" /> : <Download size={14} />}
                    Export CSV
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-white/5 p-4 shadow-sm flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search by role, user, or module..."
                        className="w-full bg-slate-50 dark:bg-black/20 border-none rounded-2xl py-2.5 pl-11 pr-4 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 transition-all"
                        value={filters.search}
                        onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                    />
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <select 
                        className="bg-slate-50 dark:bg-black/20 border-none rounded-xl py-2 pl-3 pr-8 text-[11px] font-bold text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-primary/20"
                        value={filters.action}
                        onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
                    >
                        <option value="">All Actions</option>
                        <option value="CREATE_ROLE">Create Role</option>
                        <option value="UPDATE_PERMISSION">Update Permission</option>
                        <option value="DELETE_ROLE">Delete Role</option>
                    </select>

                    <div className="flex items-center bg-slate-50 dark:bg-black/20 rounded-xl px-2">
                        <Calendar size={12} className="text-slate-400 ml-1" />
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-[11px] font-bold text-slate-600 dark:text-slate-400 focus:ring-0 py-2 w-28"
                            value={filters.startDate}
                            onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))}
                        />
                        <span className="text-slate-300 mx-1">→</span>
                        <input 
                            type="date" 
                            className="bg-transparent border-none text-[11px] font-bold text-slate-600 dark:text-slate-400 focus:ring-0 py-2 w-28"
                            value={filters.endDate}
                            onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))}
                        />
                    </div>

                    {(filters.search || filters.action || filters.startDate) && (
                        <button 
                            onClick={() => setFilters({ roleName: '', changedByName: '', action: '', startDate: '', endDate: '', search: '' })}
                            className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                            title="Clear Filters"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                    <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
                        <thead className="bg-slate-50 dark:bg-black/20 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Date & Time</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Administrator</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Action</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Target Role</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Changes Summary</th>
                                <th className="px-6 py-4 border-b border-slate-100 dark:border-white/5 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center"><Spinner size="lg" /></td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <History size={40} className="mx-auto mb-3 text-slate-200" />
                                        <p className="text-sm font-bold text-slate-400 font-black uppercase tracking-widest">No matching audit logs found</p>
                                    </td>
                                </tr>
                            ) : logs.map((log) => (
                                <tr key={log._id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-5">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {new Date(log.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                            {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                                                {log.changedByName?.[0]?.toUpperCase()}
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{log.changedByName}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        {getActionBadge(log.action)}
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                            <Tag size={12} className="text-primary/40" />
                                            {log.roleName}
                                        </p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1 w-3 bg-primary/30 rounded-full" />
                                            <p className="text-xs font-medium text-slate-500 truncate max-w-[200px]">
                                                {log.changes.length} change(s) recorded
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button 
                                            onClick={() => setSelectedLog(log)}
                                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-white/5 text-slate-400 group-hover:text-primary group-hover:bg-primary/10 transition-all"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Details Modal with Diff View */}
            <Modal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title="Permission Change Details"
                size="lg"
            >
                {selectedLog && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-black/40 p-5 rounded-3xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-sm">
                                    {selectedLog.changedByName?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{selectedLog.changedByName}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{selectedLog.roleName} Role Update</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {new Date(selectedLog.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400">{selectedLog.ipAddress || 'Internal IP'}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 px-1">Granular Changes (Diff)</h4>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {selectedLog.changes.map((change, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
                                        <div className="min-w-[150px]">
                                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter mb-0.5">{change.module}</p>
                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{change.submodule}</p>
                                        </div>
                                        
                                        <div className="flex-1 flex flex-wrap items-center gap-3">
                                            <span className="px-2 py-1 rounded bg-slate-100 dark:bg-white/10 text-[10px] font-black text-slate-500 uppercase">{change.action}</span>
                                            
                                            <div className="flex items-center gap-3 ml-auto sm:ml-0">
                                                <div className={`flex items-center justify-center p-1.5 rounded-lg border ${!change.previous ? 'bg-rose-50 border-rose-100 text-rose-400' : 'bg-emerald-50 border-emerald-100 text-emerald-400'}`}>
                                                    {!change.previous ? <X size={14} /> : <Eye size={14} />}
                                                </div>
                                                <ArrowRight size={14} className="text-slate-300" />
                                                <div className={`flex items-center justify-center p-1.5 rounded-lg border shadow-sm ${!change.current ? 'bg-rose-500 border-rose-600 text-white' : 'bg-emerald-500 border-emerald-600 text-white'}`}>
                                                    {!change.current ? <X size={14} /> : <Eye size={14} />}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="hidden sm:block">
                                            {change.current ? (
                                                <span className="text-[10px] font-black text-emerald-500 uppercase">Granted</span>
                                            ) : (
                                                <span className="text-[10px] font-black text-rose-500 uppercase">Revoked</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-bold text-slate-400 italic">User Agent: {selectedLog.userAgent?.split(' ')[0] || 'Unknown Client'}</p>
                            <button 
                                onClick={() => setSelectedLog(null)}
                                className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-all"
                            >
                                Close Summary
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}
