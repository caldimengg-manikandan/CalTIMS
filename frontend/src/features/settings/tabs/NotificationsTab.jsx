import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BellRing, Mail, Check, Save } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

export default function NotificationsTab() {
    const qc = useQueryClient()
    const [notifications, setNotifications] = useState({
        emailEnabled: true,
        inAppEnabled: true,
        notifyOnTimesheetSubmission: true,
        notifyOnTimesheetApproval: true,
        notifyOnTimesheetRejection: true,
        notifyOnLeaveRequest: true,
        notifyOnLeaveApproval: true
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'overall'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.notifications) {
            setNotifications(data.notifications)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ notifications }),
        onSuccess: () => {
            toast.success('Notification preferences saved!')
            qc.invalidateQueries(['settings', 'overall'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setNotifications(f => ({ ...f, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Alerts & Notifications</h2>
                <p className="text-sm text-slate-400">Control system-generated messages and emails sent to users and managers</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard title="Global Delivery Methods" subtitle="Enable or disable entire channels" icon={BellRing}>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => upd('emailEnabled', !notifications.emailEnabled)}
                                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${notifications.emailEnabled
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                <Mail size={24} className={notifications.emailEnabled ? 'text-primary' : 'text-slate-400'} />
                                <span className="font-bold text-sm">Email Alerts</span>
                                {notifications.emailEnabled && <Check size={14} />}
                            </button>

                            <button
                                onClick={() => upd('inAppEnabled', !notifications.inAppEnabled)}
                                className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${notifications.inAppEnabled
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-slate-300'
                                    }`}
                            >
                                <BellRing size={24} className={notifications.inAppEnabled ? 'text-primary' : 'text-slate-400'} />
                                <span className="font-bold text-sm">In-App Notifs</span>
                                {notifications.inAppEnabled && <Check size={14} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 text-center">
                            Disabling a channel overrides individual alert preferences below.
                        </p>
                    </div>
                </SectionCard>

                <SectionCard title="Event Triggers" subtitle="Specific actions that generate notifications" icon={Mail}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/10">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timesheet Submission (To Manager)</span>
                            <button onClick={() => upd('notifyOnTimesheetSubmission', !notifications.notifyOnTimesheetSubmission)}
                                className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetSubmission ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${notifications.notifyOnTimesheetSubmission ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/10">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timesheet Approval (To Employee)</span>
                            <button onClick={() => upd('notifyOnTimesheetApproval', !notifications.notifyOnTimesheetApproval)}
                                className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetApproval ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${notifications.notifyOnTimesheetApproval ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/10">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timesheet Rejection (To Employee)</span>
                            <button onClick={() => upd('notifyOnTimesheetRejection', !notifications.notifyOnTimesheetRejection)}
                                className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetRejection ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${notifications.notifyOnTimesheetRejection ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/10">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Request (To Manager)</span>
                            <button onClick={() => upd('notifyOnLeaveRequest', !notifications.notifyOnLeaveRequest)}
                                className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveRequest ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${notifications.notifyOnLeaveRequest ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Approval (To Employee)</span>
                            <button onClick={() => upd('notifyOnLeaveApproval', !notifications.notifyOnLeaveApproval)}
                                className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveApproval ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${notifications.notifyOnLeaveApproval ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
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
