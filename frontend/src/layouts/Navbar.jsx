import React, { useState, useRef, useEffect } from 'react'
import { Moon, Sun, Menu, LogOut, Mail, Shield, X, Settings2, ArrowLeft, ChevronRight } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authAPI } from '@/services/endpoints'
import NotificationBell from '@/components/ui/NotificationBell'
import ActivityFeed from '@/features/audit/components/ActivityFeed'
import { useSettingsStore } from '@/store/settingsStore'
import { ROUTE_LABELS } from '@/components/ui/PageHeader'

export default function Navbar() {
    const { toggleSidebar, theme, toggleDarkMode } = useUIStore()
    const { user, logout } = useAuthStore()
    const { general } = useSettingsStore()
    const navigate = useNavigate()
    const location = useLocation()
    const [profileOpen, setProfileOpen] = useState(false)
    const [currentTime, setCurrentTime] = useState(new Date())

    const pathnames = location.pathname.split('/').filter(x => x)

    const getLabel = (part) => {
        // Match MongoDB ObjectID (24 hex) or UUID (36 chars with hyphens)
        if (/^[0-9a-fA-F]{24}$/.test(part) || /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(part)) {
            return 'Details'
        }
        return ROUTE_LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ')
    }

    const panelRef = useRef(null)
    const avatarRef = useRef(null)
    const timeoutRef = useRef(null)

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setProfileOpen(true)
    }

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setProfileOpen(false), 150)
    }

    const initial = user?.name?.charAt(0)?.toUpperCase() || '?'
    const fullInitials = user?.name
        ? user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
        : '?'

    const handleLogout = async () => {
        if (useUIStore.getState().hasUnsavedChanges) {
            setProfileOpen(false)
            useUIStore.getState().setPendingNavTarget('/login')
            return
        }
        try {
            await authAPI.logout()
            logout()
        } catch (err) {
            console.error('Logout error:', err)
            logout()
        } finally {
            navigate('/login', { replace: true })
        }
    }

    useEffect(() => {
        function handleClickOutside(e) {
            if (
                panelRef.current && !panelRef.current.contains(e.target) &&
                avatarRef.current && !avatarRef.current.contains(e.target)
            ) setProfileOpen(false)
        }
        if (profileOpen) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [profileOpen])

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => {
            clearInterval(timer)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
    }, [])

    const formatTime = () => {
        const tz = general?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz }).format(currentTime)
    }

    const formatDate = () => {
        const tz = general?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: tz }).format(currentTime)
    }

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'admin':   return 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
            case 'manager': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            case 'hr':      return 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
            case 'finance': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            default:        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        }
    }

    return (
        <>
            <header className="h-14 bg-white dark:bg-[#0a1120] border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between px-5 flex-shrink-0 z-30 relative">
                {/* Left */}
                <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 -ml-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 rounded-lg transition-all duration-150 shrink-0"
                        title="Toggle sidebar"
                    >
                        <Menu size={18} className="pointer-events-none" />
                    </button>

                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 min-w-0">
                        {location.pathname !== '/dashboard' && (
                            <button
                                onClick={() => navigate(-1)}
                                className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:hover:text-primary-400 rounded-md transition-all flex items-center gap-1 text-xs font-semibold shrink-0"
                                title="Go back"
                            >
                                <ArrowLeft size={13} strokeWidth={2.5} className="pointer-events-none" />
                            </button>
                        )}

                        <button
                            onClick={() => {
                                const t = user?.role === 'super_admin' ? '/admin/dashboard' : '/dashboard'
                                if (useUIStore.getState().hasUnsavedChanges) {
                                    useUIStore.getState().setPendingNavTarget(t)
                                    return
                                }
                                navigate(t)
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap shrink-0"
                        >
                            Home
                        </button>

                        {pathnames.map((part, index) => {
                            if (part === 'dashboard') return null
                            const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`
                            const isLast = index === pathnames.length - 1
                            const label = getLabel(part)

                            return (
                                <React.Fragment key={routeTo}>
                                    <ChevronRight size={9} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                                    {isLast ? (
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400 truncate whitespace-nowrap">
                                            {label}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                if (useUIStore.getState().hasUnsavedChanges) {
                                                    useUIStore.getState().setPendingNavTarget(routeTo)
                                                    return
                                                }
                                                navigate(routeTo)
                                            }}
                                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate whitespace-nowrap"
                                        >
                                            {label}
                                        </button>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </nav>
                </div>

                {/* Right */}
                <div className="flex items-center gap-1.5">
                    {/* Clock */}
                    <div className="hidden md:flex flex-col items-end justify-center mr-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight tabular-nums">{formatTime()}</span>
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{formatDate()}</span>
                    </div>

                    {/* Dark mode */}
                    <button
                        onClick={toggleDarkMode}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 rounded-lg transition-all duration-150"
                        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
                    >
                        {theme === 'light'
                            ? <Moon size={16} className="pointer-events-none" />
                            : <Sun size={16} className="pointer-events-none" />}
                    </button>

                    <ActivityFeed />
                    <NotificationBell />

                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

                    {/* Avatar */}
                    <button
                        ref={avatarRef}
                        onClick={() => setProfileOpen(prev => !prev)}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className={`w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white text-xs font-bold shadow-sm transition-all duration-150 hover:bg-primary-700 hover:shadow-md focus:outline-none ${profileOpen ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}
                        title="Account"
                    >
                        {fullInitials}
                    </button>
                </div>
            </header>

            {/* ── Profile Panel ─────────────────────────────────────── */}
            <div
                ref={panelRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={`fixed top-[58px] right-4 z-50 w-72 bg-white dark:bg-[#0f1a2e] rounded-xl shadow-[0_8px_32px_-4px_rgb(0_0_0/0.18)] border border-slate-100 dark:border-slate-700/60 transition-all duration-200 origin-top-right ${profileOpen
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                    }`}
            >
                {/* Header */}
                <div className="relative px-5 pt-6 pb-5 text-center border-b border-slate-100 dark:border-slate-700/60">
                    <button
                        onClick={() => setProfileOpen(false)}
                        className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                    >
                        <X size={13} />
                    </button>

                    <div className="w-14 h-14 rounded-xl bg-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg mx-auto mb-3">
                        {fullInitials}
                    </div>

                    <h3 className="font-semibold text-slate-800 dark:text-white text-sm leading-snug">{user?.name}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{user?.email}</p>

                    <span className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full capitalize mt-2 ${getRoleBadgeClass(user?.role)}`}>
                        {user?.role}
                    </span>
                </div>

                {/* Actions */}
                <div className="px-3 py-2 space-y-0.5">
                    <button
                        onClick={() => { 
                            setProfileOpen(false); 
                            if (useUIStore.getState().hasUnsavedChanges) {
                                useUIStore.getState().setPendingNavTarget('/profile')
                                return
                            }
                            navigate('/profile') 
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
                    >
                        <Settings2 size={15} className="text-slate-400" />
                        Account Settings
                    </button>
                </div>

                {/* Logout */}
                <div className="px-3 pb-3 pt-1">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-150"
                    >
                        <LogOut size={14} />
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    )
}
