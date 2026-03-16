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
        timesheetReminder: 'Friday 18:00',
        freezeReminder: 'Monday 15:00',
        approvalReminder: 'Daily 10:00',
        emailEnabled: true,
        inAppEnabled: true,
        notifyOnTimesheetSubmission: true,
        notifyOnTimesheetApproval: true,
        notifyOnTimesheetRejection: true,
        notifyOnLeaveRequest: true,
        notifyOnLeaveApproval: true,
        notifyOnLeaveRejection: true,
        notifyOnSupportTicket: true,
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.notifications) {
            setNotifications({
                timesheetReminder: data.notifications.timesheetReminder || 'Friday 18:00',
                freezeReminder: data.notifications.freezeReminder || 'Monday 15:00',
                approvalReminder: data.notifications.approvalReminder || 'Daily 10:00',
                emailEnabled: data.notifications.emailEnabled ?? true,
                inAppEnabled: data.notifications.inAppEnabled ?? true,
                notifyOnTimesheetSubmission: data.notifications.notifyOnTimesheetSubmission ?? true,
                notifyOnTimesheetApproval: data.notifications.notifyOnTimesheetApproval ?? true,
                notifyOnTimesheetRejection: data.notifications.notifyOnTimesheetRejection ?? true,
                notifyOnLeaveRequest: data.notifications.notifyOnLeaveRequest ?? true,
                notifyOnLeaveApproval: data.notifications.notifyOnLeaveApproval ?? true,
                notifyOnLeaveRejection: data.notifications.notifyOnLeaveRejection ?? true,
                notifyOnSupportTicket: data.notifications.notifyOnSupportTicket ?? true,
            })
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ notifications }),
        onSuccess: () => {
            toast.success('Notification preferences saved!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setNotifications(f => ({ ...f, [k]: v }))

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">System Notifications</h2>
                <p className="text-sm text-slate-500 font-medium">Control cadence and delivery channels for automated alerts</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Channels & Subscriptions */}
                <div className="lg:col-span-8 space-y-8">
                    <SectionCard title="Delivery Channels" subtitle="Global switches for notification paths" icon={BellRing}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="flex flex-col p-5 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-2.5 rounded-xl ${notifications.emailEnabled ? 'btn-primary text-white shadow-md shadow-primary/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                        <Mail size={18} />
                                    </div>
                                    <button onClick={() => upd('emailEnabled', !notifications.emailEnabled)}
                                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notifications.emailEnabled ? 'btn-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.emailEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <p className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">Email Alerts</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-1">Receive updates directly to your registered inbox.</p>
                            </div>

                            <div className="flex flex-col p-5 rounded-3xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-2.5 rounded-xl ${notifications.inAppEnabled ? 'btn-primary text-white shadow-md shadow-primary/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                        <BellRing size={18} />
                                    </div>
                                    <button onClick={() => upd('inAppEnabled', !notifications.inAppEnabled)}
                                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${notifications.inAppEnabled ? 'btn-primary' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.inAppEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <p className="text-sm font-black uppercase tracking-tight text-slate-800 dark:text-slate-200">In-App Notifs</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-1">Real-time alerts in your dashboard notification center.</p>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Event Subscriptions" subtitle="Select which system actions trigger an alert" icon={Check}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                            {/* Timesheet Events */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-white/5 pb-2">Timesheet Workflows</h4>

                                <div className="flex items-center justify-between group">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-primary transition-colors">Submission</p>
                                    </div>
                                    <button onClick={() => upd('notifyOnTimesheetSubmission', !notifications.notifyOnTimesheetSubmission)}
                                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetSubmission ? 'btn-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifications.notifyOnTimesheetSubmission ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between group">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-500 transition-colors">Approval</p>
                                    </div>
                                    <button onClick={() => upd('notifyOnTimesheetApproval', !notifications.notifyOnTimesheetApproval)}
                                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetApproval ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifications.notifyOnTimesheetApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between group">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-rose-500 transition-colors">Rejection</p>
                                    </div>
                                    <button onClick={() => upd('notifyOnTimesheetRejection', !notifications.notifyOnTimesheetRejection)}
                                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetRejection ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifications.notifyOnTimesheetRejection ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Leave Events */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-100 dark:border-white/5 pb-2">Leave Management</h4>

                                <div className="flex items-center justify-between group">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-primary transition-colors">Request Generated</p>
                                    </div>
                                    <button onClick={() => upd('notifyOnLeaveRequest', !notifications.notifyOnLeaveRequest)}
                                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveRequest ? 'btn-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifications.notifyOnLeaveRequest ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between group">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-500 transition-colors">Request Approved</p>
                                    </div>
                                    <button onClick={() => upd('notifyOnLeaveApproval', !notifications.notifyOnLeaveApproval)}
                                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveApproval ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifications.notifyOnLeaveApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between group">
                                    <div className="flex-1 pr-4">
                                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-rose-500 transition-colors">Request Rejected</p>
                                    </div>
                                    <button onClick={() => upd('notifyOnLeaveRejection', !notifications.notifyOnLeaveRejection)}
                                        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveRejection ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifications.notifyOnLeaveRejection ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Support Events */}
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Help & Support</h4>
                            <div className="flex items-center justify-between group max-w-sm">
                                <div className="flex-1 pr-4">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary dark:group-hover:text-primary transition-colors">Ticket Created</p>
                                    <p className="text-[10px] text-slate-500">Notify admins when a new support ticket is raised</p>
                                </div>
                                <button onClick={() => upd('notifyOnSupportTicket', !notifications.notifyOnSupportTicket)}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnSupportTicket ? 'btn-primary' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${notifications.notifyOnSupportTicket ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column: Scheduling */}
                <div className="lg:col-span-4 space-y-8">
                    <SectionCard title="Reminder Cadence" subtitle="Schedule for automated pings" icon={Mail}>
                        <div className="space-y-6 py-2">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Timesheet Deadline</label>
                                <input
                                    className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    value={notifications.timesheetReminder}
                                    onChange={e => upd('timesheetReminder', e.target.value)}
                                    placeholder="e.g. Friday 15:00"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Freeze Warning</label>
                                <input
                                    className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    value={notifications.freezeReminder}
                                    onChange={e => upd('freezeReminder', e.target.value)}
                                    placeholder="e.g. Monday 10:00"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Approval Digest</label>
                                <input
                                    className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                    value={notifications.approvalReminder}
                                    onChange={e => upd('approvalReminder', e.target.value)}
                                    placeholder="e.g. Daily 09:00"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <div className="p-5 rounded-3xl btn-primary text-white shadow-xl shadow-primary/20">
                        <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Delivery Note</p>
                        <p className="text-[11px] font-medium leading-relaxed opacity-90">
                            Scheduled notifications strictly follow the organization's primary timezone. Instant triggers (like approvals) are dispatched immediately.
                        </p>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl btn-primary hover:btn-primary hover:bg-primary-700 text-white font-black uppercase tracking-widest shadow-xl shadow-primary/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Sync Preferences
                </button>
            </div>
        </div >
    )
}
