import React, { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    ShieldCheck, Building2, Clock, 
    Settings2, ChevronRight, CheckCircle2, 
    AlertTriangle, LayoutGrid, Globe, 
    Calendar, Lock, Unlock, Save
} from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

export default function ConfigurationCenterTab() {
    const qc = useQueryClient()
    const [form, setForm] = useState({
        // Organization (Required)
        companyName: '',
        timezone: 'UTC',
        workWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        
        // Timesheet Policy (Required)
        submissionDeadline: 'Friday 18:00',
        managerApprovalRequired: true,
        
        // Guardrails (Optional)
        minHoursPerDay: 4,
        maxHoursPerDay: 12,
        hardLock: false
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data) {
            setForm(f => ({
                ...f,
                companyName: data.organization?.companyName || '',
                timezone: data.general?.timezone || 'UTC',
                workWeek: typeof data.general?.workWeek === 'string' ? data.general.workWeek.split(',') : (data.general?.workWeek || f.workWeek),
                submissionDeadline: data.timesheet?.submissionDeadline || 'Friday 18:00',
                managerApprovalRequired: data.timesheet?.managerApprovalRequired ?? true,
                minHoursPerDay: data.timesheet?.minHoursPerDay ?? 4,
                maxHoursPerDay: data.timesheet?.maxHoursPerDay ?? 12,
                hardLock: data.timesheet?.enforceMinHoursOnSubmit ?? false
            }))
        }
    }, [data])

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

    // Validation & Progress Logic
    const validation = useMemo(() => {
        const sections = {
            organization: {
                title: 'Organization Settings',
                required: ['companyName', 'timezone'],
                status: 'incomplete',
                progress: 0
            },
            timesheet: {
                title: 'Timesheet Policy',
                required: ['submissionDeadline'],
                status: 'incomplete',
                progress: 0
            },
            guardrails: {
                title: 'Guardrails',
                required: [],
                status: 'optional',
                progress: 100
            }
        }

        // Calculate Org
        const orgFilled = sections.organization.required.filter(k => !!form[k])
        sections.organization.progress = (orgFilled.length / sections.organization.required.length) * 100
        sections.organization.status = sections.organization.progress === 100 ? 'complete' : 'incomplete'

        // Calculate Timesheet
        const tsFilled = sections.timesheet.required.filter(k => !!form[k])
        sections.timesheet.progress = (tsFilled.length / sections.timesheet.required.length) * 100
        sections.timesheet.status = sections.timesheet.progress === 100 ? 'complete' : 'incomplete'

        const totalRequired = sections.organization.required.length + sections.timesheet.required.length
        const totalFilled = orgFilled.length + tsFilled.length
        const overallProgress = Math.round((totalFilled / totalRequired) * 100)

        return {
            sections,
            overallProgress,
            isAllRequiredDone: overallProgress === 100
        }
    }, [form])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            organization: { companyName: form.companyName },
            general: { 
                timezone: form.timezone, 
                workWeek: form.workWeek.join(','),
                companyName: form.companyName
            },
            timesheet: {
                submissionDeadline: form.submissionDeadline,
                managerApprovalRequired: form.managerApprovalRequired,
                minHoursPerDay: form.minHoursPerDay,
                maxHoursPerDay: form.maxHoursPerDay,
                enforceMinHoursOnSubmit: form.hardLock
            }
        }),
        onSuccess: () => {
            toast.success('All configurations enforced! System is now live.')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Policy enforcement failed')
    })

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-10 pb-20 animate-fade-in max-w-5xl mx-auto">
            {/* Header with Progress */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                        <div>
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                                <ShieldCheck className="text-primary0" size={32} />
                                Core Configuration
                            </h2>
                            <p className="text-sm text-slate-500 font-medium mt-1">Foundational settings required for operational governance</p>
                        </div>
                        <button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending || !validation.isAllRequiredDone}
                            className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
                        >
                            {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Overall Completion</p>
                        <div className="flex items-center gap-4">
                            <span className="text-3xl font-black text-primary0 leading-none">{validation.overallProgress}%</span>
                            <div className="w-48 h-3 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200 dark:border-white/10">
                                <div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000"
                                    style={{ width: `${validation.overallProgress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.values(validation.sections).map((s) => (
                        <div key={s.title} className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${s.status === 'complete' || s.status === 'optional' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                {s.status === 'complete' || s.status === 'optional' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">{s.title}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                                    {s.status === 'complete' ? 'Completed' : s.status === 'optional' ? 'Optional' : 'Action Required'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Main Settings Flow */}
                <div className="lg:col-span-8 space-y-8">
                    
                    {/* Organization Section */}
                    <SectionCard 
                        title="Organization Identification" 
                        subtitle="Define institutional identity and regional presence"
                        icon={Building2}
                    >
                        <div className="space-y-6 pt-2">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block flex items-center gap-1">
                                    Legal Institution Name <span className="text-rose-500 font-black">*</span>
                                </label>
                                <div className="relative group">
                                    <Building2 className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${!form.companyName ? 'text-amber-500 animate-pulse' : 'text-slate-400 group-focus-within:text-primary0'}`} size={16} />
                                    <input 
                                        type="text"
                                        placeholder="e.g. Acme Corp"
                                        value={form.companyName}
                                        onChange={e => upd('companyName', e.target.value)}
                                        className={`input w-full h-12 pl-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5 border-2 transition-all ${!form.companyName ? 'border-amber-500/30' : 'border-transparent'}`}
                                    />
                                    {!form.companyName && (
                                        <p className="text-[10px] text-amber-600 font-bold mt-2 flex items-center gap-1">
                                            <AlertTriangle size={10} /> Name required for branding
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Enterprise Standard Timezone *</label>
                                <div className="relative group">
                                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary0" size={16} />
                                    <select 
                                        className="input w-full h-12 pl-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                        value={form.timezone}
                                        onChange={e => upd('timezone', e.target.value)}
                                    >
                                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                                        <option value="Asia/Kolkata">IST (Indian Standard Time)</option>
                                        <option value="America/New_York">EST (Eastern Standard Time)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Timesheet Policy Section */}
                    <SectionCard 
                        title="Governing Standards" 
                        subtitle="Weekly compliance and approval rules"
                        icon={Clock}
                    >
                        <div className="space-y-6 pt-2">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Weekly Submission Deadline *</label>
                                <div className="relative group">
                                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary0" size={16} />
                                    <input 
                                        type="text"
                                        placeholder="e.g. Friday 18:00"
                                        value={form.submissionDeadline}
                                        onChange={e => upd('submissionDeadline', e.target.value)}
                                        className="input w-full h-12 pl-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    />
                                </div>
                            </div>

                            <div className="p-6 rounded-3xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-between group hover:border-primary0/30 transition-all">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white mb-1">Manager Direct Approval</p>
                                    <p className="text-[11px] text-slate-500 font-medium tracking-tight">Requires secondary sign-off for payroll processing</p>
                                </div>
                                <button 
                                    onClick={() => upd('managerApprovalRequired', !form.managerApprovalRequired)}
                                    className={`relative w-12 h-6.5 rounded-full flex items-center px-1 transition-all ${form.managerApprovalRequired ? 'bg-primary0' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${form.managerApprovalRequired ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Optional Guardrails Sidebar */}
                <div className="lg:col-span-4 space-y-8">
                    <div className={`transition-all duration-500 ${!validation.sections.timesheet.progress === 100 ? 'opacity-40 grayscale' : 'opacity-100'}`}>
                        <SectionCard 
                            title={validation.sections.organization.progress < 100 ? "Locked" : "Guardrails"} 
                            subtitle="Threshold limits & enforcement"
                            icon={validation.sections.organization.progress < 100 ? Lock : Unlock}
                        >
                            {validation.sections.organization.progress < 100 ? (
                                <div className="py-8 text-center space-y-4">
                                    <Lock size={40} className="mx-auto text-slate-200" />
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest px-4">Complete Organization Info to unlock Guardrails</p>
                                </div>
                            ) : (
                                <div className="space-y-8 py-2">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Min Capacity</p>
                                            <span className="text-[10px] font-black text-primary0">{form.minHoursPerDay}h / day</span>
                                        </div>
                                        <input 
                                            type="range" min={0} max={8} step={0.5}
                                            value={form.minHoursPerDay}
                                            onChange={e => upd('minHoursPerDay', parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full appearance-none accent-primary0 cursor-pointer"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-end">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Max Capacity</p>
                                            <span className="text-[10px] font-black text-primary0">{form.maxHoursPerDay}h / day</span>
                                        </div>
                                        <input 
                                            type="range" min={8} max={24} step={0.5}
                                            value={form.maxHoursPerDay}
                                            onChange={e => upd('maxHoursPerDay', parseFloat(e.target.value))}
                                            className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full appearance-none accent-primary0 cursor-pointer"
                                        />
                                    </div>

                                    <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                                        <div className="flex items-center justify-between gap-4 p-4 rounded-[1.5rem] bg-rose-500/5 border border-rose-500/10">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-1">Hard Lock</p>
                                                <p className="text-[9px] text-slate-500 font-medium">Prevent submission if rules are breached</p>
                                            </div>
                                            <button 
                                                onClick={() => upd('hardLock', !form.hardLock)}
                                                className={`relative w-10 h-5.5 rounded-full flex items-center px-1 transition-all ${form.hardLock ? 'bg-rose-500 shadow-lg shadow-rose-500/20' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${form.hardLock ? 'translate-x-4.5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </SectionCard>
                    </div>

                    <div className="p-8 rounded-[2.5rem] bg-indigo-600 text-white space-y-4 shadow-xl shadow-indigo-500/20">
                        <div className="flex items-center gap-3">
                            <ShieldCheck size={20} className="text-indigo-200" />
                            <h3 className="font-black uppercase tracking-widest text-xs">Governance Note</h3>
                        </div>
                        <p className="text-xs text-indigo-100 font-medium leading-relaxed">
                            Once policies are enforced, they become the regulatory baseline for the entire organization's timesheet tracking system.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
