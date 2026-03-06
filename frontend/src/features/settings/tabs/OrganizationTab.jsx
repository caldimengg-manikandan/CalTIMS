import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Clock, Settings2, Save, ChevronDown } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import { useSettingsStore } from '@/store/settingsStore'
import { useSystemStore } from '@/store/systemStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

const TIMEZONES = Intl.supportedValuesOf('timeZone')
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

export default function OrganizationTab() {
    const qc = useQueryClient()
    const { updateGeneralSettings } = useSettingsStore()
    const { appVersion, toggleVersion } = useSystemStore()
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

    const handleToggleTier = async () => {
        const nextVersion = appVersion === 'basic' ? 'pro' : 'basic'
        try {
            await toggleVersion(nextVersion)
            toast.success(`Application switched to ${nextVersion.toUpperCase()} mode!`)
            qc.invalidateQueries()
        } catch (error) {
            // Error is handled in store
        }
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Organization Settings</h2>
                <p className="text-sm text-slate-400">App-wide configuration affecting all users</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Application Tier */}
                <SectionCard title="Application Tier" subtitle="Switch between Basic and Pro features (Demo)" icon={Settings2}>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Pro Enterprise Mode
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">Enables Compliance, Reports, and Incident support</p>
                        </div>
                        <button
                            onClick={handleToggleTier}
                            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${appVersion === 'pro' ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${appVersion === 'pro' ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </SectionCard>

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
                                <select
                                    className="input w-full appearance-none pr-9"
                                    value={form.timezone}
                                    onChange={e => upd('timezone', e.target.value)}
                                >
                                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
