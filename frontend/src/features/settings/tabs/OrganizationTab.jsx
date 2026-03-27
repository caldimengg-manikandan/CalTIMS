import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Clock, Settings2, Save, ChevronDown } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

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
                className="input w-full flex items-center justify-between cursor-pointer"
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
        // Legacy fields for backwards compatibility with general settings
        workingHoursPerDay: 8,
        strictDailyHours: false,
        isWeekendWorkable: false,
        weekStartDay: 'monday',
    })

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

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            organization: {
                companyName: form.companyName,
                timezone: form.timezone,
                dateFormat: form.dateFormat,
                companyLogo: form.companyLogo,
                address: form.address,
                country: form.country,
                currency: form.currency,
                fiscalYearStart: form.fiscalYearStart,
                workWeek: form.workWeek,
            },
            general: {
                companyName: form.companyName,
                timezone: form.timezone,
                workingHoursPerDay: form.workingHoursPerDay,
                strictDailyHours: form.strictDailyHours,
                isWeekendWorkable: form.isWeekendWorkable,
                weekStartDay: form.weekStartDay,
                dateFormat: form.dateFormat,
            }
        }),
        onSuccess: () => {
            toast.success('Organization settings saved!')
            updateGeneralSettings(form)
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))


    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Organization Landscape</h2>
                    <p className="text-sm text-slate-500 font-medium">Manage company identity, localization and operational basics</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-2xl border border-slate-200 dark:border-white/10 w-fit">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Plan:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${subscription?.planType === 'PRO' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20'}`}>
                        {subscription?.planType || 'TRIAL'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Column 1: Identity & Localization */}
                <div className="lg:col-span-8 space-y-8">
                    <SectionCard title="Corporate Identity" subtitle="Define your company's core public information" icon={Globe}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Official Company Name</label>
                                <input
                                    className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    placeholder="CALTIMS"
                                    value={form.companyName}
                                    onChange={e => upd('companyName', e.target.value)}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Headquarters Address</label>
                                <textarea
                                    className="input w-full h-28 py-4 resize-none text-sm font-medium bg-slate-50/50 dark:bg-white/5"
                                    placeholder="123 Enterprise Way, Tech City..."
                                    value={form.address}
                                    onChange={e => upd('address', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Operational Country</label>
                                <input
                                    className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    placeholder="India"
                                    value={form.country}
                                    onChange={e => upd('country', e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Base Currency</label>
                                <div className="relative">
                                    <select
                                        className="input w-full h-12 pr-10 appearance-none font-bold bg-slate-50/50 dark:bg-white/5"
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
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="System Localization" subtitle="Regional and time-based configurations" icon={Settings2}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Enterprise Timezone</label>
                                <TimezoneSelect 
                                    value={form.timezone} 
                                    onChange={v => upd('timezone', v)} 
                                    options={TIMEZONES} 
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Display Date Format</label>
                                <div className="relative">
                                    <select
                                        className="input w-full h-12 appearance-none pr-9 font-bold bg-slate-50/50 dark:bg-white/5"
                                        value={form.dateFormat}
                                        onChange={e => upd('dateFormat', e.target.value)}
                                    >
                                        {DATE_FORMATS.map(fmt => <option key={fmt} value={fmt}>{fmt}</option>)}
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Fiscal Year Start</label>
                                <div className="relative">
                                    <select
                                        className="input w-full h-12 appearance-none pr-9 font-bold bg-slate-50/50 dark:bg-white/5"
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

                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Standard Work Week</label>
                                <div className="relative">
                                    <select
                                        className="input w-full h-12 appearance-none pr-9 font-bold bg-slate-50/50 dark:bg-white/5"
                                        value={form.workWeek}
                                        onChange={e => upd('workWeek', e.target.value)}
                                    >
                                        <option value="Mon-Fri">Monday – Friday</option>
                                        <option value="Sun-Thu">Sunday – Thursday</option>
                                        <option value="Mon-Sat">Monday – Saturday</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>


                {/* Column 2: Assets & Rules */}
                <div className="lg:col-span-4 space-y-8">
                    <SectionCard title="Company Logo" subtitle="Brand assets for system reporting" icon={Globe}>
                        <div className="flex flex-col items-center gap-6 py-4">
                            <div className="w-full aspect-square max-w-[200px] rounded-[2.5rem] bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center p-6 group hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden">
                                {form.companyLogo ? (
                                    <img src={form.companyLogo} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <>
                                        <div className="p-4 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-primary transition-colors mb-4">
                                            <Globe size={32} />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Image Asset</p>
                                    </>
                                )}
                            </div>
                            <button className="text-[11px] font-black text-primary hover:underline transition-all uppercase tracking-widest">
                                Upload New Logo
                            </button>
                        </div>
                    </SectionCard>

                    <SectionCard title="Operational Pace" subtitle="Default system-wide pace rules" icon={Clock}>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Standard Work Day</label>
                                    <span className="px-2 py-1 rounded bg-primary text-[10px] font-black text-white">{form.workingHoursPerDay} HRS</span>
                                </div>
                                <input
                                    type="range"
                                    min={1} max={12} step={0.5}
                                    value={form.workingHoursPerDay}
                                    onChange={e => upd('workingHoursPerDay', parseFloat(e.target.value))}
                                    className="w-full accent-primary cursor-pointer"
                                />
                                <p className="text-[9px] text-slate-400 mt-2 font-medium">Used as the global baseline for timesheet compliance.</p>
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 hover:border-primary0/30 transition-all">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Strict Enforcement</p>
                                        <p className="text-[10px] text-slate-500 font-medium">Block sub-standard entries</p>
                                    </div>
                                    <button onClick={() => upd('strictDailyHours', !form.strictDailyHours)}
                                        className={`relative w-11 h-5.5 rounded-full transition-all flex items-center px-1 ${form.strictDailyHours ? 'bg-primary shadow-lg shadow-primary/25' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${form.strictDailyHours ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 hover:border-primary0/30 transition-all">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Weekend Access</p>
                                        <p className="text-[10px] text-slate-500 font-medium">Allow entries on Sat/Sun</p>
                                    </div>
                                    <button onClick={() => upd('isWeekendWorkable', !form.isWeekendWorkable)}
                                        className={`relative w-11 h-5.5 rounded-full transition-all flex items-center px-1 ${form.isWeekendWorkable ? 'bg-primary shadow-lg shadow-primary/25' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                        <div className={`w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${form.isWeekendWorkable ? 'translate-x-5.5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div>

            {/* Persistent Save Action */}
            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl btn-primary hover:btn-primary hover:bg-primary-700 text-white font-black uppercase tracking-widest shadow-xl shadow-primary/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={20} />}
                    Apply Institutional Settings
                </button>
            </div>
        </div>
    )
}
