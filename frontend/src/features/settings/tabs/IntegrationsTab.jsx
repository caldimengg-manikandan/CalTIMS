import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Workflow, Webhook, Link2, ExternalLink, Save } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

export default function IntegrationsTab() {
    const qc = useQueryClient()
    const [integrations, setIntegrations] = useState({
        slackWebhook: '',
        msTeamsWebhook: '',
        jiraUrl: '',
        jiraApiKey: ''
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'overall'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.integrations) {
            setIntegrations(data.integrations)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ integrations }),
        onSuccess: () => {
            toast.success('Integrations saved!')
            qc.invalidateQueries(['settings', 'overall'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setIntegrations(f => ({ ...f, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Integrations & Webhooks</h2>
                <p className="text-sm text-slate-400">Connect CalTIMS with your existing workflow tools</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Communication Tools" subtitle="Send alerts and reports to team chats" icon={Webhook}>
                    <div className="space-y-4">
                        <div>
                            <label className="label">Slack Webhook URL</label>
                            <input
                                className="input w-full font-mono text-xs"
                                placeholder="https://hooks.slack.com/services/..."
                                value={integrations.slackWebhook || ''}
                                onChange={e => upd('slackWebhook', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">MS Teams Webhook URL</label>
                            <input
                                className="input w-full font-mono text-xs"
                                placeholder="https://outlook.office.com/webhook/..."
                                value={integrations.msTeamsWebhook || ''}
                                onChange={e => upd('msTeamsWebhook', e.target.value)}
                            />
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Project Management" subtitle="Sync tasks and time entries" icon={Link2}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-700 dark:text-white">Jira</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">Beta</span>
                            </div>
                            <a href="#" className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                                Setup Guide <ExternalLink size={12} />
                            </a>
                        </div>
                        <div>
                            <label className="label">Jira Workspace URL</label>
                            <input
                                className="input w-full"
                                placeholder="https://yourcompany.atlassian.net"
                                value={integrations.jiraUrl || ''}
                                onChange={e => upd('jiraUrl', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">API Token</label>
                            <input
                                type="password"
                                className="input w-full font-mono text-xs"
                                placeholder="••••••••••••••••"
                                value={integrations.jiraApiKey || ''}
                                onChange={e => upd('jiraApiKey', e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Stored securely. Requires admin privileges.</p>
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
