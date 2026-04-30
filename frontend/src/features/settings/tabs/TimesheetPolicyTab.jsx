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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Timesheet Policies</h2>
                    <p className="text-sm text-slate-500 font-medium">Control entry rules, approval workflows, and limits</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start mb-12">
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
                        maxLength={50}
                        onAdd={(val) => {
                            if (!taskCategories.includes(val)) setTaskCategories([...taskCategories, val])
                            else toast.error('Category already exists')
                        }}
                    />
                </SectionCard>

                <SectionCard title="Submission Rules" subtitle="Time-based entry controls" icon={Clock}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                <SectionCard title="Permission Log" subtitle="Configure limits for permission row entries" icon={CalendarClock}>
                    <div className="space-y-6">
                        <div className="p-6 rounded-3xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 group transition-all hover:bg-white dark:hover:bg-white/[0.07] hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-none">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Per-Day Maximum</p>
                                    <p className="text-[10px] text-slate-400 font-medium">Cap on daily permission entries</p>
                                </div>
                                <div className="bg-amber-500 px-3 py-1.5 rounded-xl shadow-lg shadow-amber-500/20">
                                    <span className="text-[11px] font-black text-white">{policy.permissionMaxHoursPerDay} HRS</span>
                                </div>
                            </div>
                            
                            <div className="relative px-2">
                                <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full flex justify-between px-2 pointer-events-none">
                                    {[0, 2, 4, 6, 8].map(h => (
                                        <div key={h} className="relative flex flex-col items-center">
                                            <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${policy.permissionMaxHoursPerDay >= h ? 'bg-amber-500 scale-125 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-slate-200 dark:bg-white/10'}`} />
                                            <span className={`absolute top-4 text-[8px] font-black transition-colors ${Math.round(policy.permissionMaxHoursPerDay) === h ? 'text-amber-600' : 'text-slate-300 dark:text-slate-600'}`}>
                                                {h}H
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <input
                                    type="range" min={0.5} max={8} step={0.5}
                                    value={policy.permissionMaxHoursPerDay}
                                    onChange={e => upd('permissionMaxHoursPerDay', parseFloat(e.target.value))}
                                    className="relative w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer z-10 accent-amber-500
                                        [&::-webkit-slider-thumb]:appearance-none 
                                        [&::-webkit-slider-thumb]:w-5 
                                        [&::-webkit-slider-thumb]:h-5 
                                        [&::-webkit-slider-thumb]:rounded-full 
                                        [&::-webkit-slider-thumb]:bg-slate-900 
                                        [&::-webkit-slider-thumb]:dark:bg-white 
                                        [&::-webkit-slider-thumb]:border-4 
                                        [&::-webkit-slider-thumb]:border-amber-500 
                                        [&::-webkit-slider-thumb]:shadow-lg 
                                        [&::-webkit-slider-thumb]:hover:scale-110 
                                        [&::-webkit-slider-thumb]:transition-all
                                        [&::-webkit-slider-runnable-track]:bg-transparent"
                                    style={{
                                        background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(policy.permissionMaxHoursPerDay - 0.5) / 7.5 * 100}%, transparent ${(policy.permissionMaxHoursPerDay - 0.5) / 7.5 * 100}%, transparent 100%)`
                                    }}
                                />
                            </div>
                            <div className="mt-8" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Max days per week */}
                            <div className="p-5 rounded-3xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 group transition-all hover:bg-white dark:hover:bg-white/[0.07]">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Weekly Limit</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Max days / week</p>
                                    </div>
                                    <div className="bg-primary px-3 py-1 rounded-xl shadow-lg shadow-primary/20">
                                        <span className="text-[11px] font-black text-white">
                                            {policy.permissionMaxDaysPerWeek === 0 ? '∞' : `${policy.permissionMaxDaysPerWeek}D`}
                                        </span>
                                    </div>
                                </div>

                                <div className="relative px-2">
                                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full flex justify-between px-2 pointer-events-none">
                                        {[0, 1, 2, 3, 4, 5].map(h => (
                                            <div key={h} className="relative flex flex-col items-center">
                                                <div className={`w-1 h-1 rounded-full transition-all duration-500 ${policy.permissionMaxDaysPerWeek >= h ? 'bg-primary scale-125' : 'bg-slate-200 dark:bg-white/10'}`} />
                                            </div>
                                        ))}
                                    </div>

                                    <input
                                        type="range" min={0} max={5} step={1}
                                        value={policy.permissionMaxDaysPerWeek}
                                        onChange={e => upd('permissionMaxDaysPerWeek', parseInt(e.target.value))}
                                        className="relative w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer z-10 accent-primary
                                            [&::-webkit-slider-thumb]:appearance-none 
                                            [&::-webkit-slider-thumb]:w-4 
                                            [&::-webkit-slider-thumb]:h-4 
                                            [&::-webkit-slider-thumb]:rounded-full 
                                            [&::-webkit-slider-thumb]:bg-slate-900 
                                            [&::-webkit-slider-thumb]:dark:bg-white 
                                            [&::-webkit-slider-thumb]:border-2 
                                            [&::-webkit-slider-thumb]:border-primary 
                                            [&::-webkit-slider-thumb]:shadow-lg 
                                            [&::-webkit-slider-thumb]:hover:scale-110 
                                            [&::-webkit-slider-thumb]:transition-all
                                            [&::-webkit-slider-runnable-track]:bg-transparent"
                                        style={{
                                            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${policy.permissionMaxDaysPerWeek / 5 * 100}%, transparent ${policy.permissionMaxDaysPerWeek / 5 * 100}%, transparent 100%)`
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-[8px] font-bold text-slate-300 mt-4 px-1 uppercase tracking-tighter">
                                    <span>∞</span><span>5D</span>
                                </div>
                            </div>

                            {/* Max days per month */}
                            <div className="p-5 rounded-3xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 group transition-all hover:bg-white dark:hover:bg-white/[0.07]">
                                <div className="flex justify-between items-start mb-8">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Monthly Limit</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Max days / month</p>
                                    </div>
                                    <div className="bg-primary px-3 py-1 rounded-xl shadow-lg shadow-primary/20">
                                        <span className="text-[11px] font-black text-white">
                                            {policy.permissionMaxDaysPerMonth === 0 ? '∞' : `${policy.permissionMaxDaysPerMonth}D`}
                                        </span>
                                    </div>
                                </div>

                                <div className="relative px-2">
                                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full flex justify-between px-2 pointer-events-none">
                                        {[0, 5, 10, 15, 20].map(h => (
                                            <div key={h} className="relative flex flex-col items-center">
                                                <div className={`w-1 h-1 rounded-full transition-all duration-500 ${policy.permissionMaxDaysPerMonth >= h ? 'bg-primary scale-125' : 'bg-slate-200 dark:bg-white/10'}`} />
                                            </div>
                                        ))}
                                    </div>

                                    <input
                                        type="range" min={0} max={20} step={1}
                                        value={policy.permissionMaxDaysPerMonth}
                                        onChange={e => upd('permissionMaxDaysPerMonth', parseInt(e.target.value))}
                                        className="relative w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer z-10 accent-primary
                                            [&::-webkit-slider-thumb]:appearance-none 
                                            [&::-webkit-slider-thumb]:w-4 
                                            [&::-webkit-slider-thumb]:h-4 
                                            [&::-webkit-slider-thumb]:rounded-full 
                                            [&::-webkit-slider-thumb]:bg-slate-900 
                                            [&::-webkit-slider-thumb]:dark:bg-white 
                                            [&::-webkit-slider-thumb]:border-2 
                                            [&::-webkit-slider-thumb]:border-primary 
                                            [&::-webkit-slider-thumb]:shadow-lg 
                                            [&::-webkit-slider-thumb]:hover:scale-110 
                                            [&::-webkit-slider-thumb]:transition-all
                                            [&::-webkit-slider-runnable-track]:bg-transparent"
                                        style={{
                                            background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${policy.permissionMaxDaysPerMonth / 20 * 100}%, transparent ${policy.permissionMaxDaysPerMonth / 20 * 100}%, transparent 100%)`
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-[8px] font-bold text-slate-300 mt-4 px-1 uppercase tracking-tighter">
                                    <span>∞</span><span>20D</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Daily Guardrails" subtitle="Hour entry constraints" icon={Settings2}>
                    <div className="space-y-8 py-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min Threshold</label>
                                    <div className="bg-indigo-600 px-3 py-1 rounded-xl shadow-lg shadow-indigo-500/20">
                                        <span className="text-[11px] font-black text-white">{policy.minHoursPerDay} HRS</span>
                                    </div>
                                </div>
                                
                                <div className="relative px-2">
                                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full flex justify-between px-2 pointer-events-none">
                                        {[0, 2, 4, 6, 8].map(h => (
                                            <div key={h} className="relative flex flex-col items-center">
                                                <div className={`w-1 h-1 rounded-full transition-all duration-500 ${policy.minHoursPerDay >= h ? 'bg-indigo-600 scale-125 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-200 dark:bg-white/10'}`} />
                                            </div>
                                        ))}
                                    </div>

                                    <input
                                        type="range" min={0} max={8} step={0.5}
                                        value={policy.minHoursPerDay}
                                        onChange={e => upd('minHoursPerDay', parseFloat(e.target.value))}
                                        className="relative w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer z-10 accent-indigo-600
                                            [&::-webkit-slider-thumb]:appearance-none 
                                            [&::-webkit-slider-thumb]:w-4 
                                            [&::-webkit-slider-thumb]:h-4 
                                            [&::-webkit-slider-thumb]:rounded-full 
                                            [&::-webkit-slider-thumb]:bg-slate-900 
                                            [&::-webkit-slider-thumb]:dark:bg-white 
                                            [&::-webkit-slider-thumb]:border-2 
                                            [&::-webkit-slider-thumb]:border-indigo-600 
                                            [&::-webkit-slider-thumb]:shadow-lg 
                                            [&::-webkit-slider-thumb]:hover:scale-110 
                                            [&::-webkit-slider-thumb]:transition-all
                                            [&::-webkit-slider-runnable-track]:bg-transparent"
                                        style={{
                                            background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${policy.minHoursPerDay / 8 * 100}%, transparent ${policy.minHoursPerDay / 8 * 100}%, transparent 100%)`
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-[8px] font-bold text-slate-300 mt-4 px-1 uppercase tracking-tighter">
                                    <span>0H</span><span>8H</span>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-6">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Capacity</label>
                                    <div className="bg-indigo-600 px-3 py-1 rounded-xl shadow-lg shadow-indigo-500/20">
                                        <span className="text-[11px] font-black text-white">{policy.maxHoursPerDay} HRS</span>
                                    </div>
                                </div>

                                <div className="relative px-2">
                                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full flex justify-between px-2 pointer-events-none">
                                        {[8, 12, 16, 20, 24].map(h => (
                                            <div key={h} className="relative flex flex-col items-center">
                                                <div className={`w-1 h-1 rounded-full transition-all duration-500 ${policy.maxHoursPerDay >= h ? 'bg-indigo-600 scale-125 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-200 dark:bg-white/10'}`} />
                                            </div>
                                        ))}
                                    </div>

                                    <input
                                        type="range" min={8} max={24} step={0.5}
                                        value={policy.maxHoursPerDay}
                                        onChange={e => upd('maxHoursPerDay', parseFloat(e.target.value))}
                                        className="relative w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer z-10 accent-indigo-600
                                            [&::-webkit-slider-thumb]:appearance-none 
                                            [&::-webkit-slider-thumb]:w-4 
                                            [&::-webkit-slider-thumb]:h-4 
                                            [&::-webkit-slider-thumb]:rounded-full 
                                            [&::-webkit-slider-thumb]:bg-slate-900 
                                            [&::-webkit-slider-thumb]:dark:bg-white 
                                            [&::-webkit-slider-thumb]:border-2 
                                            [&::-webkit-slider-thumb]:border-indigo-600 
                                            [&::-webkit-slider-thumb]:shadow-lg 
                                            [&::-webkit-slider-thumb]:hover:scale-110 
                                            [&::-webkit-slider-thumb]:transition-all
                                            [&::-webkit-slider-runnable-track]:bg-transparent"
                                        style={{
                                            background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${(policy.maxHoursPerDay - 8) / 16 * 100}%, transparent ${(policy.maxHoursPerDay - 8) / 16 * 100}%, transparent 100%)`
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-[8px] font-bold text-slate-300 mt-4 px-1 uppercase tracking-tighter">
                                    <span>8H</span><span>24H</span>
                                </div>
                            </div>
                        </div>

                        {/* Enforce on Submit toggle */}
                        <div className="pt-6 border-t border-slate-100 dark:border-white/10">
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
                            
                            <div className={`mt-4 p-4 rounded-2xl border transition-all ${policy.enforceMinHoursOnSubmit 
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
    )
}
