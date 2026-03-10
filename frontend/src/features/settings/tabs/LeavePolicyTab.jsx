import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Briefcase, CalendarOff, Settings2, Save } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard, Chip, AddChipInput } from '../components/SharedUI'

export default function LeavePolicyTab() {
    const qc = useQueryClient()
    const [leaveTypes, setLeaveTypes] = React.useState([])
    const [policy, setPolicy] = React.useState({
        annualLeaveDays: 20,
        sickLeaveDays: 10,
        maxCarryForward: 5,
        approvalWorkflow: 'Employee -> Manager'
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    React.useEffect(() => {
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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Management & Workflow */}
                <div className="lg:col-span-8 space-y-8">
                    <SectionCard title="Leave Types" subtitle="Manage available categories for time-off requests" icon={Briefcase}>
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
                            placeholder="e.g. Bereavement, Jury Duty, Paternity..."
                            onAdd={(val) => {
                                if (!leaveTypes.includes(val)) setLeaveTypes([...leaveTypes, val])
                                else toast.error('Category already exists')
                            }}
                        />
                        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-start gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Defining leave types here permits employees to select them in their request forms. Each type can be tracked independently in resource planning.
                            </p>
                        </div>
                    </SectionCard>

                    <SectionCard title="Entitlement Workflow" subtitle="Governance for leave processing and approvals" icon={Settings2}>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Approval Routing</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { id: 'Employee -> Manager', sub: 'Standard two-tier oversight', tier: '2-TIER' },
                                        { id: 'Employee -> Manager -> HR', sub: 'Strict triple-verification policy', tier: '3-TIER' }
                                    ].map(flow => (
                                        <button
                                            key={flow.id}
                                            onClick={() => upd('approvalWorkflow', flow.id)}
                                            className={`relative group p-5 rounded-3xl border-2 text-left transition-all ${policy.approvalWorkflow === flow.id
                                                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                                                : 'border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-black/10 text-slate-500 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-sm font-black tracking-tight">{flow.id}</p>
                                                {policy.approvalWorkflow === flow.id && (
                                                    <div className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[8px] font-black">{flow.tier}</div>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">{flow.sub}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column: Allowances & Rules */}
                <div className="lg:col-span-4 space-y-8">
                    <SectionCard title="Standard Allowances" subtitle="Monthly/Yearly configurations" icon={Save}>
                        <div className="space-y-8 py-2">
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Paid Vacation</label>
                                    <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400">{policy.annualLeaveDays} DAYS</span>
                                </div>
                                <input
                                    type="range" min={0} max={40} step={1}
                                    value={policy.annualLeaveDays}
                                    onChange={e => upd('annualLeaveDays', parseInt(e.target.value))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Medical / Sick</label>
                                    <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-500/10 text-[10px] font-black text-indigo-600 dark:text-indigo-400">{policy.sickLeaveDays} DAYS</span>
                                </div>
                                <input
                                    type="range" min={0} max={30} step={1}
                                    value={policy.sickLeaveDays}
                                    onChange={e => upd('sickLeaveDays', parseInt(e.target.value))}
                                    className="w-full accent-indigo-600 cursor-pointer"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Carry Forward" subtitle="Year-end balance rollover" icon={CalendarOff}>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Rollover Capacity</label>
                                <div className="flex items-center gap-4">
                                    <div className="relative flex-1">
                                        <input
                                            type="number"
                                            className="input h-12 w-full text-sm font-black pl-5 bg-slate-50/50 dark:bg-white/5"
                                            value={policy.maxCarryForward}
                                            onChange={e => upd('maxCarryForward', Number(e.target.value))}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 pointer-events-none">DAYS</div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-black uppercase tracking-widest mb-1">Fiscal Year Rule</p>
                                <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 font-medium leading-relaxed">
                                    Remaining balances exceeding this cap will be automatically purged during the year-end transition.
                                </p>
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
