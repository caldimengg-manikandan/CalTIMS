import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    Briefcase, Calendar, ShieldCheck, 
    Plus, Trash2, ArrowRight, Save,
    Stethoscope, Coffee, HeartPulse
} from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

const DEFAULT_LEAVE_TYPES = [
    { id: 'lt-1', name: 'Annual Leave', category: 'Paid', days: 20, description: 'Statutory vacation time' },
    { id: 'lt-2', name: 'Sick Leave', category: 'Medical', days: 10, description: 'Medical recovery and health' },
    { id: 'lt-3', name: 'Casual Leave', category: 'General', days: 6, description: 'Personal matters and emergency' }
]

const CATEGORY_STYLES = {
    Paid: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20',
    Medical: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20',
    General: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20'
}

const CATEGORY_ICONS = {
    Paid: Briefcase,
    Medical: Stethoscope,
    General: Coffee
}

export default function LeavePolicyTab() {
    const qc = useQueryClient()
    const [leaveTypes, setLeaveTypes] = useState([])
    
    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.leavePolicy?.config) {
            setLeaveTypes(data.leavePolicy.config)
        } else {
            setLeaveTypes(DEFAULT_LEAVE_TYPES)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            leavePolicy: {
                config: leaveTypes,
                updatedAt: new Date().toISOString()
            }
        }),
        onSuccess: () => {
            qc.invalidateQueries(['settings'])
            toast.success('Leave Policy saved successfully!')
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const handleAddLeave = () => {
        const id = `lt-${Date.now()}`
        const newLeave = {
            id,
            name: 'New Leave Type',
            category: 'General',
            days: 5,
            description: 'Custom leave category'
        }
        setLeaveTypes([...leaveTypes, newLeave])
        setTimeout(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
    }

    const updateLeave = (id, updates) => {
        setLeaveTypes(types => types.map(t => t.id === id ? { ...t, ...updates } : t))
    }

    const removeLeave = (id) => {
        setLeaveTypes(types => types.filter(t => t.id !== id))
    }

    const validation = useMemo(() => {
        const hasZero = leaveTypes.some(t => t.days <= 0)
        const hasEmptyName = leaveTypes.some(t => !t.name.trim())
        const names = leaveTypes.map(t => t.name.toLowerCase().trim())
        const hasDuplicates = new Set(names).size !== names.length
        
        return {
            isValid: !hasZero && !hasEmptyName && !hasDuplicates,
            error: hasZero ? 'All leave types must have at least 1 day' :
                   hasEmptyName ? 'Leave names cannot be empty' :
                   hasDuplicates ? 'Leave names must be unique' : null
        }
    }, [leaveTypes])

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <HeartPulse className="text-primary0" size={28} />
                        Leave & Wellness Standards
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Configure global entitlements and health-related coverage</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="px-5 py-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Categories</span>
                            <span className="text-xl font-black text-slate-800 dark:text-white leading-none mt-1">{leaveTypes.length}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Status</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${validation.isValid ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {validation.isValid ? 'Valid Policy' : 'Incomplete'}
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending || !validation.isValid}
                        className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Section: Leave Types Management */}
                <div className="lg:col-span-12 xl:col-span-7">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-white">Leave Library</h3>
                                <p className="text-xs text-slate-500 font-medium">Define your standard time-off categories</p>
                            </div>
                            <button 
                                onClick={handleAddLeave}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary0/10 hover:bg-primary0/20 text-primary0 text-xs font-black uppercase tracking-widest transition-all"
                            >
                                <Plus size={16} /> Add Custom
                            </button>
                        </div>

                        <div className="flex-1 p-4 space-y-3">
                            {leaveTypes.map((leave) => {
                                const Icon = CATEGORY_ICONS[leave.category] || Briefcase
                                return (
                                    <div key={leave.id} id={leave.id} className="group relative bg-slate-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-slate-200 dark:hover:border-white/10 rounded-3xl p-6 transition-all">
                                        <div className="flex flex-col md:flex-row md:items-center gap-6">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border ${CATEGORY_STYLES[leave.category]}`}>
                                                <Icon size={20} />
                                            </div>

                                            <div className="flex-1 space-y-4">
                                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                                    <input 
                                                        type="text"
                                                        value={leave.name}
                                                        onChange={e => updateLeave(leave.id, { name: e.target.value })}
                                                        placeholder="Leave name..."
                                                        className="bg-transparent border-none p-0 text-sm font-black text-slate-800 dark:text-white focus:ring-0 placeholder:text-slate-300 w-full"
                                                    />
                                                    <select 
                                                        value={leave.category}
                                                        onChange={e => updateLeave(leave.id, { category: e.target.value })}
                                                        className={`text-[9px] font-black uppercase tracking-widest rounded-lg px-2 py-1 border-none focus:ring-0 cursor-pointer ${CATEGORY_STYLES[leave.category]}`}
                                                    >
                                                        <option value="Paid">Paid</option>
                                                        <option value="Medical">Medical</option>
                                                        <option value="General">General</option>
                                                    </select>
                                                </div>
                                                <textarea 
                                                    value={leave.description}
                                                    onChange={e => updateLeave(leave.id, { description: e.target.value })}
                                                    placeholder="Brief purpose of this leave..."
                                                    className="bg-transparent border-none p-0 text-[10px] text-slate-500 font-medium focus:ring-0 w-full resize-none h-4"
                                                />
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entitlement</p>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="number"
                                                            min="0"
                                                            value={leave.days}
                                                            onChange={e => {
                                                                const val = parseInt(e.target.value);
                                                                if (val < 0) return;
                                                                updateLeave(leave.id, { days: val || 0 });
                                                            }}
                                                            className="w-12 bg-white dark:bg-black/20 border border-slate-100 dark:border-white/10 rounded-lg py-1 px-2 text-xs font-black text-center"
                                                        />
                                                        <span className="text-xs font-bold text-slate-500">Days</span>
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => removeLeave(leave.id)}
                                                    className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Section: Configuration Visualization */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-8">
                    <SectionCard title="Allowance Visualizer" subtitle="Manage balance pools and day limits" icon={Save}>
                        <div className="space-y-10 py-4">
                            {leaveTypes.map((leave) => (
                                <div key={leave.id} className="relative">
                                    <div className="flex justify-between items-end mb-4 px-1">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{leave.name}</p>
                                            <p className="text-[9px] text-slate-500 font-medium">Standard Yearly Pool</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 dark:bg-white/5 rounded-full border border-slate-100 dark:border-white/10">
                                            <span className="text-xs font-black text-slate-800 dark:text-white">{leave.days}</span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Days</span>
                                        </div>
                                    </div>
                                    
                                    <div className="relative flex items-center">
                                        <input
                                            type="range" min={1} max={60} step={1}
                                            value={leave.days}
                                            onChange={e => updateLeave(leave.id, { days: parseInt(e.target.value) })}
                                            className={`w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-100 dark:bg-white/5 transition-all`}
                                            style={{
                                                accentColor: leave.category === 'Paid' ? '#6366f1' : leave.category === 'Medical' ? '#ec4899' : '#f59e0b'
                                            }}
                                        />
                                        <div 
                                            className="absolute h-2 rounded-full pointer-events-none transition-all duration-300"
                                            style={{
                                                width: `${(leave.days / 60) * 100}%`,
                                                backgroundColor: leave.category === 'Paid' ? '#6366f1' : leave.category === 'Medical' ? '#ec4899' : '#f59e0b',
                                                opacity: 0.2
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5">
                            <div className="p-6 rounded-[2rem] bg-amber-50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20">
                                <h4 className="flex items-center gap-2 text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3">
                                    <ShieldCheck size={14} /> Compliance Lock
                                </h4>
                                <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 font-medium leading-relaxed">
                                    All adjusted values will apply to the next fiscal year balance calculation. Existing approved leaves will not be retroactive impacted by pool changes.
                                </p>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>
        </div>
    )
}
