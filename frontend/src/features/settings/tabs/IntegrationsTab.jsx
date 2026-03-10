import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Workflow, Webhook, Link2, ExternalLink, Save, ClipboardCheck } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

export default function IntegrationsTab() {
    const qc = useQueryClient()
    const [integrations, setIntegrations] = useState({
        googleCalendar: { enabled: false, apiKey: '' },
        microsoftOutlook: { enabled: false, apiKey: '' },
        slackNotifications: { enabled: false, webhookUrl: '' },
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.integrations) {
            setIntegrations({
                googleCalendar: {
                    enabled: !!data.integrations.googleCalendar?.enabled,
                    apiKey: data.integrations.googleCalendar?.apiKey || ''
                },
                microsoftOutlook: {
                    enabled: !!data.integrations.microsoftOutlook?.enabled,
                    apiKey: data.integrations.microsoftOutlook?.apiKey || ''
                },
                slackNotifications: {
                    enabled: !!data.integrations.slackNotifications?.enabled,
                    webhookUrl: data.integrations.slackNotifications?.webhookUrl || ''
                }
            })
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ integrations }),
        onSuccess: () => {
            toast.success('Integrations updated!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (service, key, val) => {
        setIntegrations(prev => ({
            ...prev,
            [service]: { ...prev[service], [key]: val }
        }))
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    const apps = [
        { id: 'googleCalendar', name: 'Google Calendar', icon: ExternalLink, color: 'bg-blue-500', field: 'apiKey', label: 'API Key' },
        { id: 'microsoftOutlook', name: 'Outlook Calendar', icon: Link2, color: 'bg-sky-600', field: 'apiKey', label: 'API Key' },
        { id: 'slackNotifications', name: 'Slack Alerts', icon: Webhook, color: 'bg-indigo-600', field: 'webhookUrl', label: 'Webhook URL' },
    ]

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Enterprise Integrations</h2>
                <p className="text-sm text-slate-500 font-medium">Connect and synchronize with your third-party ecosystem</p>
            </div>

            {/* SaaS Connectors */}
            <SectionCard title="SaaS Connectors" subtitle="Link internal workflows with external productivity tools" icon={Link2}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {apps.map((app) => (
                        <div key={app.id} className={`relative flex flex-col p-6 rounded-[2rem] border-2 transition-all duration-300 ${integrations[app.id].enabled ? 'border-indigo-600 bg-indigo-50/30 dark:bg-indigo-500/10' : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50'}`}>

                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className={`p-3 rounded-2xl ${app.color} text-white shadow-lg shadow-${app.color.split('-')[1]}-500/20`}>
                                    <app.icon size={20} />
                                </div>
                                <button
                                    onClick={() => upd(app.id, 'enabled', !integrations[app.id].enabled)}
                                    className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 flex items-center px-1 ${integrations[app.id].enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${integrations[app.id].enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Card Title & Status */}
                            <div className="mb-6">
                                <h3 className="text-sm font-black text-slate-800 dark:text-white">{app.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${integrations[app.id].enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                    <p className={`text-[10px] font-black uppercase tracking-widest ${integrations[app.id].enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                        {integrations[app.id].enabled ? 'Active Connection' : 'Disconnected'}
                                    </p>
                                </div>
                            </div>

                            {/* Field Input */}
                            <div className={`mt-auto transition-all duration-300 ${integrations[app.id].enabled ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">{app.label}</label>
                                <div className="relative group">
                                    <input
                                        type={app.field === 'apiKey' ? 'password' : 'text'}
                                        className="input w-full h-11 pr-10 font-mono text-xs font-bold bg-white dark:bg-black/20"
                                        placeholder={`Enter ${app.label}`}
                                        value={integrations[app.id][app.field]}
                                        onChange={e => upd(app.id, app.field, e.target.value)}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-indigo-400 transition-colors">
                                        <Workflow size={14} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Hardware & Custom */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Hardware */}
                <SectionCard title="Hardware Gateways" subtitle="Connect biometric and access control systems" icon={ClipboardCheck}>
                    <div className="h-full flex flex-col space-y-6">
                        <div className="flex items-center justify-between p-5 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-100 dark:border-amber-900/20 flex-1">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                                    <ClipboardCheck size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight text-amber-900 dark:text-amber-100">Attendance Sync</p>
                                    <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1.5 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md inline-flex">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> NOT CONFIGURED
                                    </div>
                                </div>
                            </div>
                            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                                Set Up
                            </button>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 mt-auto">
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                No active device streams detected. CALTIMS seamlessly integrates with standard <span className="font-bold text-slate-700 dark:text-slate-300">ZKTeco</span>, <span className="font-bold text-slate-700 dark:text-slate-300">HID</span>, and <span className="font-bold text-slate-700 dark:text-slate-300">Suprema</span> biometric protocols via our local gateway daemon.
                            </p>
                        </div>
                    </div>
                </SectionCard>

                {/* Custom */}
                <SectionCard title="Custom Solutions" subtitle="Need something bespoke?" icon={Webhook}>
                    <div className="h-full flex flex-col justify-center items-center p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-50/20 dark:bg-white/5 text-center min-h-[220px]">
                        <div className="flex justify-center mb-4">
                            <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Webhook size={28} />
                            </div>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white mb-2">Request New Integration</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6 px-4 max-w-sm">
                            Need to aggressively sync data with Jira, Trello, SAP, or a proprietary in-house tool? Our engineering team builds reliable custom connectors.
                        </p>
                        <button className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-500/30 transition-all shadow-sm">
                            Contact Solutions Architect
                        </button>
                    </div>
                </SectionCard>
            </div>

            {/* Sticky Action Footer */}
            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Authorize & Save
                </button>
            </div>
        </div>
    )
}
