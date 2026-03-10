import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Clock, Settings2, Save, ChevronDown } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import { useSettingsStore } from '@/store/settingsStore'
import { useSystemStore } from '@/store/systemStore'
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
                <ChevronDown size={14} className="text-slate-400" />
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
    const { appVersion, updateVersion } = useSystemStore()
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

    const handleToggleTier = async () => {
        const next = appVersion === 'pro' ? 'basic' : 'pro'
        const ok = await updateVersion(next)
        if (ok) toast.success(`Switched to ${next} mode`)
        else toast.error('Failed to switch mode')
    }


    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Organization Settings</h2>
                    <p className="text-sm text-slate-500 font-medium">Company-wide configuration and identity</p>
                </div>
                <div className="flex items-center gap-3 bg-slate-100 dark:bg-white/5 p-1.5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <button
                        onClick={handleToggleTier}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${appVersion === 'pro' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                        Enterprise (Pro)
                    </button>
                    <button
                        onClick={handleToggleTier}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${appVersion === 'basic' ? 'bg-slate-200 text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
                    >
                        Basic
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Column 1: Identity & Branding */}

                <SectionCard title="Corporate Identity" subtitle="Define your company's core information" icon={Globe}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="label">Company Name</label>
                            <input
                                className="input w-full h-12"
                                placeholder="CALTIMS"
                                value={form.companyName}
                                onChange={e => upd('companyName', e.target.value)}
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="label">Company Address</label>
                            <textarea
                                className="input w-full h-24 py-3 resize-none"
                                placeholder="123 Enterprise Way, Tech City..."
                                value={form.address}
                                onChange={e => upd('address', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="label">Country</label>
                            <input
                                className="input w-full h-12"
                                placeholder="India"
                                value={form.country}
                                onChange={e => upd('country', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="label">Currency</label>
                            <select
                                className="input w-full h-12 pr-10 appearance-none"
                                value={form.currency}
                                onChange={e => upd('currency', e.target.value)}
                            >
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="GBP">GBP (£)</option>
                                <option value="AED">AED (د.إ)</option>
                            </select>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="System Localization" subtitle="Regional and time-based settings" icon={Settings2}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="label">Timezone</label>
                            <div className="relative">
                                <select
                                    className="input w-full h-12 appearance-none pr-9"
                                    value={form.timezone}
                                    onChange={e => upd('timezone', e.target.value)}
                                >
                                    {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="label">Date Format</label>
                            <select
                                className="input w-full h-12 appearance-none pr-9"
                                value={form.dateFormat}
                                onChange={e => upd('dateFormat', e.target.value)}
                            >
                                {DATE_FORMATS.map(fmt => <option key={fmt} value={fmt}>{fmt}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="label">Fiscal Year Start</label>
                            <select
                                className="input w-full h-12 appearance-none pr-9"
                                value={form.fiscalYearStart}
                                onChange={e => upd('fiscalYearStart', e.target.value)}
                            >
                                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                                    <option key={month} value={month}>{month}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Work Week</label>
                            <select
                                className="input w-full h-12 appearance-none pr-9"
                                value={form.workWeek}
                                onChange={e => upd('workWeek', e.target.value)}
                            >
                                <option value="Mon-Fri">Monday – Friday</option>
                                <option value="Sun-Thu">Sunday – Thursday</option>
                                <option value="Mon-Sat">Monday – Saturday</option>
                            </select>
                        </div>
                    </div>
                </SectionCard>


                {/* Column 2: Logo & Policy Summaries */}
                {/* <div className="space-y-8">
                    <SectionCard title="Company Logo" subtitle="Brand identity for reports" icon={Save}>
                        <div className="flex flex-col items-center gap-6 py-4">
                            <div className="w-40 h-40 rounded-3xl bg-slate-50 dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center p-4 group hover:border-indigo-500/50 transition-colors cursor-pointer relative overflow-hidden">
                                {form.companyLogo ? (
                                    <img src={form.companyLogo} alt="Logo" className="w-full h-full object-contain p-4" />
                                ) : (
                                    <>
                                        <Globe size={32} className="text-slate-300 group-hover:text-indigo-400 transition-colors mb-2" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload PNG/JPG</p>
                                    </>
                                )}
                            </div>
                            <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-widest">
                                Change Logo
                            </button>
                        </div>
                    </SectionCard>

                    <SectionCard title="Working Hours" subtitle="Default validation rules" icon={Clock}>
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Standard Day</label>
                                    <span className="text-xs font-black text-indigo-600">{form.workingHoursPerDay} hrs</span>
                                </div>
                                <input
                                    type="range"
                                    min={1} max={12} step={0.5}
                                    value={form.workingHoursPerDay}
                                    onChange={e => upd('workingHoursPerDay', parseFloat(e.target.value))}
                                    className="w-full accent-indigo-600"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Strict Daily Hours</span>
                                <button onClick={() => upd('strictDailyHours', !form.strictDailyHours)}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${form.strictDailyHours ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.strictDailyHours ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Weekend Access</span>
                                <button onClick={() => upd('isWeekendWorkable', !form.isWeekendWorkable)}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${form.isWeekendWorkable ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isWeekendWorkable ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                </div> */}
            </div>

            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Apply Settings
                </button>
            </div>
        </div>
    )
}
