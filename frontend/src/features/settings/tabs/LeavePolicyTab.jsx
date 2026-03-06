import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, CalendarOff, Settings2, Save } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

export default function LeavePolicyTab() {
    const qc = useQueryClient()
    const [policy, setPolicy] = useState({
        allowNegativeBalance: false,
        requireReason: true,
        autoApproveDays: 0,
        maxConsecutiveDays: 14,
        noticePeriodDays: 7
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'overall'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.leavePolicy) {
            setPolicy(data.leavePolicy)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ leavePolicy: policy }),
        onSuccess: () => {
            toast.success('Leave Policy saved!')
            qc.invalidateQueries(['settings', 'overall'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setPolicy(f => ({ ...f, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Leave Policy</h2>
                <p className="text-sm text-slate-400">Configure global rules for employee time-off requests</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Request Rules" subtitle="Constraints on when and how leaves are requested" icon={CalendarOff}>
                    <div className="space-y-4">
                        <div>
                            <label className="label mb-1.5 block">Notice Period</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={policy.noticePeriodDays}
                                    onChange={e => upd('noticePeriodDays', Number(e.target.value))}
                                />
                                <span className="text-xs text-slate-400 font-medium">Days prior</span>
                            </div>
                        </div>
                        <div>
                            <label className="label mb-1.5 block">Max Consecutive Days</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    className="input flex-1 text-sm font-bold"
                                    value={policy.maxConsecutiveDays}
                                    onChange={e => upd('maxConsecutiveDays', Number(e.target.value))}
                                />
                                <span className="text-xs text-slate-400 font-medium">Days</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/10 mt-4">
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-white">Require Reason</p>
                                <p className="text-[10px] text-slate-400">Enforce comments on leave requests</p>
                            </div>
                            <button onClick={() => upd('requireReason', !policy.requireReason)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${policy.requireReason ? 'bg-primary' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${policy.requireReason ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Approval & Balance" subtitle="Automations and deduction rules" icon={Settings2}>
                    <div className="space-y-4">
                        <div>
                            <label className="label mb-1.5 block">Auto-Approve Requests</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={policy.autoApproveDays}
                                    onChange={e => upd('autoApproveDays', Number(e.target.value))}
                                    placeholder="0 to disable"
                                />
                                <span className="text-xs text-slate-400 font-medium">Days or less</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 italic">Set to 0 to require manager approval for all leaves.</p>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white/10 mt-6">
                            <div>
                                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Negative Balances</p>
                                <p className="text-[10px] text-slate-400">Allow users to take unearned leave</p>
                            </div>
                            <button onClick={() => upd('allowNegativeBalance', !policy.allowNegativeBalance)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${policy.allowNegativeBalance ? 'bg-rose-500' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${policy.allowNegativeBalance ? 'translate-x-5' : 'translate-x-0'}`} />
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
