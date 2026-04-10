import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    Globe, Clock, Settings2, Save, ChevronDown, 
    Shield, AlertCircle, Building2, Landmark, 
    MapPin, Coins, Calendar, CheckCircle2, 
    Circle, AlertTriangle
} from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'
import { DaySelector, StatusBadge, ImpactPanel } from '../components/SettingsComponents'

const getFormattedTimezones = () => {
    return Intl.supportedValuesOf('timeZone').map(tz => {
        try {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                timeZoneName: 'shortOffset'
            });
            const parts = formatter.formatToParts(new Date());
            const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
            let name = tz.replace(/_/g, ' ');
            if (tz === 'UTC') name = 'UTC (Coordinated Universal Time)';
            return {
                value: tz,
                label: `(${offsetPart}) ${name}`
            };
        } catch (e) {
            return { value: tz, label: tz.replace(/_/g, ' ') };
        }
    }).sort((a, b) => {
        const parseOffset = (label) => {
            const match = label.match(/GMT([+-]?)(\d+)?(?::(\d+))?/);
            if (!match) return 0;
            const sign = match[1] === '-' ? -1 : 1;
            const hrs = parseInt(match[2] || 0) * 60;
            const mins = parseInt(match[3] || 0);
            return sign * (hrs + mins);
        };
        return parseOffset(a.label) - parseOffset(b.label) || a.label.localeCompare(b.label);
    });
};

const TIMEZONES = getFormattedTimezones();
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

const TimezoneSelect = ({ value, onChange, options }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = React.useRef(null);

    React.useEffect(() => {
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
        }
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const selectedOption = options.find(o => o.value === value);
    const filteredOptions = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={ref}>
            <div
                className="input w-full h-12 flex items-center justify-between cursor-pointer font-bold bg-slate-50/50 dark:bg-white/5"
                onClick={() => { setIsOpen(!isOpen); setSearch(''); }}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : 'Select Timezone'}</span>
                <ChevronDown size={14} className="text-slate-500" />
            </div>

            {isOpen && (
                <div className="absolute z-[100] mt-1 w-full bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-white/10">
                        <input
                            autoFocus
                            type="text"
                            className="input w-full text-sm py-1.5 px-3"
                            placeholder="Search timezone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? filteredOptions.map(o => (
                            <div
                                key={o.value}
                                className={`px-3 py-2 text-sm cursor-pointer rounded-lg hover:bg-primary/5 dark:hover:bg-primary/20 transition-colors ${o.value === value ? 'bg-primary/10 text-primary font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                                onClick={() => {
                                    onChange(o.value);
                                    setIsOpen(false);
                                }}
                            >
                                {o.label}
                            </div>
                        )) : (
                            <div className="p-3 text-sm text-slate-500 text-center">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// Helper to map workweek string to day keys
const getSelectedDays = (workWeek) => {
    if (!workWeek) return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    if (workWeek === 'Mon-Fri') return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    if (workWeek === 'Sun-Thu') return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']
    if (workWeek === 'Mon-Sat') return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    // Fallback if it's already an array or stored differently
    try {
        if (Array.isArray(workWeek)) return workWeek
        if (workWeek.includes(',')) return workWeek.split(',')
    } catch(e) {}
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
}

export default function OrganizationTab() {
    const qc = useQueryClient()
    const { updateGeneralSettings } = useSettingsStore()
    const { subscription } = useAuthStore()
    const [form, setForm] = React.useState({
        companyName: '',
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        companyLogo: '',
        address: '',
        country: '',
        currency: 'INR',
        fiscalYearStart: 'April',
        workWeek: 'Mon-Fri',
        enableEnterpriseRBAC: false,
        workingHoursPerDay: 8,
        strictDailyHours: false,
        isWeekendWorkable: false,
        weekStartDay: 'monday',
    })

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    React.useEffect(() => {
        if (data) {
            setForm({
                ...form,
                ...(data.organization || {}),
                ...(data.general || {})
            })
        }
    }, [data])

    const logoInputRef = React.useRef(null)
    const [logoFile, setLogoFile] = useState(null)

    const saveMutation = useMutation({
        mutationFn: async () => {
            let finalLogoUrl = form.companyLogo

            if (logoFile) {
                const fData = new FormData()
                fData.append('file', logoFile)
                const res = await settingsAPI.uploadBranding(fData)
                finalLogoUrl = res.data.data.url
            }

            return settingsAPI.updateSettings({
                organization: {
                    ...form,
                    companyLogo: finalLogoUrl
                },
                general: {
                    companyName: form.companyName,
                    timezone: form.timezone,
                    workingHoursPerDay: form.workingHoursPerDay,
                    strictDailyHours: form.strictDailyHours,
                    isWeekendWorkable: form.isWeekendWorkable || getSelectedDays(form.workWeek).includes('saturday') || getSelectedDays(form.workWeek).includes('sunday'),
                    workWeek: form.workWeek,
                    weekStartDay: form.weekStartDay,
                    dateFormat: form.dateFormat,
                    enableEnterpriseRBAC: form.enableEnterpriseRBAC,
                }
            })
        },
        onSuccess: () => {
            toast.success('Organization settings saved successfully!')
            updateGeneralSettings(form)
            setLogoFile(null)
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const handleLogoUpload = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setLogoFile(file)
        const url = URL.createObjectURL(file)
        upd('companyLogo', url)
    }

    // Impact Logic
    const impacts = useMemo(() => {
        const list = []
        const selectedDays = getSelectedDays(form.workWeek)
        
        // Weekend impact
        const hasWeekend = selectedDays.includes('saturday') || selectedDays.includes('sunday')
        if (hasWeekend) {
            list.push({
                title: 'Weekend Entries Allowed',
                description: 'Users will be able to submit timesheets for Saturday and Sunday.'
            })
        } else {
            list.push({
                title: 'Business Week Enforcement',
                description: 'Timesheet entries will be restricted to Monday through Friday only.'
            })
        }

        // Currency impact
        list.push({
            title: `Financial Ledger in ${form.currency}`,
            description: `All future invoices and payroll reports will be denominated in ${form.currency}.`
        })

        // Working hours impact
        if (form.strictDailyHours) {
            list.push({
                title: 'Strict Hour Validation',
                description: `Timesheets will block any entry that does not meet the standard ${form.workingHoursPerDay} hours.`
            })
        }

        return list
    }, [form])

    // Completion Status Logic
    const getSectionStatus = (type) => {
        if (type === 'identity') {
            const fields = [form.companyName, form.address, form.country]
            if (fields.every(f => !!f)) return 'complete'
            if (fields.some(f => !!f)) return 'incomplete'
            return 'missing'
        }
        if (type === 'financial') {
            return (form.currency && form.fiscalYearStart) ? 'complete' : 'incomplete'
        }
        if (type === 'localization') {
            return (form.timezone && form.dateFormat && form.workWeek) ? 'complete' : 'incomplete'
        }
        return 'missing'
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <input 
                type="file" 
                ref={logoInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleLogoUpload} 
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
                        <Building2 className="text-primary" size={28} />
                        Organization Landscape
                    </h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Manage institutional identity and operational governance</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/10 w-fit">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Environment</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">Production</span>
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Configuration Sections */}
                <div className="lg:col-span-8 space-y-8">
                    
                    {/* Section 1: Company Identity */}
                    <div className="relative">
                        <div className="absolute top-6 right-6 z-10">
                            <StatusBadge status={getSectionStatus('identity')} />
                        </div>
                        <SectionCard title="Company Identity" subtitle="Core branding and location profile" icon={Globe}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Official Institution Name</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                                        <input
                                            className={`input w-full h-12 pl-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5 border-2 ${!form.companyName ? 'border-rose-100 dark:border-rose-500/10' : 'border-transparent'}`}
                                            placeholder="e.g. Acme Corporation"
                                            value={form.companyName}
                                            onChange={e => upd('companyName', e.target.value)}
                                        />
                                        {!form.companyName && <p className="text-[10px] text-rose-500 font-bold mt-1.5 flex items-center gap-1"><AlertTriangle size={10} /> Name is required for reports</p>}
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Primary Headquarters</label>
                                    <div className="relative group">
                                        <MapPin className="absolute left-4 top-5 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                                        <textarea
                                            className="input w-full h-28 pl-12 py-4 resize-none text-sm font-medium bg-slate-50/50 dark:bg-white/5"
                                            placeholder="Physical address for correspondence..."
                                            value={form.address}
                                            onChange={e => upd('address', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Operational Country</label>
                                    <div className="relative">
                                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <input
                                            className="input w-full h-12 pl-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                            placeholder="United States"
                                            value={form.country}
                                            onChange={e => upd('country', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 group hover:border-primary/50 transition-all cursor-pointer" onClick={() => logoInputRef.current?.click()}>
                                    {form.companyLogo ? (
                                        <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-md">
                                            <img src={form.companyLogo} alt="Logo" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Save className="text-white" size={16} />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                                            <Globe size={20} />
                                        </div>
                                    )}
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-2">Institution Brand Mark</p>
                                </div> */}
                            </div>
                        </SectionCard>
                    </div>

                    {/* Section 2: Financial Configuration */}
                    <div className="relative">
                        <div className="absolute top-6 right-6 z-10">
                            <StatusBadge status={getSectionStatus('financial')} />
                        </div>
                        <SectionCard title="Financial Configuration" subtitle="Ledger currency and period rules" icon={Landmark}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Default Currency</label>
                                    <div className="relative group">
                                        <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                                        <select
                                            className="input w-full h-12 pl-12 pr-10 appearance-none font-bold bg-slate-50/50 dark:bg-white/5"
                                            value={form.currency}
                                            onChange={e => upd('currency', e.target.value)}
                                        >
                                            <option value="INR">INR (₹)</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                            <option value="GBP">GBP (£)</option>
                                            <option value="AED">AED (د.إ)</option>
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-2 font-medium">Affects payroll & project billing calculations.</p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Fiscal Year Start</label>
                                    <div className="relative group">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                                        <select
                                            className="input w-full h-12 pl-12 appearance-none pr-9 font-bold bg-slate-50/50 dark:bg-white/5"
                                            value={form.fiscalYearStart}
                                            onChange={e => upd('fiscalYearStart', e.target.value)}
                                        >
                                            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                                                <option key={month} value={month}>{month}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    </div>

                    {/* Section 3: Localization & Time */}
                    <div className="relative">
                        <div className="absolute top-6 right-6 z-10">
                            <StatusBadge status={getSectionStatus('localization')} />
                        </div>
                        <SectionCard title="Localization & Time" subtitle="Regional standards and working hours" icon={Settings2}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Enterprise Standard Work Week</label>
                                    <DaySelector 
                                        selectedDays={getSelectedDays(form.workWeek)} 
                                        onChange={(days) => upd('workWeek', days)} 
                                    />
                                    <p className="text-[9px] text-slate-400 mt-3 font-medium">Determines calendar availability for project schedules.</p>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Region Timezone</label>
                                    <TimezoneSelect 
                                        value={form.timezone} 
                                        onChange={v => upd('timezone', v)} 
                                        options={TIMEZONES} 
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Global Date Format</label>
                                    <div className="relative group">
                                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={16} />
                                        <select
                                            className="input w-full h-12 pl-12 appearance-none pr-9 font-bold bg-slate-50/50 dark:bg-white/5"
                                            value={form.dateFormat}
                                            onChange={e => upd('dateFormat', e.target.value)}
                                        >
                                            {DATE_FORMATS.map(fmt => <option key={fmt} value={fmt}>{fmt}</option>)}
                                        </select>
                                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-6 pt-6 border-t border-slate-100 dark:border-white/5">
                                    <div>
                                        <div className="flex justify-between items-end mb-3">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Standard Work Day Baseline</label>
                                            <span className="px-3 py-1 rounded-full bg-primary text-[10px] font-black text-white">{form.workingHoursPerDay} HOURS</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={1} max={12} step={0.5}
                                            value={form.workingHoursPerDay}
                                            onChange={e => upd('workingHoursPerDay', parseFloat(e.target.value))}
                                            className="w-full accent-primary h-2 bg-slate-100 dark:bg-white/5 rounded-full appearance-none cursor-pointer"
                                        />
                                    </div>

                                        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:border-primary/30 transition-all">
                                            <div>
                                                <div className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                                    Strict Enforcement
                                                    <div className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-[8px] text-amber-600 dark:text-amber-400 font-black tracking-widest uppercase">Compliance</div>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Block timesheets that don't meet daily requirements</p>
                                            </div>
                                        <button onClick={() => upd('strictDailyHours', !form.strictDailyHours)}
                                            className={`relative w-12 h-6.5 rounded-full transition-all flex items-center px-1 ${form.strictDailyHours ? 'bg-primary shadow-lg shadow-primary/25' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                            <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${form.strictDailyHours ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                </div>

                {/* Live Impact Side Panel */}
                <div className="lg:col-span-4">
                    <ImpactPanel impacts={impacts} />
                </div>
            </div>
        </div>
    )
}
