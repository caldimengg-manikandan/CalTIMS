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
        timesheetLockDay: 'monday',
        timesheetLockTime: '18:00',
        allowEditAfterSubmission: false,
        requireManagerApproval: true
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'overall'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.compliance) {
            setCompliance(data.compliance)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ compliance }),
        onSuccess: () => {
            toast.success('Compliance rules saved!')
            qc.invalidateQueries(['settings', 'overall'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setCompliance(f => ({ ...f, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Compliance & Locks</h2>
                <p className="text-sm text-slate-400">Enforce deadlines and prevent historical data modification</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Timesheet Freezing" subtitle="Automated lockout for previous weeks" icon={FileLock}>
                    <div className="space-y-4">
                        <div>
                            <label className="label">Lock Day</label>
                            <div className="grid grid-cols-2 gap-3 mt-1">
                                {['monday', 'tuesday', 'friday', 'sunday'].map(day => (
                                    <button
                                        key={day}
                                        onClick={() => upd('timesheetLockDay', day)}
                                        className={`py-2 rounded-xl border capitalize text-sm font-semibold transition-all ${compliance.timesheetLockDay === day
                                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400'
                                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="label">Lock Time</label>
                            <input
                                type="time"
                                className="input w-full font-bold font-mono"
                                value={compliance.timesheetLockTime || '18:00'}
                                onChange={e => upd('timesheetLockTime', e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 mt-2 italic">
                                E.g., Locking on "Monday" at "18:00" prevents edits for the previous week after Monday 6 PM.
                            </p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Submission Rules" subtitle="Approval and revision workflows" icon={FileWarning}>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                            <div className="pr-4">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    <CalendarCheck size={14} className="text-emerald-500" /> Require Manager Approval
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                    If disabled, submitted timesheets automatically become Approved.
                                </p>
                            </div>
                            <button onClick={() => upd('requireManagerApproval', !compliance.requireManagerApproval)}
                                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${compliance.requireManagerApproval ? 'bg-primary' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${compliance.requireManagerApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                            <div className="pr-4">
                                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                                    Allow Edit After Submission
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                                    Lets users recall/edit timesheets that are pending approval.
                                </p>
                            </div>
                            <button onClick={() => upd('allowEditAfterSubmission', !compliance.allowEditAfterSubmission)}
                                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${compliance.allowEditAfterSubmission ? 'bg-amber-500' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${compliance.allowEditAfterSubmission ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </SectionCard>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all"
                >
                    {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={16} />}
                    Save Changes
                </button>
            </div>
        </div>
    )
}
