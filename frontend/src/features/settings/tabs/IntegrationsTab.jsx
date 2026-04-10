import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Workflow, Webhook, Link2, ExternalLink, Save, ClipboardCheck, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { settingsAPI, calendarAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'
import moment from 'moment'

export default function IntegrationsTab() {
    const qc = useQueryClient()
    const [searchParams, setSearchParams] = useSearchParams()
    
    const [hardwareGateways, setHardwareGateways] = useState({
        hikvision: { enabled: false, ipAddress: '', host: '', port: '8000', appKey: '', appSecret: '', username: '', password: '' },
        zkTeco: { enabled: false, ipAddress: '', port: '4370' }
    })

    // ── Fetch Integration Status ──────────────────────────────────────────────
    const { data: orgData, isLoading: isOrgLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    const { data: calendarIntegrations, isLoading: isCalLoading } = useQuery({
        queryKey: ['calendar-integrations'],
        queryFn: () => calendarAPI.getIntegrations().then(r => r.data.data),
    })

    // ── Handle OAuth Callback logic ──────────────────────────────────────────
    const googleCallback = useMutation({
        mutationFn: (code) => calendarAPI.callbackGoogle(code),
        onSuccess: () => {
            toast.success('Google Calendar connected!')
            qc.invalidateQueries(['calendar-integrations'])
            setSearchParams({}) // Clear params
        },
        onError: () => toast.error('Google connection failed')
    })

    const outlookCallback = useMutation({
        mutationFn: (code) => calendarAPI.callbackOutlook(code),
        onSuccess: () => {
            toast.success('Outlook Calendar connected!')
            qc.invalidateQueries(['calendar-integrations'])
            setSearchParams({}) // Clear params
        },
        onError: () => toast.error('Outlook connection failed')
    })

    useEffect(() => {
        const code = searchParams.get('code')
        const provider = searchParams.get('provider')
        if (code) {
            if (provider === 'google') googleCallback.mutate(code)
            if (provider === 'outlook') outlookCallback.mutate(code)
        }
    }, [searchParams])

    useEffect(() => {
        if (orgData?.hardwareGateways) {
            setHardwareGateways({
                hikvision: {
                    enabled: !!orgData.hardwareGateways.hikvision?.enabled,
                    ipAddress: orgData.hardwareGateways.hikvision?.ipAddress || '',
                    host: orgData.hardwareGateways.hikvision?.host || '',
                    port: orgData.hardwareGateways.hikvision?.port || '8000',
                    appKey: orgData.hardwareGateways.hikvision?.appKey || '',
                    appSecret: orgData.hardwareGateways.hikvision?.appSecret || '',
                    username: orgData.hardwareGateways.hikvision?.username || '',
                    password: orgData.hardwareGateways.hikvision?.password || ''
                },
                zkTeco: {
                    enabled: !!orgData.hardwareGateways.zkTeco?.enabled,
                    ipAddress: orgData.hardwareGateways.zkTeco?.ipAddress || '',
                    port: orgData.hardwareGateways.zkTeco?.port || '4370'
                }
            })
        }
    }, [orgData])

    const disconnectMutation = useMutation({
        mutationFn: (provider) => calendarAPI.disconnectProvider(provider),
        onSuccess: () => {
            toast.success('Integration removed')
            qc.invalidateQueries(['calendar-integrations'])
        }
    })

    const syncMutation = useMutation({
        mutationFn: () => calendarAPI.sync(),
        onSuccess: () => {
            toast.success('Sync started...')
            qc.invalidateQueries(['calendar-integrations'])
        }
    })

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ hardwareGateways }),
        onSuccess: () => {
            toast.success('Settings updated!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const updHW = (device, key, val) => {
        setHardwareGateways(prev => ({
            ...prev,
            [device]: { ...prev[device], [key]: val }
        }))
    }

    if (isOrgLoading || isCalLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    const getIntegrationStatus = (provider) => {
        return calendarIntegrations?.find(i => i.provider === provider)
    }

    const saasApps = [
        { 
            id: 'google', 
            name: 'Google Calendar', 
            icon: ExternalLink, 
            color: 'bg-blue-500', 
            desc: 'Sync your Google Workspace events with CalTIMS dashboard.' 
        },
        { 
            id: 'microsoft', 
            name: 'Outlook Calendar', 
            icon: Link2, 
            color: 'bg-sky-600', 
            desc: 'Connect Office 365 or Outlook.com personal calendars.' 
        },
    ]

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Enterprise Integrations</h2>
                    <p className="text-sm text-slate-500 font-medium">Connect and synchronize with your third-party ecosystem</p>
                </div>
                <button 
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                >
                    <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
                    Force Sync All
                </button>
            </div>

            {/* SaaS Connectors */}
            <SectionCard title="SaaS Connectors" subtitle="Link internal workflows with external productivity tools" icon={Link2}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {saasApps.map((app) => {
                        const integration = getIntegrationStatus(app.id)
                        const isConnected = integration?.status === 'CONNECTED'
                        
                        return (
                            <div key={app.id} className={`relative flex flex-col p-6 rounded-[2.5rem] border-2 transition-all duration-300 ${isConnected ? 'border-primary bg-primary/5 dark:bg-primary0/10' : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50'}`}>
                                
                                {/* Card Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 rounded-2xl ${app.color} text-white shadow-lg shadow-${app.color.split('-')[1]}-500/20`}>
                                        <app.icon size={20} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isConnected ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">
                                                <CheckCircle2 size={12} />
                                                Connected
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 dark:bg-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest border border-slate-300 dark:border-white/10">
                                                Disconnected
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-base font-black text-slate-800 dark:text-white">{app.name}</h3>
                                    <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">{app.desc}</p>
                                </div>

                                {isConnected && (
                                    <div className="mb-6 p-3 rounded-2xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/10">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Last Synchronized</p>
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                            {integration.lastSyncedAt ? moment(integration.lastSyncedAt).fromNow() : 'Never'}
                                        </p>
                                    </div>
                                )}

                                <div className="mt-auto pt-4 flex gap-3">
                                    {!isConnected ? (
                                        <button 
                                            onClick={() => calendarAPI.connectProvider(app.id)}
                                            className="flex-1 py-3 rounded-2xl btn-primary text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all"
                                        >
                                            Connect Calendar
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => disconnectMutation.mutate(app.id)}
                                            className="flex-1 py-3 rounded-2xl bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-white/10 transition-all"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </SectionCard>

            {/* Hardware Gateways */}
            <SectionCard title="Hardware Gateways" subtitle="Connect biometric and access control systems" icon={ClipboardCheck}>
                <div className="space-y-6">
                    {/* Hikvision Device */}
                    <div className={`p-6 rounded-[2.5rem] border-2 transition-all duration-300 ${hardwareGateways.hikvision.enabled ? 'border-primary bg-primary/5 dark:bg-primary0/10' : 'border-slate-100 dark:border-white/5 bg-slate-50/30'}`}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${hardwareGateways.hikvision.enabled ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                                    <ClipboardCheck size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-800 dark:text-white leading-none">Hikvision Attendance</h3>
                                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tight">Artemis Industrial Gateway</p>
                                </div>
                            </div>
                            <button
                                onClick={() => updHW('hikvision', 'enabled', !hardwareGateways.hikvision.enabled)}
                                className={`relative w-12 h-6 rounded-full transition-all flex items-center px-1 ${hardwareGateways.hikvision.enabled ? 'btn-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${hardwareGateways.hikvision.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {hardwareGateways.hikvision.enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="md:col-span-2">
                                    <label className="text-[9px] font-black uppercase text-slate-500 mb-1.5 block px-1">Server Host / IP Address</label>
                                    <input 
                                        type="text" className="input h-10 text-xs rounded-xl" placeholder="e.g. 192.168.1.131"
                                        value={hardwareGateways.hikvision.host || hardwareGateways.hikvision.ipAddress}
                                        onChange={e => {
                                            updHW('hikvision', 'host', e.target.value)
                                            updHW('hikvision', 'ipAddress', e.target.value)
                                        }}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[9px] font-black uppercase text-slate-500 mb-1.5 block px-1">API Port</label>
                                    <input 
                                        type="text" className="input h-10 text-xs rounded-xl" placeholder="8000"
                                        value={hardwareGateways.hikvision.port}
                                        onChange={e => updHW('hikvision', 'port', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[9px] font-black uppercase text-slate-500 mb-1.5 block px-1">App Key</label>
                                    <input 
                                        type="text" className="input h-10 text-xs rounded-xl"
                                        value={hardwareGateways.hikvision.appKey}
                                        onChange={e => updHW('hikvision', 'appKey', e.target.value)}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="text-[9px] font-black uppercase text-slate-500 mb-1.5 block px-1">App Secret</label>
                                    <input 
                                        type="password" className="input h-10 text-xs rounded-xl"
                                        value={hardwareGateways.hikvision.appSecret}
                                        onChange={e => updHW('hikvision', 'appSecret', e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 rounded-3xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                         <div className="flex gap-3">
                            <div className="text-amber-500 mt-0.5">⚠️</div>
                            <div>
                                <p className="text-[10px] text-amber-700 dark:text-amber-400 font-black uppercase tracking-widest mb-1">Local Gateway Required</p>
                                <p className="text-[10px] text-amber-600/80 dark:text-amber-500/80 font-medium leading-relaxed">
                                    Hardware integration requires the <span className="font-bold underline">CALTIMS Gateway Daemon</span> to be running on the local network to bridge serial/UDP traffic to the cloud API.
                                </p>
                            </div>
                         </div>
                    </div>
                </div>
            </SectionCard>

            {/* Sticky Action Footer */}
            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-10 py-4 rounded-2xl btn-primary hover:btn-primary hover:bg-primary-700 text-white font-black uppercase tracking-widest shadow-2xl shadow-primary/40 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={20} />}
                    Save Changes
                </button>
            </div>
        </div>
    )
}
