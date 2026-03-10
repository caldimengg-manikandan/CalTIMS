import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { LayoutGrid, Clock, Users, Settings2, Save } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard, Chip, AddChipInput } from '../components/SharedUI'

export default function TimesheetPolicyTab() {
    const qc = useQueryClient()
    const [taskCategories, setTaskCategories] = useState([])
    const [policy, setPolicy] = useState({
        submissionDeadline: 'Friday 18:00',
        freezeTimesheet: 'Monday 18:00',
        allowEditAfterSubmission: false,
        managerApprovalRequired: true,
        minHoursPerDay: 4,
        maxHoursPerDay: 12
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.timesheet) {
            setTaskCategories(data.timesheet.taskCategories || [])
            setPolicy({
                submissionDeadline: data.timesheet.submissionDeadline || 'Friday 18:00',
                freezeTimesheet: data.timesheet.freezeTimesheet || 'Monday 18:00',
                allowEditAfterSubmission: !!data.timesheet.allowEditAfterSubmission,
                managerApprovalRequired: !!data.timesheet.managerApprovalRequired,
                minHoursPerDay: data.timesheet.minHoursPerDay || 4,
                maxHoursPerDay: data.timesheet.maxHoursPerDay || 12
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Task Catalog */}
                <div className="lg:col-span-2 space-y-8">
                    <SectionCard title="Task Categories" subtitle="Manage available tags for entry" icon={LayoutGrid}>
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
                        <div className="mt-4 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                            Standard system categories are prioritized for reporting and analytics.
                        </div>
                    </SectionCard>

                    <SectionCard title="Workflow & Approvals" subtitle="Governance for submission and editing" icon={Users}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Manager Approval</p>
                                    <p className="text-[10px] text-slate-400">Required before processing payroll</p>
                                </div>
                                <button onClick={() => upd('managerApprovalRequired', !policy.managerApprovalRequired)}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${policy.managerApprovalRequired ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${policy.managerApprovalRequired ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Edit After Submit</p>
                                    <p className="text-[10px] text-slate-400">Allow users to modify locked entries</p>
                                </div>
                                <button onClick={() => upd('allowEditAfterSubmission', !policy.allowEditAfterSubmission)}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${policy.allowEditAfterSubmission ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${policy.allowEditAfterSubmission ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Automation & Guardrails */}
                <div className="space-y-8">
                    <SectionCard title="Deadlines & Locks" subtitle="Submission and auto-freeze rules" icon={Clock}>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Submission Deadline</label>
                                <input
                                    className="input w-full h-11 text-sm font-bold"
                                    value={policy.submissionDeadline}
                                    onChange={e => upd('submissionDeadline', e.target.value)}
                                    placeholder="e.g. Friday 18:00"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Soft Freeze (System)</label>
                                <input
                                    className="input w-full h-11 text-sm font-bold"
                                    value={policy.freezeTimesheet}
                                    onChange={e => upd('freezeTimesheet', e.target.value)}
                                    placeholder="e.g. Monday 10:00"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Entry Guardrails" subtitle="Daily hour constraints" icon={Settings2}>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Minimum Hours</label>
                                    <span className="text-[11px] font-black text-indigo-600">{policy.minHoursPerDay} hrs</span>
                                </div>
                                <input
                                    type="range" min={0} max={8} step={0.5}
                                    value={policy.minHoursPerDay}
                                    onChange={e => upd('minHoursPerDay', parseFloat(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Maximum Hours</label>
                                    <span className="text-[11px] font-black text-indigo-600">{policy.maxHoursPerDay} hrs</span>
                                </div>
                                <input
                                    type="range" min={8} max={24} step={0.5}
                                    value={policy.maxHoursPerDay}
                                    onChange={e => upd('maxHoursPerDay', parseFloat(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
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
                    Enforce Policies
                </button>
            </div>
        </div>
    )
}
