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
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Enterprise Integrations</h2>
                <p className="text-sm text-slate-500 font-medium">Connect and synchronize with your third-party ecosystem</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {apps.map((app) => (
                    <SectionCard
                        key={app.id}
                        title={app.name}
                        subtitle={`Manage connection and ${app.label.toLowerCase()} settings`}
                        icon={app.icon}
                    >
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-all hover:border-indigo-200">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ${app.color} text-white shadow-lg shadow-${app.color.split('-')[1]}-500/20`}>
                                        <app.icon size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Connection Status</p>
                                        <p className={`text-[10px] font-bold ${integrations[app.id].enabled ? 'text-emerald-500' : 'text-slate-400'}`}>
                                            {integrations[app.id].enabled ? 'CONNECTED' : 'DISCONNECTED'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => upd(app.id, 'enabled', !integrations[app.id].enabled)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${integrations[app.id].enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${integrations[app.id].enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className={`space-y-4 transition-all duration-300 ${integrations[app.id].enabled ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">{app.label}</label>
                                    <div className="relative group">
                                        <input
                                            type={app.field === 'apiKey' ? 'password' : 'text'}
                                            className="input w-full h-11 pr-10 font-mono text-xs font-bold"
                                            placeholder={`Enter your ${app.name} ${app.label}`}
                                            value={integrations[app.id][app.field]}
                                            onChange={e => upd(app.id, app.field, e.target.value)}
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-indigo-400 transition-colors">
                                            <Workflow size={14} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!integrations[app.id].enabled && (
                                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-500/5 text-[10px] text-orange-600 dark:text-orange-400 font-medium text-center">
                                    Enable this service to configure its credentials and sync behavior.
                                </div>
                            )}
                        </div>
                    </SectionCard>
                ))}

                <SectionCard
                    title="Attendance Integration"
                    subtitle="Connect biometric and access control systems"
                    icon={ClipboardCheck}
                >
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-all hover:border-amber-200">
                            <div className="flex items-center gap-4">
                                <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                                    <ClipboardCheck size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">System Status</p>
                                    <p className="text-[10px] font-bold text-amber-500">NOT CONFIGURED</p>
                                </div>
                            </div>
                            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                                Configure Integration
                            </button>
                        </div>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10">
                            <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                                No active device streams detected. CALTIMS supports standard ZKTeco, HID, and Suprema biometric protocols via local gateway.
                            </p>
                        </div>
                    </div>
                </SectionCard>

                <div className="flex flex-col justify-center items-center p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-50/20 dark:bg-white/5 text-center">
                    <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
                        <Webhook size={32} />
                    </div>
                    <h3 className="text-sm font-black text-slate-800 dark:text-white mb-2">Request New Integration</h3>
                    <p className="text-xs text-slate-400 font-medium mb-6 px-4">
                        Need to sync with Jira, Trello, or SAP? Our team can build custom connectors for your enterprise.
                    </p>
                    <button className="px-6 py-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-all">
                        Contact Solutions Architect
                    </button>
                </div>
            </div>

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
