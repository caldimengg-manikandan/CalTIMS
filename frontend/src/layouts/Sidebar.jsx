import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard, Clock, List, CheckSquare, Users, FolderOpen,
    Megaphone, BarChart3, ChevronLeft, ChevronRight,
    Timer, ClipboardList, Settings2, ListTodo, AlertCircle
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { clsx } from 'clsx'
import { toast } from 'react-hot-toast'
import { Lock } from 'lucide-react'

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
            { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager', 'employee', 'super_admin'], end: true },
            { to: '/timesheets', icon: Clock, label: 'Timesheet Entry', roles: ['admin', 'manager', 'employee', 'super_admin'], end: true },
            { to: '/timesheets/history', icon: List, label: 'History', roles: ['admin', 'manager', 'employee', 'super_admin'] },
            { to: '/timesheets/manage', icon: CheckSquare, label: 'Manage Timesheets', roles: ['admin', 'manager', 'super_admin'] },
            { to: '/timesheets/compliance', icon: AlertCircle, label: 'Compliance & Locks', roles: ['admin', 'manager', 'super_admin'], proFeature: true },
        ]
    },
    {
        label: 'Workspace',
        items: [
            { to: '/leaves', icon: ClipboardList, label: 'Leave Tracker', roles: ['employee', 'manager', 'admin', 'super_admin'], proFeature: true, end: true },
            { to: '/leaves/manage', icon: ClipboardList, label: 'Leave Management', roles: ['admin', 'manager', 'super_admin'], proFeature: true },
            { to: '/announcements', icon: Megaphone, label: 'Announcements', roles: ['admin', 'super_admin'] },
            { to: '/incidents', icon: AlertCircle, label: 'Help & Support', roles: ['admin', 'manager', 'employee', 'super_admin'], proFeature: true },
        ]
    },
    {
        label: 'Management',
        items: [
            { to: '/projects', icon: FolderOpen, label: 'Projects', roles: ['admin', 'manager', 'super_admin'] },
            { to: '/tasks', icon: ListTodo, label: 'Tasks', roles: ['admin', 'super_admin'] },
            { to: '/employees', icon: Users, label: 'Employees', roles: ['admin', 'super_admin'] },
            { to: '/reports', icon: BarChart3, label: 'Reports', roles: ['admin', 'manager', 'super_admin'], proFeature: true },
            { to: '/settings', icon: Settings2, label: 'Settings', roles: ['admin', 'super_admin'] },
        ]
    },
]

export default function Sidebar() {
    const { user, isPro, canAccess } = useAuthStore()
    const { sidebarOpen, toggleSidebar, setSidebar } = useUIStore()
    const { general } = useSettingsStore()
    const navigate = useNavigate()

    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    const formatTime = () => {
        const tz = general?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: tz
        }).format(currentTime)
    }

    const formatDate = () => {
        const tz = general?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            timeZone: tz
        }).format(currentTime)
    }

    const companyName = 'CALTIMS'

    // Analog clock degrees
    const secondsDeg = currentTime.getSeconds() * 6;
    const minutesDeg = currentTime.getMinutes() * 6;
    const hoursDeg = (currentTime.getHours() % 12) * 30 + currentTime.getMinutes() * 0.5;

    return (
        <aside className={clsx(
            'fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-black border-r border-slate-100 dark:border-white/10 transition-all duration-300 shadow-[2px_0_24px_0_rgba(var(--color-primary-rgb),0.06)] group/sidebar',
            sidebarOpen ? 'w-64 translate-x-0' : 'w-[280px] -translate-x-full md:w-[68px] md:translate-x-0 md:hover:w-64 hover:shadow-2xl hover:shadow-primary-500/10'
        )}>
            <style>{`
                @keyframes logo-3d {
                    0% { transform: perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
                    25% { transform: perspective(1000px) rotateX(5deg) rotateY(10deg) rotateZ(2deg); }
                    50% { transform: perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
                    75% { transform: perspective(1000px) rotateX(-5deg) rotateY(-10deg) rotateZ(-2deg); }
                    100% { transform: perspective(1000px) rotateX(0deg) rotateY(0deg) rotateZ(0deg); }
                }
                .logo-3d-container {
                    transform-style: preserve-3d;
                    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .group\\/sidebar:hover .logo-3d-container {
                    animation: logo-3d 6s infinite ease-in-out;
                }
                .logo-3d-card {
                    transform: translateZ(20px);
                }
            `}</style>
            {/* ── Logo ─────────────────────────────────────── */}
            <div
                onClick={() => {
                    const target = user?.role === 'super_admin' ? '/admin/dashboard' : '/dashboard'
                    navigate(target)
                }}
                className={clsx(
                    'flex items-center border-b border-slate-100 dark:border-white/10 flex-shrink-0 transition-all duration-300 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 active:scale-95 logo-3d-container',
                    sidebarOpen ? 'gap-3 px-5 py-4' : 'justify-center px-0 py-4 group-hover/sidebar:justify-start group-hover/sidebar:px-5 group-hover/sidebar:gap-3'
                )}
            >
                <div className="w-12 h-12 rounded-[1.25rem] bg-black/80 backdrop-blur-xl flex items-center justify-center flex-shrink-0 shadow-2xl shadow-black relative logo-3d-card overflow-hidden border border-white/20 group/logo-inner">

                    {/* Minimalist Clock Markers (Ticks instead of numbers to avoid merging) */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[2]">
                        <div className="absolute top-2 w-[2px] h-[4px] bg-white/40 rounded-full" />
                        <div className="absolute right-2 w-[4px] h-[2px] bg-white/40 rounded-full" />
                        <div className="absolute bottom-2 w-[2px] h-[4px] bg-white/40 rounded-full" />
                        <div className="absolute left-2 w-[4px] h-[2px] bg-white/40 rounded-full" />
                    </div>

                    {/* Analog Clock Hands Overlay (Ultra-Thin Tech Style) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[3]">
                        {/* Hour Hand */}
                        <div
                            className="absolute w-[2px] h-[7px] bg-white rounded-full origin-bottom"
                            style={{
                                transform: `translateY(-3.5px) rotate(${hoursDeg}deg)`,
                                bottom: '50%'
                            }}
                        />

                        {/* Minute Hand */}
                        <div
                            className="absolute w-[1.5px] h-[11px] bg-white/70 rounded-full origin-bottom"
                            style={{
                                transform: `translateY(-5.5px) rotate(${minutesDeg}deg)`,
                                bottom: '50%'
                            }}
                        />

                        {/* Second Hand (Neon Focal Point) */}
                        <div
                            className="absolute w-[1px] h-[15px] bg-primary-400 rounded-full origin-bottom"
                            style={{
                                transform: `translateY(-7.5px) rotate(${secondsDeg}deg)`,
                                bottom: '50%',
                                filter: 'drop-shadow(0 0 3px rgba(96, 165, 250, 0.8))'
                            }}
                        />

                        {/* Center Cap */}
                        <div className="w-[4px] h-[4px] rounded-full bg-white z-[5] shadow-lg ring-1 ring-primary-500/30" />
                    </div>

                    {/* Premium Surface Reflections */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 translate-x-[-200%] group-hover/sidebar:translate-x-[200%] transition-transform duration-[2s] z-[4]" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-transparent pointer-events-none z-[5]" />
                </div>
                {(sidebarOpen) && (
                    <div className="overflow-hidden">
                        <span className="font-extrabold text-base text-primary-600 dark:text-primary-400 block leading-tight">{companyName}</span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">Workspace</span>
                    </div>
                )}
                {!sidebarOpen && (
                    <div className="overflow-hidden w-0 group-hover/sidebar:w-auto transition-all duration-300 opacity-0 group-hover/sidebar:opacity-100 flex flex-col">
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
                                            item.proFeature && !isPro() && 'opacity-60 grayscale'
                                        )}
                                        title={!sidebarOpen ? item.label : undefined}
                                        onClick={(e) => {
                                            if (item.proFeature && !isPro()) {
                                                // Allow navigation so ProGuard can show the upgrade screen
                                            }
                                            if (window.innerWidth < 1024) {
                                                setSidebar(false);
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
                                                        'flex-shrink-0 transition-colors pointer-events-none',
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
                                                            !isPro()
                                                                ? "bg-[#f3e8ff] text-[#9333ea] border-[#e9d5ff]"
                                                                : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20"
                                                        )}>
                                                        {!isPro() && <Lock size={10} />} PRO
                                                    </span>
                                                )}
                                                {!sidebarOpen && (
                                                    <span className="truncate hidden group-hover/sidebar:block flex-1 text-left">{item.label}</span>
                                                )}

                                                {/* Tooltip when collapsed */}
                                                {!sidebarOpen && (
                                                    <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-800 dark:bg-white text-white dark:text-black text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 group-hover/sidebar:hidden">
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
