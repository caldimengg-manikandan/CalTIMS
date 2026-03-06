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
    const [leaveTypes, setLeaveTypes] = useState([])
    const [eligibleLeaveTypes, setEligibleLeaveTypes] = useState([])
    const [maxEntriesPerDay, setMaxEntriesPerDay] = useState(0)
    const [maxEntriesPerWeek, setMaxEntriesPerWeek] = useState(0)
    const [permissionMaxHoursPerDay, setPermissionMaxHoursPerDay] = useState(4)
    const [permissionMaxDaysPerWeek, setPermissionMaxDaysPerWeek] = useState(0)
    const [permissionMaxDaysPerMonth, setPermissionMaxDaysPerMonth] = useState(0)

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data) {
            setTaskCategories(data.taskCategories || [])
            setLeaveTypes(data.leaveTypes || [])
            setEligibleLeaveTypes(data.eligibleLeaveTypes || [])
            setMaxEntriesPerDay(data.maxEntriesPerDay || 0)
            setMaxEntriesPerWeek(data.maxEntriesPerWeek || 0)
            setPermissionMaxHoursPerDay(data.permissionMaxHoursPerDay || 4)
            setPermissionMaxDaysPerWeek(data.permissionMaxDaysPerWeek || 0)
            setPermissionMaxDaysPerMonth(data.permissionMaxDaysPerMonth || 0)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.saveTimesheetSettings({
            taskCategories,
            leaveTypes,
            eligibleLeaveTypes,
            maxEntriesPerDay: Number(maxEntriesPerDay),
            maxEntriesPerWeek: Number(maxEntriesPerWeek),
            permissionMaxHoursPerDay: Number(permissionMaxHoursPerDay),
            permissionMaxDaysPerWeek: Number(permissionMaxDaysPerWeek),
            permissionMaxDaysPerMonth: Number(permissionMaxDaysPerMonth)
        }),
        onSuccess: () => { toast.success('Timesheet settings saved!'); qc.invalidateQueries(['settings', 'timesheet']) },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Timesheet Policy</h2>
                <p className="text-sm text-slate-400">Manage available task categories and entry restrictions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Task Categories */}
                <SectionCard title="Task Categories" subtitle="Shown in the Task dropdown during timesheet entry" icon={LayoutGrid}>
                    <div className="flex flex-wrap gap-2">
                        {taskCategories.map((cat, i) => (
                            <Chip
                                key={i}
                                label={cat}
                                onRemove={() => setTaskCategories(taskCategories.filter((_, idx) => idx !== i))}
                            />
                        ))}
                    </div>
                    <AddChipInput
                        placeholder="e.g. Code Review, Research..."
                        onAdd={(val) => {
                            if (!taskCategories.includes(val)) setTaskCategories([...taskCategories, val])
                            else toast.error('Category already exists')
                        }}
                    />
                    <p className="text-xs text-slate-400 mt-3">Note: 'Leave' and 'Holiday' are always available and cannot be removed</p>
                </SectionCard>

                {/* Entry Limits */}
                <SectionCard title="Entry Limits" subtitle="Enforce maximum entries per day/week" icon={Settings2}>
                    <div className="space-y-4">
                        <div>
                            <label className="label mb-1.5 block">Daily Hour Limit</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={permissionMaxHoursPerDay}
                                    onChange={e => setPermissionMaxHoursPerDay(e.target.value)}
                                    placeholder="4"
                                />
                                <span className="text-xs text-slate-400 font-medium">Hours</span>
                            </div>
                        </div>
                        <div>
                            <label className="label mb-1.5 block">Weekly Days Limit</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={permissionMaxDaysPerWeek}
                                    onChange={e => setPermissionMaxDaysPerWeek(e.target.value)}
                                    placeholder="0 for no limit"
                                />
                                <span className="text-xs text-slate-400 font-medium">Days</span>
                            </div>
                        </div>
                        <div>
                            <label className="label mb-1.5 block">Monthly Days Limit</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={permissionMaxDaysPerMonth}
                                    onChange={e => setPermissionMaxDaysPerMonth(e.target.value)}
                                    placeholder="0 for no limit"
                                />
                                <span className="text-xs text-slate-400 font-medium">Days</span>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 italic">Set to 0 to disable entry limits.</p>
                    </div>
                </SectionCard>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-sm text-amber-800 dark:text-amber-300">
                <strong>💡 Note:</strong> Changes take effect immediately in the Timesheet Entry page after saving. Existing timesheets with old categories are not affected.
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
