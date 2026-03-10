import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, CalendarOff, Settings2, Save } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

export default function LeavePolicyTab() {
    const qc = useQueryClient()
    const [leaveTypes, setLeaveTypes] = useState([])
    const [policy, setPolicy] = useState({
        annualLeaveDays: 20,
        sickLeaveDays: 10,
        maxCarryForward: 5,
        approvalWorkflow: 'Employee -> Manager'
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.leavePolicy) {
            setLeaveTypes(data.leavePolicy.leaveTypes || [])
            setPolicy({
                annualLeaveDays: data.leavePolicy.annualLeaveDays || 20,
                sickLeaveDays: data.leavePolicy.sickLeaveDays || 10,
                maxCarryForward: data.leavePolicy.maxCarryForward || 5,
                approvalWorkflow: data.leavePolicy.approvalWorkflow || 'Employee -> Manager'
            })
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            leavePolicy: {
                leaveTypes,
                ...policy
            }
        }),
        onSuccess: () => {
            toast.success('Leave Policy saved!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setPolicy(f => ({ ...f, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Leave Policy</h2>
                <p className="text-sm text-slate-500 font-medium">Configure global rules for employee time-off requests</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Leave Catalog */}
                <div className="lg:col-span-2 space-y-8">
                    <SectionCard title="Leave Types" subtitle="Manage available categories for requests" icon={Briefcase}>
                        <div className="flex flex-wrap gap-2.5 mb-6">
                            {leaveTypes.map((cat, i) => (
                                <Chip
                                    key={i}
                                    label={cat}
                                    onRemove={() => setLeaveTypes(leaveTypes.filter((_, idx) => idx !== i))}
                                />
                            ))}
                        </div>
                        <AddChipInput
                            placeholder="e.g. Bereavement, Jury Duty..."
                            onAdd={(val) => {
                                if (!leaveTypes.includes(val)) setLeaveTypes([...leaveTypes, val])
                                else toast.error('Category already exists')
                            }}
                        />
                    </SectionCard>

                    <SectionCard title="Entitlement Workflow" subtitle="Governance for leave processing" icon={Settings2}>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Approval Routing</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {['Employee -> Manager', 'Employee -> Manager -> HR'].map(flow => (
                                        <button
                                            key={flow}
                                            onClick={() => upd('approvalWorkflow', flow)}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all ${policy.approvalWorkflow === flow
                                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm'
                                                : 'border-slate-100 dark:border-white/5 text-slate-500 hover:border-slate-300'
                                                }`}
                                        >
                                            <p className="text-xs font-black tracking-tight">{flow}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                {flow.includes('HR') ? 'Three-tier oversight' : 'Direct line manager approval'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Allowances & Balance */}
                <div className="space-y-8">
                    <SectionCard title="Annual Allowances" subtitle="Standard yearly allocations" icon={Save}>
                        <div className="space-y-5">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Annual Leave</label>
                                    <span className="text-[11px] font-black text-indigo-600">{policy.annualLeaveDays} Days</span>
                                </div>
                                <input
                                    type="range" min={0} max={40} step={1}
                                    value={policy.annualLeaveDays}
                                    onChange={e => upd('annualLeaveDays', parseInt(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sick Leave</label>
                                    <span className="text-[11px] font-black text-indigo-600">{policy.sickLeaveDays} Days</span>
                                </div>
                                <input
                                    type="range" min={0} max={30} step={1}
                                    value={policy.sickLeaveDays}
                                    onChange={e => upd('sickLeaveDays', parseInt(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Carry Forward" subtitle="Year-end balance rules" icon={CalendarOff}>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Max Carryover Days</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        max="365"
                                        className="input h-11 flex-1 text-sm font-bold"
                                        value={policy.maxCarryForward}
                                        onChange={e => upd('maxCarryForward', Number(e.target.value))}
                                    />
                                    <span className="text-xs text-slate-400 font-medium">Days / Year</span>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                Balances exceeding this limit will be reset at the start of the next fiscal year.
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>

            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Update Policy
                </button>
            </div>
        </div>
    )
}
