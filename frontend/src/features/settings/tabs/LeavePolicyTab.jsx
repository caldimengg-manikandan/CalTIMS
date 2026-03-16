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
    const [eligibleLeaveTypes, setEligibleLeaveTypes] = React.useState([])
    const [policy, setPolicy] = React.useState({
        annualLeaveDays: 20,
        sickLeaveDays: 10,
        casualLeaveDays: 6,
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
            setEligibleLeaveTypes(data.leavePolicy.eligibleLeaveTypes || [])
            setPolicy({
                annualLeaveDays: data.leavePolicy.annualLeaveDays || 20,
                sickLeaveDays: data.leavePolicy.sickLeaveDays || 10,
                casualLeaveDays: data.leavePolicy.casualLeaveDays || 6,
                maxCarryForward: data.leavePolicy.maxCarryForward || 5,
                approvalWorkflow: data.leavePolicy.approvalWorkflow || 'Employee -> Manager'
            })
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            leavePolicy: {
                leaveTypes,
                eligibleLeaveTypes,
                ...policy
            }
        }),
        onSuccess: () => {
            qc.invalidateQueries(['settings'])
            toast.success('Leave Policy updated successfully!')
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setPolicy(f => ({ ...f, [k]: v }))

    const toggleEligibility = (type) => {
        const lower = type.toLowerCase();
        if (eligibleLeaveTypes.includes(lower)) {
            setEligibleLeaveTypes(eligibleLeaveTypes.filter(t => t !== lower))
        } else {
            setEligibleLeaveTypes([...eligibleLeaveTypes, lower])
        }
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Leave Policy</h2>
                <p className="text-sm text-slate-500 font-medium">Configure global rules for employee time-off and entitlements</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Management & Workflow */}
                <div className="lg:col-span-8 space-y-8">
                    <SectionCard title="Leave Library" subtitle="Define the range of time-off categories available" icon={Briefcase}>
                        <div className="space-y-8">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 block">Defined Categories & Eligibility</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {leaveTypes.map((cat, i) => (
                                        <div 
                                            key={i} 
                                            className={`relative group p-4 rounded-3xl border-2 transition-all ${eligibleLeaveTypes.includes(cat.toLowerCase()) ? 'border-primary/50 bg-primary/5 dark:bg-primary/10' : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5'}`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-xs font-black text-slate-800 dark:text-white truncate pr-6">{cat}</h4>
                                                <button 
                                                    onClick={() => setLeaveTypes(leaveTypes.filter((_, idx) => idx !== i))}
                                                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-all"
                                                >
                                                    <CalendarOff size={14} />
                                                </button>
                                            </div>
                                            
                                            <button 
                                                onClick={() => toggleEligibility(cat)}
                                                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[9px] font-bold uppercase transition-all ${eligibleLeaveTypes.includes(cat.toLowerCase()) 
                                                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                                                    : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}
                                            >
                                                <div className={`w-1.5 h-1.5 rounded-full ${eligibleLeaveTypes.includes(cat.toLowerCase()) ? 'bg-white' : 'bg-slate-400'}`} />
                                                {eligibleLeaveTypes.includes(cat.toLowerCase()) ? 'Deductible' : 'Unpaid/Static'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <AddChipInput
                                placeholder="Add custom type (e.g. Bereavement, Comp Off)..."
                                onAdd={(val) => {
                                    if (!leaveTypes.some(t => t.toLowerCase() === val.toLowerCase())) {
                                        setLeaveTypes([...leaveTypes, val])
                                    } else {
                                        toast.error('Category already exists')
                                    }
                                }}
                            />
                            
                            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-primary/5 border border-indigo-100 dark:border-primary/10 flex items-start gap-4">
                                <Settings2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                                    <span className="font-bold text-primary">Pro-tip:</span> Marking a category as <span className="font-bold text-primary">Deductible</span> ensures it tracks against an employee's annual, sick, or casual allowance pool.
                                </p>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Entitlement Workflow" subtitle="Governance for leave processing and approvals" icon={Settings2}>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 block">Approval Routing</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { id: 'Employee -> Manager', sub: 'Standard two-tier oversight', tier: '2-TIER' },
                                        { id: 'Employee -> Manager -> HR', sub: 'Strict triple-verification policy', tier: '3-TIER' }
                                    ].map(flow => (
                                        <button
                                            key={flow.id}
                                            onClick={() => upd('approvalWorkflow', flow.id)}
                                            className={`relative group p-6 rounded-[2rem] border-2 text-left transition-all ${policy.approvalWorkflow === flow.id
                                                ? 'border-primary bg-primary/10 dark:bg-primary/10'
                                                : 'border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/5 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <p className={`text-sm font-black tracking-tight ${policy.approvalWorkflow === flow.id ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>{flow.id}</p>
                                                {policy.approvalWorkflow === flow.id && (
                                                    <div className="px-2 py-0.5 rounded-lg bg-primary text-white text-[8px] font-black uppercase">{flow.tier}</div>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 font-medium">{flow.sub}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column: Allowances & Rules */}
                <div className="lg:col-span-4 space-y-8">
                    <SectionCard title="Standard Allowances" subtitle="Yearly entitlement pools" icon={Save}>
                        <div className="space-y-10 py-4">
                            {[
                                { label: 'Paid Vacation', key: 'annualLeaveDays', max: 40, color: '#6366f1' },
                                { label: 'Medical / Sick', key: 'sickLeaveDays', max: 30, color: '#ec4899' },
                                { label: 'Personal / Casual', key: 'casualLeaveDays', max: 15, color: '#f59e0b' }
                            ].map(item => (
                                <div key={item.key}>
                                    <div className="flex justify-between items-end mb-5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</label>
                                        <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/10 text-[10px] font-black text-slate-700 dark:text-white border border-slate-200 dark:border-white/10">{policy[item.key]} DAYS</span>
                                    </div>
                                    <input
                                        type="range" min={0} max={item.max} step={1}
                                        value={policy[item.key]}
                                        onChange={e => upd(item.key, parseInt(e.target.value))}
                                        className="w-full accent-primary cursor-pointer"
                                        style={{ accentColor: item.color }}
                                    />
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard title="Carry Forward" subtitle="Year-end balance rollover" icon={CalendarOff}>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3 block">Rollover Capacity</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="input h-14 w-full text-base font-black px-6 bg-slate-50/50 dark:bg-white/5 !rounded-2xl"
                                        value={policy.maxCarryForward}
                                        onChange={e => upd('maxCarryForward', Number(e.target.value))}
                                    />
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none uppercase tracking-widest">Days / Year</div>
                                </div>
                            </div>
                            <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-black uppercase tracking-widest mb-2">Fiscal Year Rule</p>
                                <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 font-medium leading-relaxed">
                                    Eligible leave types allow balance transfers up to this limit. Overages are purged on April 1st.
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
                    className="flex items-center gap-3 px-10 py-5 rounded-3xl btn-primary hover:bg-primary-700 text-white font-black uppercase tracking-widest shadow-2xl shadow-primary/40 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={20} />}
                    Authorize Changes
                </button>
            </div>
        </div>
    )
}
