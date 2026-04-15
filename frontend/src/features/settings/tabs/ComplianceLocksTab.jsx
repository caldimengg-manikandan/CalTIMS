import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileLock, CalendarCheck, FileWarning, Save } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

export default function ComplianceLocksTab() {
    const qc = useQueryClient()
    const [compliance, setCompliance] = useState({
        timesheetFreezeDay: 28,
        allowBackdatedEntries: false,
        auditLogRetentionDays: 365
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.compliance) {
            setCompliance({
                timesheetFreezeDay: data.compliance.timesheetFreezeDay || 28,
                allowBackdatedEntries: !!data.compliance.allowBackdatedEntries,
                auditLogRetentionDays: data.compliance.auditLogRetentionDays || 365
            })
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ compliance }),
        onSuccess: () => {
            toast.success('Compliance policy updated!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setCompliance(f => ({ ...f, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Compliance & Data Integrity</h2>
                    <p className="text-sm text-slate-500 font-medium">Enforce regulatory boundaries and historical data preservation</p>
                </div>
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
                >
                    {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={18} />}
                    Save Changes
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Freezing Policy */}
                <SectionCard title="Temporal Constraints" subtitle="Locking mechanisms for previous cycles" icon={FileLock}>
                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Freeze Day of Month</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="1"
                                    max="31"
                                    className="input w-24 h-11 text-center font-bold text-lg"
                                    value={compliance.timesheetFreezeDay}
                                    onChange={e => upd('timesheetFreezeDay', Math.max(1, parseInt(e.target.value) || 1))}
                                />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Locks Historical Entries</p>
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                        Entries from the previous month will be frozen on this day of the current month.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-indigo-200">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ${compliance.allowBackdatedEntries ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <CalendarCheck size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Backdated Entries</p>
                                        <p className={`text-[10px] font-bold ${compliance.allowBackdatedEntries ? 'text-amber-600' : 'text-slate-400'}`}>
                                            {compliance.allowBackdatedEntries ? 'UNRESTRICTED' : 'FORBIDDEN'}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => upd('allowBackdatedEntries', !compliance.allowBackdatedEntries)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${compliance.allowBackdatedEntries ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${compliance.allowBackdatedEntries ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Preservation Policy */}
                <SectionCard title="Traceability" subtitle="System logging and data retention" icon={FileWarning}>
                    <div className="space-y-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Audit Log Retention (Days)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    className="input w-24 h-11 text-center font-bold text-lg"
                                    value={compliance.auditLogRetentionDays}
                                    onChange={e => upd('auditLogRetentionDays', Math.max(0, parseInt(e.target.value) || 0))}
                                />
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Auto-Purge Cycles</p>
                                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                        System logs older than this will be permanently deleted for optimization.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>
        </div>
    )
}
