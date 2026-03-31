import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard, Clock, List, CheckSquare, Users, FolderOpen,
    Megaphone, BarChart3, ChevronLeft, ChevronRight,
    Timer, ClipboardList, Settings2, ListTodo, AlertCircle,
    Banknote, ChevronDown, Shield, Activity, LogOut
} from 'lucide-react'

import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { clsx } from 'clsx'
import { Lock } from 'lucide-react'
import { authAPI } from '@/services/endpoints'

import { hasPermission } from '@/utils/rbac'
import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { FEATURE_KEYS } from '@/constants/plans'

const navSections = [
    {
        label: 'Super Admin',
        items: [
            { to: '/admin/dashboard', icon: BarChart3, label: 'Super Dashboard', roles: ['super_admin'] },
        ]
    },
    {
        label: 'Timesheets',
        items: [
            { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', permission: { module: 'Timesheets', submodule: 'Dashboard', action: 'view' }, end: true, tourId: 'tour-dashboard' },
            { to: '/timesheets', icon: Clock, label: 'Timesheet Entry', permission: { module: 'Timesheets', submodule: 'Entry', action: 'view' }, end: true, tourId: 'tour-timesheets' },
            { to: '/timesheets/history', icon: List, label: 'History', permission: { module: 'Timesheets', submodule: 'History', action: 'view' }, tourId: 'tour-history' },
            { to: '/timesheets/manage', icon: CheckSquare, label: 'Manage Timesheets', permission: { module: 'Timesheets', submodule: 'Management', action: 'view' }, tourId: 'tour-manage-timesheets' },
            { to: '/timesheets/compliance', icon: AlertCircle, label: 'Compliance & Locks', permission: { module: 'Settings', submodule: 'Audit Logs', action: 'view' }, featureKey: FEATURE_KEYS.AUDIT_LOGS },
        ]
    },
    {
        label: 'Workspace',
        items: [
            { to: '/leaves', icon: ClipboardList, label: 'Leave Tracker', permission: { module: 'Leave Management', submodule: 'Leave Tracker', action: 'view' }, end: true, featureKey: FEATURE_KEYS.LEAVE_MANAGEMENT, tourId: 'tour-leaves' },
            { to: '/leaves/manage', icon: ClipboardList, label: 'Leave Management', permission: { module: 'Leave Management', submodule: 'Leave Requests', action: 'view' }, featureKey: FEATURE_KEYS.LEAVE_MANAGEMENT },
            { to: '/my-payslips', icon: Banknote, label: 'My Payslips', permission: { module: 'My Payslip', submodule: 'Payslip View', action: 'view' }, featureKey: FEATURE_KEYS.PAYSLIPS },
            { to: '/announcements', icon: Megaphone, label: 'Announcements', permission: { module: 'Announcements', submodule: 'Announcements', action: 'view' } },
            { to: '/incidents', icon: AlertCircle, label: 'Help & Support', permission: { module: 'Support', submodule: 'Help & Support', action: 'view' }, featureKey: FEATURE_KEYS.SUPPORT },
        ]
    },
    {
        label: 'Management',
        items: [
            { to: '/projects', icon: FolderOpen, label: 'Projects', permission: { module: 'Projects', submodule: 'Project List', action: 'view' } },
            { to: '/tasks', icon: ListTodo, label: 'Tasks', permission: { module: 'Tasks', submodule: 'Task Management', action: 'view' } },
            { to: '/employees', icon: Users, label: 'Employees', permission: { module: 'Employees', submodule: 'Employee List', action: 'view' } },
            {
                label: 'Payroll',
                icon: Banknote,
                permission: { module: 'Payroll' },
                featureKey: FEATURE_KEYS.PAYROLL,
                tourId: 'tour-payroll',
                subItems: [
                    { to: '/payroll/dashboard', label: 'Dashboard', permission: { module: 'Payroll', submodule: 'Dashboard', action: 'view' } },
                    { to: '/payroll/profiles', label: 'Payroll Profiles', permission: { module: 'Payroll', submodule: 'Payroll Engine', action: 'view' } },
                    { to: '/payroll/salary-structures', label: 'Salary Structures', permission: { module: 'Payroll', submodule: 'Payroll Engine', action: 'view' } },
                    { to: '/payroll/run', label: 'Payroll Engine', permission: { module: 'Payroll', submodule: 'Payroll Engine', action: 'view' } },
                    { to: '/payroll/history', label: 'Execution Ledger', permission: { module: 'Payroll', submodule: 'Execution Ledger', action: 'view' } },
                    { to: '/payroll/payslip', label: 'Payslip Generation', permission: { module: 'Payroll', submodule: 'Payslip Generation', action: 'view' } },
                    { to: '/payroll/taxes', label: 'Taxes & Deductions', permission: { module: 'Payroll', submodule: 'Payroll Engine', action: 'view' } },
                    { to: '/payroll/reports', label: 'Payroll Reports', permission: { module: 'Payroll', submodule: 'Payroll Reports', action: 'view' } },
                    { to: '/payroll/export', label: 'Bank Export', permission: { module: 'Payroll', submodule: 'Bank Export', action: 'view' } },
                ]
            },
            { to: '/reports', icon: BarChart3, label: 'Reports', permission: { module: 'Reports', submodule: 'Reports Dashboard', action: 'view' }, featureKey: FEATURE_KEYS.REPORTS, tourId: 'tour-reports' },
            { to: '/audit-logs', icon: Shield, label: 'Audit Logs', permission: { module: 'Settings', submodule: 'Audit Logs', action: 'view' }, featureKey: FEATURE_KEYS.AUDIT_LOGS },
            { to: '/settings', icon: Settings2, label: 'Settings', permission: { module: 'Settings', submodule: 'Users & Roles', action: 'view' }, tourId: 'tour-settings' },
        ]
    },
]

export default function Sidebar() {
    const { user, logout } = useAuthStore()
    const { sidebarOpen, setSidebar } = useUIStore()
    const { general, payroll, fetchGeneralSettings, fetchPayrollSettings } = useSettingsStore()
    const { isFeatureLocked, planType } = useFeatureAccess()
    const navigate = useNavigate()
    const location = useLocation()

    useEffect(() => {
        if (!general) fetchGeneralSettings()
        if (!payroll) fetchPayrollSettings()
        // Debug: Log user state to help identify missing role/permissions
        console.log('[Sidebar Debug] User:', user);
        console.log('[Sidebar Debug] Role:', user?.role);
        console.log('[Sidebar Debug] Permissions:', user?.permissions);
    }, [user])

    // Auto-expand Payroll when on any payroll route
    const isOnPayroll = location.pathname.startsWith('/payroll')
    const [expandedItem, setExpandedItem] = useState(isOnPayroll ? 'Payroll' : null)

    useEffect(() => {
        if (isOnPayroll) setExpandedItem('Payroll')
    }, [isOnPayroll])

    const [currentTime, setCurrentTime] = useState(new Date())
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const formatTime = () => {
        const tz = general?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz }).format(currentTime)
    }

    const formatDate = () => {
        const tz = general?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).format(currentTime)
    }

    const companyName = general?.companyName || 'CALTIMS'

    // Analog clock
    const secondsDeg = currentTime.getSeconds() * 6
    const minutesDeg = currentTime.getMinutes() * 6
    const hoursDeg = (currentTime.getHours() % 12) * 30 + currentTime.getMinutes() * 0.5

    const fullInitials = user?.name
        ? user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
        : '?'

    const getRoleColor = (role) => {
        switch (role) {
            case 'admin': return 'text-primary-600 dark:text-primary-400'
            case 'manager': return 'text-emerald-600 dark:text-emerald-400'
            case 'hr': return 'text-violet-600 dark:text-violet-400'
            case 'finance': return 'text-amber-600 dark:text-amber-400'
            default: return 'text-slate-500'
        }
    }

    const handleLogout = async () => {
        if (useUIStore.getState().hasUnsavedChanges) {
            useUIStore.getState().setPendingNavTarget('/login')
            return
        }
        try {
            await authAPI.logout()
            logout()
        } catch {
            logout()
        } finally {
            navigate('/login', { replace: true })
        }
    }

    if (!user) return null

    return (
        <aside className={clsx(
            'fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-[#080d14] border-r border-slate-100 dark:border-slate-800/60 transition-all duration-300',
            'shadow-[1px_0_16px_0_rgb(0_0_0/0.04)]',
            'group/sidebar',
            sidebarOpen
                ? 'w-64 translate-x-0'
                : 'w-[280px] -translate-x-full md:w-[68px] md:translate-x-0 md:hover:w-64 hover:shadow-xl hover:shadow-black/5'
        )}>
            <style>{`
                @keyframes logo-3d {
                    0%   { transform: perspective(1000px) rotateX(0deg) rotateY(0deg); }
                    25%  { transform: perspective(1000px) rotateX(4deg) rotateY(8deg); }
                    75%  { transform: perspective(1000px) rotateX(-4deg) rotateY(-8deg); }
                    100% { transform: perspective(1000px) rotateX(0deg) rotateY(0deg); }
                }
                .logo-3d-container { transform-style: preserve-3d; transition: all 0.4s cubic-bezier(0.4,0,0.2,1); }
                .group\\/sidebar:hover .logo-3d-container { animation: logo-3d 5s infinite ease-in-out; }
            `}</style>

            {/* ─── Logo ───────────────────────────────────────── */}
            <div
                onClick={() => {
                    const target = user?.role === 'super_admin' ? '/admin/dashboard' : '/dashboard'
                    if (useUIStore.getState().hasUnsavedChanges) {
                        useUIStore.getState().setPendingNavTarget(target)
                        return
                    }
                    navigate(target)
                }}
                className={clsx(
                    'flex items-center border-b border-slate-100 dark:border-slate-800/60 flex-shrink-0 transition-all duration-300 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-white/5 active:scale-[0.98] logo-3d-container',
                    sidebarOpen
                        ? 'gap-3 px-4 py-3.5'
                        : 'justify-center px-0 py-3.5 group-hover/sidebar:justify-start group-hover/sidebar:px-4 group-hover/sidebar:gap-3'
                )}
            >
                {/* Clock icon */}
                <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm relative overflow-hidden">
                    {/* Ticks */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="absolute top-1.5 w-[2px] h-[3px] bg-white/40 rounded-full" />
                        <div className="absolute right-1.5 w-[3px] h-[2px] bg-white/40 rounded-full" />
                        <div className="absolute bottom-1.5 w-[2px] h-[3px] bg-white/40 rounded-full" />
                        <div className="absolute left-1.5 w-[3px] h-[2px] bg-white/40 rounded-full" />
                    </div>
                    {/* Hands */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute w-[2px] h-[6px] bg-white rounded-full origin-bottom" style={{ transform: `translateY(-3px) rotate(${hoursDeg}deg)`, bottom: '50%' }} />
                        <div className="absolute w-[1.5px] h-[9px] bg-white/75 rounded-full origin-bottom" style={{ transform: `translateY(-4.5px) rotate(${minutesDeg}deg)`, bottom: '50%' }} />
                        <div className="absolute w-[1px] h-[11px] bg-amber-300 rounded-full origin-bottom" style={{ transform: `translateY(-5.5px) rotate(${secondsDeg}deg)`, bottom: '50%', filter: 'drop-shadow(0 0 2px rgb(252 211 77 / 0.8))' }} />
                        <div className="w-1 h-1 rounded-full bg-white z-10 ring-1 ring-white/30" />
                    </div>
                </div>

                {(sidebarOpen) && (
                    <div className="overflow-hidden min-w-0">
                        <span className="font-bold text-sm text-slate-800 dark:text-white block leading-tight truncate">{companyName}</span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Payroll Suite</span>
                    </div>
                )}
                {!sidebarOpen && (
                    <div className="overflow-hidden w-0 group-hover/sidebar:w-auto transition-all duration-300 opacity-0 group-hover/sidebar:opacity-100 flex flex-col min-w-0">
                        <span className="font-bold text-sm text-slate-800 dark:text-white block leading-tight whitespace-nowrap">{companyName}</span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase whitespace-nowrap">Payroll Suite</span>
                    </div>
                )}
            </div>

            {/* ─── Navigation ─────────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto py-3 space-y-4 px-2 no-scrollbar">
                {navSections.map((section) => {
                    const sectionItems = section.items.map(item => {
                        if (item.label === 'Payroll' && item.subItems) {
                            const isHourly = payroll?.calculationBasis === 'Hourly Rate'
                            let subs = item.subItems.filter(sub => {
                                if (isHourly && sub.label === 'Salary Structures') return false
                                return true
                            })
                            if (isHourly) {
                                const procIdx = subs.findIndex(s => s.label === 'Payroll Engine')
                                if (!subs.find(s => s.label === 'Hour Management')) {
                                    subs.splice(procIdx >= 0 ? procIdx : 2, 0, {
                                        to: '/payroll/hour-management', label: 'Hour Management',
                                        roles: ['admin', 'manager', 'finance', 'hr']
                                    })
                                }
                            }
                            return { ...item, subItems: subs }
                        }
                        return item
                    })

                    const visibleItems = sectionItems.filter(item => {
                        // 1. Role Check
                        if (item.roles && !item.roles.includes(user?.role)) {
                            // Even if role is missing, super_admin can see it (if we want that)
                            // or maybe only items specifically for super_admin should be seen by them?
                            // Usually, Super Admin sees EVERYTHING.
                            if (user?.role !== 'super_admin') return false
                        }
                        
                        // 2. Permission Check
                        if (!item.permission) return true
                        return hasPermission(user, item.permission.module, item.permission.submodule, item.permission.action)
                    })
                    if (visibleItems.length === 0) return null

                    return (
                        <div key={section.label}>
                            {/* Section label */}
                            {sidebarOpen ? (
                                <p className="px-2.5 mb-1 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest select-none">
                                    {section.label}
                                </p>
                            ) : (
                                <>
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 mx-2 mb-2 mt-1 group-hover/sidebar:hidden" />
                                    <p className="px-2.5 mb-1 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest select-none hidden group-hover/sidebar:block">
                                        {section.label}
                                    </p>
                                </>
                            )}

                            <div className="space-y-0.5">
                                {visibleItems.map((item) => {
                                    const hasSubItems = item.subItems && item.subItems.length > 0
                                    const isExpanded = expandedItem === item.label

                                    if (hasSubItems) {
                                        return (
                                            <div key={item.label} className="space-y-0.5">
                                                <button
                                                    id={item.tourId}
                                                    onClick={() => setExpandedItem(isExpanded ? null : item.label)}
                                                    className={clsx(
                                                        'w-full group relative flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer text-left',
                                                        sidebarOpen
                                                            ? 'px-2.5'
                                                            : 'px-0 justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-2.5',
                                                        isExpanded
                                                            ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400'
                                                            : 'text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300',
                                                        item.featureKey && isFeatureLocked(item.featureKey) && 'opacity-50 grayscale cursor-not-allowed pointer-events-none select-none'
                                                    )}
                                                >
                                                    <item.icon
                                                        size={17}
                                                        className={clsx(
                                                            'flex-shrink-0',
                                                            isExpanded ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'
                                                        )}
                                                    />
                                                    {sidebarOpen && <span className="flex-1 truncate">{item.label}</span>}
                                                    {sidebarOpen && (
                                                        <ChevronDown size={13}
                                                            className={clsx('text-slate-400 transition-transform duration-200', isExpanded ? 'rotate-180' : '')}
                                                        />
                                                    )}
                                                    {!sidebarOpen && (
                                                        <span className="truncate hidden group-hover/sidebar:block flex-1 text-left">{item.label}</span>
                                                    )}
                                                </button>

                                                {isExpanded && sidebarOpen && (
                                                    <div className="ml-8 space-y-0.5 border-l-2 border-slate-100 dark:border-slate-800 pl-3">
                                                        {item.subItems
                                                            .filter(sub => {
                                                                if (!sub.permission) return true
                                                                return hasPermission(user, sub.permission.module, sub.permission.submodule, sub.permission.action)
                                                            })
                                                            .map(sub => (
                                                                <NavLink
                                                                    key={sub.to}
                                                                    to={sub.to}
                                                                    className={({ isActive }) => clsx(
                                                                        'block py-2 text-sm transition-colors rounded-lg px-3 font-medium',
                                                                        isActive
                                                                            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-semibold'
                                                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                                                                    )}
                                                                    onClick={(e) => {
                                                                        if (useUIStore.getState().hasUnsavedChanges) {
                                                                            e.preventDefault()
                                                                            useUIStore.getState().setPendingNavTarget(sub.to)
                                                                            return
                                                                        }
                                                                        if (window.innerWidth < 1024) setSidebar(false)
                                                                    }}
                                                                >
                                                                    {sub.label}
                                                                </NavLink>
                                                            ))}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    }

                                    return (
                                        <NavLink
                                            id={item.tourId}
                                            key={`${item.to}-${item.label}`}
                                            to={item.to}
                                            end={item.end}
                                            className={({ isActive }) => clsx(
                                                'group relative flex items-center gap-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer',
                                                sidebarOpen
                                                    ? 'px-2.5'
                                                    : 'px-0 justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-2.5',
                                                isActive
                                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-semibold'
                                                    : 'text-slate-500 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-300',
                                                item.featureKey && isFeatureLocked(item.featureKey) && 'opacity-50 grayscale cursor-not-allowed'
                                            )}
                                            title={!sidebarOpen ? item.label : undefined}
                                            onClick={(e) => { 
                                                if (item.featureKey && isFeatureLocked(item.featureKey)) {
                                                    e.preventDefault();
                                                    toast.error(`The ${item.label} module is locked in the ${planType} plan. Please upgrade to Pro.`);
                                                    return;
                                                }
                                                if (useUIStore.getState().hasUnsavedChanges) {
                                                    e.preventDefault();
                                                    useUIStore.getState().setPendingNavTarget(item.to);
                                                    return;
                                                }
                                                if (window.innerWidth < 1024) setSidebar(false) 
                                            }}
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    {isActive && (
                                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary-600 dark:bg-primary-400 rounded-r-full" />
                                                    )}
                                                    <item.icon
                                                        size={17}
                                                        className={clsx(
                                                            'flex-shrink-0',
                                                            isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'
                                                        )}
                                                    />
                                                    {sidebarOpen && (
                                                        <span className="truncate flex-1 text-left">{item.label}</span>
                                                    )}
                                                    {sidebarOpen && item.featureKey && isFeatureLocked(item.featureKey) && (
                                                        <span className={clsx(
                                                            "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border",
                                                            "bg-primary-50 text-primary-600 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800"
                                                        )}>
                                                            <Lock size={8} className="inline mr-0.5" />
                                                            LOCKED
                                                        </span>

                                                    )}
                                                    {!sidebarOpen && (
                                                        <span className="hidden group-hover/sidebar:block truncate flex-1 text-left">{item.label}</span>
                                                    )}
                                                    {!sidebarOpen && (
                                                        <span className="absolute left-full ml-2.5 px-2 py-1 bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 group-hover/sidebar:hidden">
                                                            {item.label}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </NavLink>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </nav>
        </aside>
    )
}
