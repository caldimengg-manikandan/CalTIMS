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

    const [hardwareGateways, setHardwareGateways] = useState({
        hikvision: { enabled: false, ipAddress: '', host: '', port: '8000', appKey: '', appSecret: '', username: '', password: '' },
        zkTeco: { enabled: false, ipAddress: '', port: '4370' }
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
        if (data?.hardwareGateways) {
            setHardwareGateways({
                hikvision: {
                    enabled: !!data.hardwareGateways.hikvision?.enabled,
                    ipAddress: data.hardwareGateways.hikvision?.ipAddress || '',
                    host: data.hardwareGateways.hikvision?.host || '',
                    port: data.hardwareGateways.hikvision?.port || '8000',
                    appKey: data.hardwareGateways.hikvision?.appKey || '',
                    appSecret: data.hardwareGateways.hikvision?.appSecret || '',
                    username: data.hardwareGateways.hikvision?.username || '',
                    password: data.hardwareGateways.hikvision?.password || ''
                },
                zkTeco: {
                    enabled: !!data.hardwareGateways.zkTeco?.enabled,
                    ipAddress: data.hardwareGateways.zkTeco?.ipAddress || '',
                    port: data.hardwareGateways.zkTeco?.port || '4370'
                }
            })
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ integrations, hardwareGateways }),
        onSuccess: () => {
            toast.success('Integrations updated!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const testHikMutation = useMutation({
        mutationFn: (data) => settingsAPI.testHikvision(data),
        onSuccess: (r) => toast.success(r.data.message),
        onError: e => toast.error(e.response?.data?.message || 'Connection test failed'),
    })

    const upd = (service, key, val) => {
        setIntegrations(prev => ({
            ...prev,
            [service]: { ...prev[service], [key]: val }
        }))
    }

    const updHW = (device, key, val) => {
        setHardwareGateways(prev => ({
            ...prev,
            [device]: { ...prev[device], [key]: val }
        }))
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    const apps = [
        { id: 'googleCalendar', name: 'Google Calendar', icon: ExternalLink, color: 'bg-blue-500', field: 'apiKey', label: 'API Key' },
        { id: 'microsoftOutlook', name: 'Outlook Calendar', icon: Link2, color: 'bg-sky-600', field: 'apiKey', label: 'API Key' },
        { id: 'slackNotifications', name: 'Slack Alerts', icon: Webhook, color: 'btn-primary', field: 'webhookUrl', label: 'Webhook URL' },
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
                        <div key={app.id} className={`relative flex flex-col p-6 rounded-[2rem] border-2 transition-all duration-300 ${integrations[app.id].enabled ? 'border-primary bg-primary/30 dark:bg-primary0/10' : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50'}`}>

                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-6">
                                <div className={`p-3 rounded-2xl ${app.color} text-white shadow-lg shadow-${app.color.split('-')[1]}-500/20`}>
                                    <app.icon size={20} />
                                </div>
                                <button
                                    onClick={() => upd(app.id, 'enabled', !integrations[app.id].enabled)}
                                    className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 flex items-center px-1 ${integrations[app.id].enabled ? 'btn-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
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
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">{app.label}</label>
                                <div className="relative group">
                                    <input
                                        type={app.field === 'apiKey' ? 'password' : 'text'}
                                        className="input w-full h-11 pr-10 font-mono text-xs font-bold bg-white dark:bg-black/20"
                                        placeholder={`Enter ${app.label}`}
                                        value={integrations[app.id][app.field]}
                                        onChange={e => upd(app.id, app.field, e.target.value)}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-primary transition-colors">
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
                    <div className="space-y-6">
                        {/* Hikvision Device */}
                        <div className={`p-5 rounded-3xl border-2 transition-all duration-300 ${hardwareGateways.hikvision.enabled ? 'border-primary bg-primary/10 dark:bg-primary0/10' : 'border-slate-100 dark:border-white/5 bg-slate-50/30'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${hardwareGateways.hikvision.enabled ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        <ClipboardCheck size={18} />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white">Hikvision Attendance</h3>
                                </div>
                                <button
                                    onClick={() => updHW('hikvision', 'enabled', !hardwareGateways.hikvision.enabled)}
                                    className={`relative w-10 h-5 rounded-full transition-all flex items-center px-1 ${hardwareGateways.hikvision.enabled ? 'btn-primary' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-3.4 h-3.4 bg-white rounded-full transition-transform ${hardwareGateways.hikvision.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {hardwareGateways.hikvision.enabled && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="col-span-2">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Server Host / IP Address</label>
                                        <input 
                                            type="text" className="input h-9 text-xs" placeholder="e.g. 192.168.1.131 or http://hikcentral"
                                            value={hardwareGateways.hikvision.host || hardwareGateways.hikvision.ipAddress}
                                            onChange={e => {
                                                updHW('hikvision', 'host', e.target.value)
                                                updHW('hikvision', 'ipAddress', e.target.value)
                                            }}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Artemis App Key</label>
                                        <input 
                                            type="text" className="input h-9 text-xs" placeholder="Artemis Key"
                                            value={hardwareGateways.hikvision.appKey}
                                            onChange={e => updHW('hikvision', 'appKey', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Artemis App Secret</label>
                                        <input 
                                            type="password" className="input h-9 text-xs" placeholder="Artemis Secret"
                                            value={hardwareGateways.hikvision.appSecret}
                                            onChange={e => updHW('hikvision', 'appSecret', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Admin Username</label>
                                        <input 
                                            type="text" className="input h-9 text-xs" placeholder="admin"
                                            value={hardwareGateways.hikvision.username}
                                            onChange={e => updHW('hikvision', 'username', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Admin Password</label>
                                        <input 
                                            type="password" className="input h-9 text-xs" placeholder="••••••••"
                                            value={hardwareGateways.hikvision.password}
                                            onChange={e => updHW('hikvision', 'password', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">API Port</label>
                                        <input 
                                            type="text" className="input h-9 text-xs" placeholder="8000"
                                            value={hardwareGateways.hikvision.port}
                                            onChange={e => updHW('hikvision', 'port', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 pt-2">
                                        <button 
                                            type="button"
                                            onClick={() => testHikMutation.mutate(hardwareGateways.hikvision)}
                                            disabled={testHikMutation.isPending}
                                            className="w-full py-2 rounded-xl bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {testHikMutation.isPending && <Spinner size="sm" />}
                                            Test Full Integration
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ZKTeco Device */}
                        <div className={`p-5 rounded-3xl border-2 transition-all duration-300 ${hardwareGateways.zkTeco.enabled ? 'border-primary bg-primary/10 dark:bg-primary0/10' : 'border-slate-100 dark:border-white/5 bg-slate-50/30'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${hardwareGateways.zkTeco.enabled ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                                        <ClipboardCheck size={18} />
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white">ZKTeco Biometric</h3>
                                </div>
                                <button
                                    onClick={() => updHW('zkTeco', 'enabled', !hardwareGateways.zkTeco.enabled)}
                                    className={`relative w-10 h-5 rounded-full transition-all flex items-center px-1 ${hardwareGateways.zkTeco.enabled ? 'btn-primary' : 'bg-slate-300'}`}
                                >
                                    <div className={`w-3.4 h-3.4 bg-white rounded-full transition-transform ${hardwareGateways.zkTeco.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            
                            {hardwareGateways.zkTeco.enabled && (
                                <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">Device IP</label>
                                        <input 
                                            type="text" className="input h-9 text-xs" placeholder="e.g. 192.168.1.101"
                                            value={hardwareGateways.zkTeco.ipAddress}
                                            onChange={e => updHW('zkTeco', 'ipAddress', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1">
                                        <label className="text-[9px] font-black uppercase text-slate-500 mb-1 block">UDP Port</label>
                                        <input 
                                            type="text" className="input h-9 text-xs" placeholder="4370"
                                            value={hardwareGateways.zkTeco.port}
                                            onChange={e => updHW('zkTeco', 'port', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                             <p className="text-[10px] text-amber-700 dark:text-amber-400 font-black uppercase tracking-widest mb-1">Local Gateway Required</p>
                             <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 font-medium leading-relaxed">
                                Hardware integration requires the <span className="font-bold">CALTIMS Gateway Daemon</span> to be running on the local network to bridge serial/UDP traffic to the cloud API.
                             </p>
                        </div>
                    </div>
                </SectionCard>

                {/* Custom */}
                <SectionCard title="Custom Solutions" subtitle="Need something bespoke?" icon={Webhook}>
                    <div className="h-full flex flex-col justify-center items-center p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-white/5 bg-slate-50/20 dark:bg-white/5 text-center min-h-[220px]">
                        <div className="flex justify-center mb-4">
                            <div className="w-14 h-14 rounded-[1.25rem] bg-primary dark:bg-primary0/10 flex items-center justify-center text-primary dark:text-primary">
                                <Webhook size={28} />
                            </div>
                        </div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-white mb-2">Request New Integration</h3>
                        <p className="text-xs text-slate-400 font-medium mb-6 px-4 max-w-sm">
                            Need to aggressively sync data with Jira, Trello, SAP, or a proprietary in-house tool? Our engineering team builds reliable custom connectors.
                        </p>
                        <button className="px-6 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200 hover:text-primary dark:hover:text-primary hover:border-indigo-200 dark:hover:border-primary0/30 transition-all shadow-sm">
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
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl btn-primary hover:btn-primary hover:bg-primary-700 text-white font-black uppercase tracking-widest shadow-xl shadow-primary/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Authorize & Save
                </button>
            </div>
        </div>
    )
}
