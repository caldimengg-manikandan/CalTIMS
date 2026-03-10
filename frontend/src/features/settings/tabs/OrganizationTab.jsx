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
    const { appVersion } = useSystemStore()
    const [form, setForm] = useState({
        companyName: '',
        timezone: 'Asia/Kolkata',
        workingHoursPerDay: 8,
        strictDailyHours: false,
        isWeekendWorkable: false,
        weekStartDay: 'monday',
        dateFormat: 'DD/MM/YYYY',
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'general'],
        queryFn: () => settingsAPI.getGeneralSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data) setForm({ ...form, ...data })
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.saveGeneralSettings(form),
        onSuccess: () => {
            toast.success('Organization settings saved!')
            updateGeneralSettings(form)
            qc.invalidateQueries(['settings', 'general'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))


    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Organization Settings</h2>
                <p className="text-sm text-slate-400">App-wide configuration affecting all users</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Organization */}
                <SectionCard title="Organization" subtitle="Company identity settings" icon={Globe}>
                    <div className="space-y-4">
                        <div>
                            <label className="label">Company Name</label>
                            <input
                                className="input w-full"
                                placeholder="CALTIMS"
                                value={form.companyName}
                                onChange={e => upd('companyName', e.target.value)}
                            />
                            <p className="text-xs text-slate-400 mt-1">Shown in report emails and page header</p>
                        </div>
                        <div>
                            <label className="label">Timezone</label>
                            <div className="relative">
                                <TimezoneSelect
                                    value={form.timezone}
                                    onChange={(val) => upd('timezone', val)}
                                    options={TIMEZONES}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="label">Date Format</label>
                            <div className="grid grid-cols-3 gap-2">
                                {DATE_FORMATS.map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => upd('dateFormat', fmt)}
                                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${form.dateFormat === fmt
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/40'
                                            }`}
                                    >
                                        {fmt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Working Hours */}
                <SectionCard title="Working Hours" subtitle="Used for timesheet validation and reporting" icon={Clock}>
                    <div className="space-y-4">
                        <div>
                            <label className="label">Working Hours per Day</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={1} max={12} step={0.5}
                                    value={form.workingHoursPerDay}
                                    onChange={e => upd('workingHoursPerDay', parseFloat(e.target.value))}
                                    className="flex-1 accent-primary"
                                />
                                <div className="w-20 text-center">
                                    <input
                                        type="number"
                                        min={1} max={24} step={0.5}
                                        className="input text-center font-bold text-primary"
                                        value={form.workingHoursPerDay}
                                        onChange={e => upd('workingHoursPerDay', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Standard: 8 hours</p>
                        </div>

                        {/* Strict Working Hours Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white">
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-white">Strict Daily Hours</p>
                                <p className="text-[10px] text-slate-400">Require exactly {form.workingHoursPerDay} hrs/day for any entry</p>
                            </div>
                            <button onClick={() => upd('strictDailyHours', !form.strictDailyHours)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${form.strictDailyHours ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.strictDailyHours ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Weekend Entry Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white">
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-white">Enable Weekend Entry</p>
                                <p className="text-[10px] text-slate-400">Allow timesheet entry for Saturday and Sunday</p>
                            </div>
                            <button onClick={() => upd('isWeekendWorkable', !form.isWeekendWorkable)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${form.isWeekendWorkable ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isWeekendWorkable ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div>
                            <label className="label">Week Start Day</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['monday', 'sunday'].map(day => (
                                    <button
                                        key={day}
                                        onClick={() => upd('weekStartDay', day)}
                                        className={`py-3 rounded-xl border-2 capitalize text-sm font-semibold transition-all ${form.weekStartDay === day
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/40'
                                            }`}
                                    >
                                        {day === 'monday' ? 'Monday (Mon–Sun)' : 'Sunday (Sun–Sat)'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>
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
