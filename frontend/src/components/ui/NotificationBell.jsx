import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, X, Calendar, Clock, AlertCircle, Trash2, Ticket, MessageSquare, CheckCircle } from 'lucide-react'
import { notificationAPI } from '@/services/endpoints'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/store/authStore'

const typeIcons = {
    // Leaves
    LEAVE_APPLIED: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-black' },
    leave_applied: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-black' },
    LEAVE_APPROVED: { icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-black' },
    leave_approved: { icon: Calendar, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-black' },
    LEAVE_REJECTED: { icon: Calendar, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-black' },
    leave_rejected: { icon: Calendar, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-black' },
    LEAVE_CANCELLED: { icon: Calendar, color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-black' },
    leave_cancelled: { icon: Calendar, color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-black' },
    // Timesheets
    TIMESHEET_SUBMITTED: { icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-black' },
    timesheet_submitted: { icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-black' },
    TIMESHEET_APPROVED: { icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-black' },
    timesheet_approved: { icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-black' },
    TIMESHEET_REJECTED: { icon: Clock, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-black' },
    timesheet_rejected: { icon: Clock, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-black' },
    // Incidents
    INCIDENT_CREATED: { icon: Ticket, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-black' },
    incident_created: { icon: Ticket, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-black' },
    INCIDENT_UPDATED: { icon: Ticket, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-black' },
    incident_updated: { icon: Ticket, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-black' },
    INCIDENT_RESPONSE: { icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-black' },
    incident_response: { icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-black' },
    INCIDENT_RESOLVED: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-black' },
    incident_resolved: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-black' },
    // Projects
    PROJECT_ALLOCATED: { icon: CheckCircle, color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-black' },
}

function NotificationItem({ notif, onRead, onClose }) {
    const meta = typeIcons[notif.type] || { icon: AlertCircle, color: 'text-slate-400', bg: 'bg-slate-50' }
    const Icon = meta.icon
    const navigate = useNavigate()

    const handleClick = () => {
        // Mark as read if not already
        if (!notif.isRead) {
            onRead(notif.id || notif._id)
        }

        // Navigate based on type
        const type = notif.type?.toUpperCase();
        switch (type) {
            case 'LEAVE_APPLIED':
            case 'LEAVE_APPROVED':
            case 'LEAVE_REJECTED':
            case 'LEAVE_CANCELLED':
                navigate('/leaves')
                break
            case 'TIMESHEET_SUBMITTED':
                navigate('/timesheets/manage')
                break
            case 'TIMESHEET_APPROVED':
            case 'TIMESHEET_REJECTED':
                navigate('/timesheets/history')
                break
            case 'INCIDENT_CREATED':
            case 'INCIDENT_UPDATED':
            case 'INCIDENT_RESPONSE':
            case 'INCIDENT_RESOLVED':
                if (notif.refId) navigate(`/incidents/${notif.refId}`)
                else navigate('/incidents')
                break
            case 'PROJECT_ALLOCATED':
                navigate('/projects')
                break
            default:
                if (notif.link) {
                    let cleanLink = notif.link.replace(/^\/app/, '');
                    // Handle legacy links that might have pointed to ID-based routes that don't exist
                    if (cleanLink.startsWith('/timesheets/') && !cleanLink.includes('/history') && !cleanLink.includes('/manage')) {
                        cleanLink = '/timesheets/manage';
                    }
                    if (cleanLink.startsWith('/leaves/') && !cleanLink.includes('/manage')) {
                        cleanLink = '/leaves';
                    }
                    navigate(cleanLink);
                }
                break
        }

        // Close the dropdown
        onClose()
    }

    return (
        <div
            onClick={handleClick}
            className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white dark:hover:text-black transition-colors border-b border-slate-50 dark:border-white/50 last:border-0 ${!notif.isRead ? 'bg-primary-50/40 dark:bg-black' : ''}`}
        >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                <Icon size={16} className={meta.color} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold leading-tight ${notif.isRead ? 'text-slate-600 dark:text-slate-200' : 'text-slate-800 dark:text-white'}`}>
                        {notif.title}
                    </p>
                    {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1" />
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-white mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                </p>
            </div>
        </div>
    )
}

export default function NotificationBell() {
    const [open, setOpen] = useState(false)
    const [confirmClear, setConfirmClear] = useState(false)
    const dropdownRef = useRef(null)
    const queryClient = useQueryClient()

    // Real-time listener
    const userId = useAuthStore(s => s.user?.id)

    const handleNewNotification = useCallback((notification) => {
        // Show standard success toast instead of custom bell notification
        toast.success(notification.title || notification.message || 'New notification');

        // Refresh count and list
        queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
        if (open) {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    }, [queryClient, open]);
    
    useSocket('notification', handleNewNotification);

    // Poll unread count every 5s for on-time updates
    const { data: countData } = useQuery({
        queryKey: ['notif-unread-count'],
        queryFn: () => notificationAPI.getUnreadCount().then(r => r.data.data),
    })

    const unreadCount = countData?.count || 0

    const { data: notifData, isLoading } = useQuery({
        queryKey: ['notifications'],
        queryFn: () => notificationAPI.getAll({ limit: 5000 }).then(r => r.data.data),
        enabled: open,
    })

    const notifications = notifData?.notifications || []

    const markReadMutation = useMutation({
        mutationFn: (id) => notificationAPI.markRead(id),
        onMutate: async (id) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['notifications'] })
            await queryClient.cancelQueries({ queryKey: ['notif-unread-count'] })

            // Snapshot the previous value
            const previousNotifs = queryClient.getQueryData(['notifications'])
            const previousCount = queryClient.getQueryData(['notif-unread-count'])

            // Optimistically update to the new value
            if (previousNotifs) {
                queryClient.setQueryData(['notifications'], {
                    ...previousNotifs,
                    notifications: previousNotifs.notifications.map(n =>
                        (n.id === id || n._id === id) ? { ...n, isRead: true } : n
                    )
                })
            }
            if (previousCount) {
                queryClient.setQueryData(['notif-unread-count'], {
                    ...previousCount,
                    count: Math.max(0, previousCount.count - 1)
                })
            }

            return { previousNotifs, previousCount }
        },
        onError: (err, id, context) => {
            queryClient.setQueryData(['notifications'], context.previousNotifs)
            queryClient.setQueryData(['notif-unread-count'], context.previousCount)
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
        },
    })

    const markAllMutation = useMutation({
        mutationFn: () => notificationAPI.markAllRead(),
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['notifications'] })
            await queryClient.cancelQueries({ queryKey: ['notif-unread-count'] })

            const previousNotifs = queryClient.getQueryData(['notifications'])
            const previousCount = queryClient.getQueryData(['notif-unread-count'])

            if (previousNotifs) {
                queryClient.setQueryData(['notifications'], {
                    ...previousNotifs,
                    notifications: previousNotifs.notifications.map(n => ({ ...n, isRead: true }))
                })
            }
            queryClient.setQueryData(['notif-unread-count'], { count: 0 })

            return { previousNotifs, previousCount }
        },
        onError: (err, variables, context) => {
            queryClient.setQueryData(['notifications'], context.previousNotifs)
            queryClient.setQueryData(['notif-unread-count'], context.previousCount)
        },
        onSettled: () => {
            toast.success('All notifications marked as read')
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
        },
    })

    const clearAllMutation = useMutation({
        mutationFn: () => notificationAPI.clearAll(),
        onSuccess: () => {
            toast.success('All notifications cleared')
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
        },
        onError: () => toast.error('Failed to clear notifications'),
    })

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false)
                setConfirmClear(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(!open)}
                className="p-2 text-slate-500 hover:bg-slate-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-colors relative"
                title="Notifications"
            >
                <Bell size={18} className="pointer-events-none" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-rose-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center border border-white dark:border-white leading-none">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-black rounded-2xl shadow-2xl border border-slate-100 dark:border-white overflow-hidden z-50 animate-in fade-in zoom-in duration-150 origin-top-right">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white">
                        <div className="flex items-center gap-2">
                            <Bell size={15} className="text-slate-500" />
                            <span className="font-semibold text-sm text-slate-800 dark:text-white">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-black text-primary-700 dark:text-white text-xs font-bold">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={() => markAllMutation.mutate()}
                                    disabled={markAllMutation.isPending}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 dark:text-white hover:bg-primary-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-colors"
                                >
                                    <CheckCheck size={13} className="pointer-events-none" />
                                    Mark all read
                                </button>
                            )}
                            {notifications.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (confirmClear) {
                                            clearAllMutation.mutate()
                                            setConfirmClear(false)
                                        } else {
                                            setConfirmClear(true)
                                            // Reset after 3 seconds if not clicked again
                                            setTimeout(() => setConfirmClear(false), 3000)
                                        }
                                    }}
                                    disabled={clearAllMutation.isPending}
                                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-all duration-200 ${confirmClear
                                        ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm px-3'
                                        : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                                        }`}
                                >
                                    <Trash2 size={13} className="pointer-events-none" />
                                    {confirmClear ? 'Sure?' : 'Clear'}
                                </button>
                            )}
                            <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                                <X size={14} className="pointer-events-none" />
                            </button>
                        </div>
                    </div>

                    {/* Notification list */}
                    <div className="max-h-[420px] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 px-4">
                                <Bell size={32} className="text-slate-200 dark:text-white mb-3" />
                                <p className="text-sm text-slate-400 dark:text-white">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <NotificationItem
                                    key={n.id || n._id}
                                    notif={n}
                                    onRead={(id) => markReadMutation.mutate(id)}
                                    onClose={() => setOpen(false)}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
