import React from 'react'
import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard, Clock, List, CheckSquare, Users, FolderOpen,
    Megaphone, BarChart3, ChevronLeft, ChevronRight,
    Timer, ClipboardList, Settings2, ListTodo, AlertCircle
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSystemStore } from '@/store/systemStore'
import { clsx } from 'clsx'
import { toast } from 'react-hot-toast'
import { Lock } from 'lucide-react'

const navSections = [
    {
        label: 'Timesheets',
        items: [
            { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'employee'], end: true },
            { to: '/timesheets', icon: Clock, label: 'Timesheet Entry', roles: ['admin', 'manager', 'employee'], end: true },
            { to: '/timesheets/history', icon: List, label: 'History', roles: ['admin', 'manager', 'employee'] },
            { to: '/timesheets/manage', icon: CheckSquare, label: 'Manage Timesheets', roles: ['admin', 'manager'] },
            { to: '/timesheets/compliance', icon: AlertCircle, label: 'Compliance & Locks', roles: ['admin', 'manager'], proFeature: true },
        ]
    },
    {
        label: 'Workspace',
        items: [
            { to: '/leaves', icon: ClipboardList, label: 'Leave Tracker', roles: ['employee', 'manager', 'admin'], proFeature: true, end: true },
            { to: '/leaves/manage', icon: ClipboardList, label: 'Leave Management', roles: ['admin', 'manager'], proFeature: true },
            { to: '/announcements', icon: Megaphone, label: 'Announcements', roles: ['admin'] },
            { to: '/incidents', icon: AlertCircle, label: 'Help & Support', roles: ['admin', 'manager', 'employee'], proFeature: true },
        ]
    },
    {
        label: 'Management',
        items: [
            { to: '/projects', icon: FolderOpen, label: 'Projects', roles: ['admin', 'manager'] },
            { to: '/tasks', icon: ListTodo, label: 'Tasks', roles: ['admin'] },
            { to: '/employees', icon: Users, label: 'Employees', roles: ['admin'] },
            { to: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'manager'], proFeature: true },
            { to: '/settings', icon: Settings2, label: 'Settings', roles: ['admin'] },
        ]
    },
]

export default function Sidebar() {
    const { user } = useAuthStore()
    const { sidebarOpen, toggleSidebar } = useUIStore()
    const { general } = useSettingsStore()
    const { appVersion } = useSystemStore()

    const companyName = 'CALTIMS'

    return (
        <aside className={clsx(
            'fixed inset-y-0 left-0 z-40 flex flex-col bg-white dark:bg-black border-r border-slate-100 dark:border-white/10 transition-all duration-300 shadow-[2px_0_24px_0_rgba(var(--color-primary-rgb),0.06)] group/sidebar',
            sidebarOpen ? 'w-64 translate-x-0' : 'w-[280px] -translate-x-full md:w-[68px] md:translate-x-0 md:hover:w-64 hover:shadow-2xl hover:shadow-primary-500/10'
        )}>
            {/* ── Logo ─────────────────────────────────────── */}
            <div className={clsx(
                'flex items-center border-b border-slate-100 dark:border-white/10 flex-shrink-0 transition-all duration-300',
                sidebarOpen ? 'gap-3 px-5 py-4' : 'justify-center px-0 py-4 group-hover/sidebar:justify-start group-hover/sidebar:px-5 group-hover/sidebar:gap-3'
            )}>
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-primary-200 dark:shadow-none">
                    <Timer size={18} className="text-white" />
                </div>
                {(sidebarOpen) && (
                    <div className="overflow-hidden">
                        <span className="font-extrabold text-base text-primary-600 dark:text-primary-400 block leading-tight">{companyName}</span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Workspace</span>
                    </div>
                )}
                {!sidebarOpen && (
                    <div className="overflow-hidden w-0 group-hover/sidebar:w-auto transition-all duration-300 opacity-0 group-hover/sidebar:opacity-100">
                        <span className="font-extrabold text-base text-primary-600 dark:text-primary-400 block leading-tight whitespace-nowrap">{companyName}</span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase whitespace-nowrap">Workspace</span>
                    </div>
                )}
            </div>

            {/* ── Navigation ───────────────────────────────── */}
            <nav className="flex-1 overflow-y-auto py-4 space-y-5 px-3">
                {navSections.map((section) => {
                    const visibleItems = section.items.filter(
                        item => !item.roles || item.roles.includes(user?.role)
                    )
                    if (visibleItems.length === 0) return null

                    return (
                        <div key={section.label}>
                            {/* Section Label */}
                            {(sidebarOpen) && (
                                <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
                                    {section.label}
                                </p>
                            )}
                            {!sidebarOpen && (
                                <>
                                    <div className="h-px bg-slate-100 dark:bg-white/10 mx-2 mb-2 mt-1 group-hover/sidebar:hidden" />
                                    <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none hidden group-hover/sidebar:block">
                                        {section.label}
                                    </p>
                                </>
                            )}

                            <div className="space-y-0.5">
                                {visibleItems.map((item) => (
                                    <NavLink
                                        key={`${item.to}-${item.label}`}
                                        to={item.to}
                                        end={item.end}
                                        className={({ isActive }) => clsx(
                                            'group relative flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                                            sidebarOpen ? 'px-3' : 'px-0 justify-center group-hover/sidebar:justify-start group-hover/sidebar:px-3',
                                            isActive
                                                ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-semibold shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white',
                                            item.proFeature && appVersion === 'basic' && 'opacity-60 grayscale cursor-not-allowed'
                                        )}
                                        title={!sidebarOpen ? item.label : undefined}
                                        onClick={(e) => {
                                            if (item.proFeature && appVersion === 'basic') {
                                                e.preventDefault()
                                                toast.error('This feature is available in the Pro version.', { icon: '🔒' })
                                            }
                                        }}
                                    >
                                        {({ isActive }) => (
                                            <>
                                                {/* Active left border accent */}
                                                {isActive && (
                                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary-600 rounded-r-full" />
                                                )}

                                                <item.icon
                                                    size={18}
                                                    className={clsx(
                                                        'flex-shrink-0 transition-colors',
                                                        isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 group-hover:text-primary-500'
                                                    )}
                                                />
                                                {sidebarOpen && (
                                                    <span className="truncate flex-1 text-left">{item.label}</span>
                                                )}
                                                {sidebarOpen && item.proFeature && (
                                                    <span
                                                        className={clsx(
                                                            "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md self-center border",
                                                            appVersion === 'basic'
                                                                ? "bg-[#f3e8ff] text-[#9333ea] border-[#e9d5ff]"
                                                                : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                                        )}>
                                                        {appVersion === 'basic' && <Lock size={10} />} PRO
                                                    </span>
                                                )}
                                                {!sidebarOpen && (
                                                    <span className="truncate hidden group-hover/sidebar:inline">{item.label}</span>
                                                )}

                                                {/* Tooltip when collapsed */}
                                                {!sidebarOpen && (
                                                    <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-800 dark:bg-white text-white dark:text-black text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                                                        {item.label}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </nav>
        </aside>
    )
}
