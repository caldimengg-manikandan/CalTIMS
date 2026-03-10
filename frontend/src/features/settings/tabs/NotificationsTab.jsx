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
        emailNotifications: true,
        inAppNotifications: true,
        notifyOnTimesheetSubmission: true,
        notifyOnTimesheetApproval: true,
        notifyOnTimesheetRejection: true,
        notifyOnLeaveRequest: true,
        notifyOnLeaveApproval: true,
        notifyOnLeaveRejection: true,
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
                emailNotifications: !!data.notifications.emailNotifications,
                inAppNotifications: !!data.notifications.inAppNotifications,
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Delivery Channels */}
                <div className="lg:col-span-2 space-y-8">
                    <SectionCard title="Delivery Channels" subtitle="Global switches for notification paths" icon={BellRing}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-5 rounded-3xl bg-white dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 transition-all hover:border-indigo-200">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${notifications.emailNotifications ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <Mail size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Email Alerts</p>
                                        <p className="text-[10px] text-slate-400 font-medium">External inbox delivery</p>
                                    </div>
                                </div>
                                <button onClick={() => upd('emailNotifications', !notifications.emailNotifications)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${notifications.emailNotifications ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.emailNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-5 rounded-3xl bg-white dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 transition-all hover:border-indigo-200">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-2xl ${notifications.inAppNotifications ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                        <BellRing size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">In-App Notifs</p>
                                        <p className="text-[10px] text-slate-400 font-medium">Dashboard notification bell</p>
                                    </div>
                                </div>
                                <button onClick={() => upd('inAppNotifications', !notifications.inAppNotifications)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${notifications.inAppNotifications ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                    <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${notifications.inAppNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Notification Events" subtitle="Contextual alerts for workflows" icon={Check}>
                        <div className="space-y-3">
                            {[
                                { title: 'Timesheet Reminders', desc: 'Alert users with outstanding entries', key: 'timesheetReminder' },
                                { title: 'Submission Confirmations', desc: 'Notify managers on employee submission', key: 'inAppNotifications' }, // Reusing keys for demo logic
                                { title: 'Approval Alerts', desc: 'Notify employees on approval/rejection', key: 'emailNotifications' }
                            ].map((event, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{event.title}</p>
                                        <p className="text-[11px] text-slate-500 font-medium">{event.desc}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-black text-[10px]">
                                        ON
                                    </div>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>

                {/* Scheduling */}
                <div className="space-y-8">
                    <SectionCard title="Reminder Cadence" subtitle="Schedule for automated pings" icon={Mail}>
                        <div className="space-y-5">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Timesheet Deadline</label>
                                <input
                                    className="input w-full h-11 text-sm font-bold"
                                    value={notifications.timesheetReminder}
                                    onChange={e => upd('timesheetReminder', e.target.value)}
                                    placeholder="e.g. Friday 15:00"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Freeze Warning</label>
                                <input
                                    className="input w-full h-11 text-sm font-bold"
                                    value={notifications.freezeReminder}
                                    onChange={e => upd('freezeReminder', e.target.value)}
                                    placeholder="e.g. Monday 10:00"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Approval Digest</label>
                                <input
                                    className="input w-full h-11 text-sm font-bold"
                                    value={notifications.approvalReminder}
                                    onChange={e => upd('approvalReminder', e.target.value)}
                                    placeholder="e.g. Daily 09:00"
                                />
                            </div>
                        </div>
                    </SectionCard>

                    <div className="p-4 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/20">
                        <p className="text-xs font-black uppercase tracking-widest opacity-80 mb-2">Pro Tip</p>
                        <p className="text-xs font-medium leading-relaxed">
                            Scheduled notifications follow the organization's timezone set in the General tab.
                        </p>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    <SectionCard title="Event Triggers" subtitle="Specific actions that generate notifications" icon={Mail}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-indigo-200">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timesheet Submission</span>
                                <button onClick={() => upd('notifyOnTimesheetSubmission', !notifications.notifyOnTimesheetSubmission)}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetSubmission ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.notifyOnTimesheetSubmission ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-emerald-200">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timesheet Approval</span>
                                <button onClick={() => upd('notifyOnTimesheetApproval', !notifications.notifyOnTimesheetApproval)}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetApproval ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.notifyOnTimesheetApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-rose-200">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Timesheet Rejection</span>
                                <button onClick={() => upd('notifyOnTimesheetRejection', !notifications.notifyOnTimesheetRejection)}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnTimesheetRejection ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.notifyOnTimesheetRejection ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-indigo-200">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Request</span>
                                <button onClick={() => upd('notifyOnLeaveRequest', !notifications.notifyOnLeaveRequest)}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveRequest ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.notifyOnLeaveRequest ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-emerald-200">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Approval</span>
                                <button onClick={() => upd('notifyOnLeaveApproval', !notifications.notifyOnLeaveApproval)}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveApproval ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.notifyOnLeaveApproval ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 transition-all hover:border-rose-200">
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Rejection</span>
                                <button onClick={() => upd('notifyOnLeaveRejection', !notifications.notifyOnLeaveRejection)}
                                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${notifications.notifyOnLeaveRejection ? 'bg-rose-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications.notifyOnLeaveRejection ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </SectionCard>
                </div>
            </div >

            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Sync Preferences
                </button>
            </div>
        </div >
    )
}
