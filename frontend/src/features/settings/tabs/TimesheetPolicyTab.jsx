import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, Clock, Users, Settings2, Save, ShieldCheck, CalendarClock } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard, Chip, AddChipInput } from '../components/SharedUI'

export default function TimesheetPolicyTab() {
    const qc = useQueryClient()
    const [taskCategories, setTaskCategories] = React.useState([])
    const [policy, setPolicy] = React.useState({
        submissionDeadline: 'Friday 18:00',
        freezeTimesheet: 'Monday 18:00',
        allowEditAfterSubmission: false,
        managerApprovalRequired: true,
        minHoursPerDay: 4,
        maxHoursPerDay: 12,
        enforceMinHoursOnSubmit: false,
        permissionMaxHoursPerDay: 2,
        permissionMaxDaysPerWeek: 1,
        permissionMaxDaysPerMonth: 4,
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    React.useEffect(() => {
        if (data?.timesheet) {
            setTaskCategories(data.timesheet.taskCategories || [])
            setPolicy({
                submissionDeadline: data.timesheet.submissionDeadline || 'Friday 18:00',
                freezeTimesheet: data.timesheet.freezeTimesheet || 'Monday 18:00',
                allowEditAfterSubmission: !!data.timesheet.allowEditAfterSubmission,
                managerApprovalRequired: !!data.timesheet.managerApprovalRequired,
                minHoursPerDay: data.timesheet.minHoursPerDay ?? 4,
                maxHoursPerDay: data.timesheet.maxHoursPerDay ?? 12,
                enforceMinHoursOnSubmit: !!data.timesheet.enforceMinHoursOnSubmit,
                permissionMaxHoursPerDay: data.timesheet.permissionMaxHoursPerDay ?? 2,
                permissionMaxDaysPerWeek: data.timesheet.permissionMaxDaysPerWeek ?? 1,
                permissionMaxDaysPerMonth: data.timesheet.permissionMaxDaysPerMonth ?? 4,
            })
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            timesheet: {
                taskCategories,
                ...policy
            }
        }),
        onSuccess: () => {
            toast.success('Timesheet policies updated!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setPolicy(p => ({ ...p, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Timesheet Policies</h2>
                <p className="text-sm text-slate-500 font-medium">Control entry rules, approval workflows, and limits</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Governance & Catalog */}
                <div className="lg:col-span-8 space-y-8">
                    <SectionCard title="Task Catalog" subtitle="Manage available categories for time entries" icon={LayoutGrid}>
                        <div className="flex flex-wrap gap-2.5 mb-6">
                            {taskCategories.map((cat, i) => (
                                <Chip
                                    key={i}
                                    label={cat}
                                    onRemove={() => setTaskCategories(taskCategories.filter((_, idx) => idx !== i))}
                                />
                            ))}
                        </div>
                        <AddChipInput
                            placeholder="e.g. Code Review, Client Meeting..."
                            onAdd={(val) => {
                                if (!taskCategories.includes(val)) setTaskCategories([...taskCategories, val])
                                else toast.error('Category already exists')
                            }}
                        />
                        <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-start gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary0 mt-1.5" />
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                System categories are globally indexed. Adding specific tags helps in granular productivity reporting and expense tracking.
                            </p>
                        </div>
                    </SectionCard>

                    {/* <SectionCard title="Workflow & Approvals" subtitle="Governance for submission and editing" icon={Users}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="group flex items-center justify-between p-5 rounded-3xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:border-primary0/30 transition-all">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-white mb-1">Manager Approval</p>
                                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">Required before final processing</p>
                                </div>
                                <button
                                    onClick={() => upd('managerApprovalRequired', !policy.managerApprovalRequired)}
                                    className={`relative w-11 h-6 rounded-full transition-all flex items-center px-1 ${policy.managerApprovalRequired ? 'btn-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${policy.managerApprovalRequired ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="group flex items-center justify-between p-5 rounded-3xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:border-primary0/30 transition-all">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-white mb-1">Edit Post-Submit</p>
                                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">Allow modifications to locked entries</p>
                                </div>
                                <button
                                    onClick={() => upd('allowEditAfterSubmission', !policy.allowEditAfterSubmission)}
                                    className={`relative w-11 h-6 rounded-full transition-all flex items-center px-1 ${policy.allowEditAfterSubmission ? 'btn-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${policy.allowEditAfterSubmission ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </SectionCard> */}

                    {/* Permission Log */}
                    <SectionCard title="Permission Log" subtitle="Configure limits for permission row entries" icon={CalendarClock}>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Per-day permission hours */}
                            <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Per-Day Hrs</p>
                                        <p className="text-[10px] text-slate-500 font-medium">Max hours allowed per permission day</p>
                                    </div>
                                    <span className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-500/10 text-[10px] font-black text-amber-600 dark:text-amber-400 shrink-0">
                                        {policy.permissionMaxHoursPerDay} HRS
                                    </span>
                                </div>
                                <input
                                    type="range" min={0.5} max={8} step={0.5}
                                    value={policy.permissionMaxHoursPerDay}
                                    onChange={e => upd('permissionMaxHoursPerDay', parseFloat(e.target.value))}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                                    <span>0.5h</span><span>8h</span>
                                </div>
                            </div>

                            {/* Max days per week */}
                            <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Days / Week</p>
                                        <p className="text-[10px] text-slate-500 font-medium">Max permission days per week</p>
                                    </div>
                                    <span className="px-2 py-1 rounded bg-primary-100/50 dark:bg-primary-500/10 text-[10px] font-black text-primary-700 dark:text-primary-400 shrink-0">
                                        {policy.permissionMaxDaysPerWeek === 0 ? '∞' : `${policy.permissionMaxDaysPerWeek}d`}
                                    </span>
                                </div>
                                <input
                                    type="range" min={0} max={5} step={1}
                                    value={policy.permissionMaxDaysPerWeek}
                                    onChange={e => upd('permissionMaxDaysPerWeek', parseInt(e.target.value))}
                                    className="w-full accent-primary cursor-pointer"
                                />
                                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                                    <span>Unlimited</span><span>5 days</span>
                                </div>
                            </div>

                            {/* Max days per month */}
                            <div className="p-5 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Days / Month</p>
                                        <p className="text-[10px] text-slate-500 font-medium">Max permission days per month</p>
                                    </div>
                                    <span className="px-2 py-1 rounded bg-primary-100/50 dark:bg-primary-500/10 text-[10px] font-black text-primary-700 dark:text-primary-400 shrink-0">
                                        {policy.permissionMaxDaysPerMonth === 0 ? '∞' : `${policy.permissionMaxDaysPerMonth}d`}
                                    </span>
                                </div>
                                <input
                                    type="range" min={0} max={20} step={1}
                                    value={policy.permissionMaxDaysPerMonth}
                                    onChange={e => upd('permissionMaxDaysPerMonth', parseInt(e.target.value))}
                                    className="w-full accent-primary cursor-pointer"
                                />
                                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                                    <span>Unlimited</span><span>20 days</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20 flex items-start gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                Permission limits are enforced both on the entry form (real-time) and at save/submission time.
                                Set a value to <strong>0</strong> for no limit on that dimension.
                            </p>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column: Deadlines & Ranges */}
                <div className="lg:col-span-4 space-y-8">
                    <SectionCard title="Submission Rules" subtitle="Time-based entry controls" icon={Clock}>
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Weekly Deadline</label>
                                <input
                                    className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    value={policy.submissionDeadline}
                                    onChange={e => upd('submissionDeadline', e.target.value)}
                                    placeholder="Friday 18:00"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Auto-Lock Schedule</label>
                                <input
                                    className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    value={policy.freezeTimesheet}
                                    onChange={e => upd('freezeTimesheet', e.target.value)}
                                    placeholder="Monday 10:00"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Daily Guardrails" subtitle="Hour entry constraints" icon={Settings2}>
                        <div className="space-y-8 py-2">
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min Threshold</label>
                                    <span className="px-2 py-1 rounded bg-primary-100/50 dark:bg-primary-500/10 text-[10px] font-black text-primary-700 dark:text-primary-400">{policy.minHoursPerDay} HRS</span>
                                </div>
                                <input
                                    type="range" min={0} max={8} step={0.5}
                                    value={policy.minHoursPerDay}
                                    onChange={e => upd('minHoursPerDay', parseFloat(e.target.value))}
                                    className="w-full accent-primary cursor-pointer"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Capacity</label>
                                    <span className="px-2 py-1 rounded bg-primary-100/50 dark:bg-primary-500/10 text-[10px] font-black text-primary-700 dark:text-primary-400">{policy.maxHoursPerDay} HRS</span>
                                </div>
                                <input
                                    type="range" min={8} max={24} step={0.5}
                                    value={policy.maxHoursPerDay}
                                    onChange={e => upd('maxHoursPerDay', parseFloat(e.target.value))}
                                    className="w-full accent-primary cursor-pointer"
                                />
                            </div>

                            {/* Enforce on Submit toggle */}
                            <div className="pt-4 border-t border-slate-100 dark:border-white/10">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Hard Enforcement</p>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${policy.enforceMinHoursOnSubmit ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-600'}`}>
                                                {policy.enforceMinHoursOnSubmit ? 'ACTIVE' : 'INACTIVE'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                            Strictly block submission if daily hours don't meet thresholds.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => upd('enforceMinHoursOnSubmit', !policy.enforceMinHoursOnSubmit)}
                                        className={`relative w-12 h-6 rounded-full transition-all flex items-center px-1 shadow-inner ${policy.enforceMinHoursOnSubmit ? 'bg-rose-500 shadow-rose-900/20' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    >
                                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform ${policy.enforceMinHoursOnSubmit ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                
                                <div className={`mt-4 p-3 rounded-xl border transition-all ${policy.enforceMinHoursOnSubmit 
                                    ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 opacity-100' 
                                    : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 opacity-60'}`}>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-500 font-semibold leading-relaxed flex items-start gap-2">
                                        <ShieldCheck size={12} className={policy.enforceMinHoursOnSubmit ? 'text-rose-500 mt-0.5' : 'text-slate-500 mt-0.5'} />
                                        <span>
                                            {policy.enforceMinHoursOnSubmit 
                                                ? <><strong>Submission Locked:</strong> Employees cannot submit if any worked day is below <strong>{policy.minHoursPerDay}h</strong> or above <strong>{policy.maxHoursPerDay}h</strong>.</>
                                                : <><strong>Soft Warning:</strong> Limits will be shown as warnings but won't block submission.</>
                                            }
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>

            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl btn-primary hover:btn-primary hover:bg-primary-700 text-white font-black uppercase tracking-widest shadow-xl shadow-primary/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Enforce Policies
                </button>
            </div>
        </div>
    )
}
