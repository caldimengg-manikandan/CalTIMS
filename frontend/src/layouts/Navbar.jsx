import React, { useState, useRef, useEffect } from 'react'
import { Moon, Sun, Menu, LogOut, Mail, Shield, X, Settings2, ArrowLeft, ChevronRight } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { authAPI } from '@/services/endpoints'
import NotificationBell from '@/components/ui/NotificationBell'

const ROUTE_LABELS = {
    'dashboard': 'Dashboard',
    'profile': 'Account Settings',
    'timesheets': 'Timesheet Entry',
    'history': 'History',
    'manage': 'Manage Timesheets',
    'leaves': 'Leave Tracker',
    'calendar': 'Calendar',
    'announcements': 'Announcements',
    'projects': 'Projects',
    'tasks': 'Tasks',
    'employees': 'Employees',
    'reports': 'Reports',
    'settings': 'Settings',
    'new': 'New',
    'edit': 'Edit'
}

export default function Navbar() {
    const { toggleSidebar, theme, toggleDarkMode } = useUIStore()
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const location = useLocation()
    const [profileOpen, setProfileOpen] = useState(false)

    const pathnames = location.pathname.split('/').filter(x => x)

    // Helper to get label from path part
    const getLabel = (part) => {
        if (/^[0-9a-fA-F]{24}$/.test(part)) return 'Details'
        return ROUTE_LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1)
    }
    const panelRef = useRef(null)
    const avatarRef = useRef(null)

    const initial = user?.name?.charAt(0)?.toUpperCase() || '?'

    const handleLogout = async () => {
        try {
            await authAPI.logout()
            logout() // Local state last, so token is available for the API call
        } catch (err) {
            console.error('Logout error:', err)
            logout() // Still logout locally if API fails
        } finally {
            navigate('/login')
        }
    }

    // Close panel when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                panelRef.current && !panelRef.current.contains(e.target) &&
                avatarRef.current && !avatarRef.current.contains(e.target)
            ) {
                setProfileOpen(false)
            }
        }
        if (profileOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [profileOpen])

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'admin': return 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
            case 'manager': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }
    }

    return (
        <>
            <header className="h-14 bg-white dark:bg-black border-b border-slate-100 dark:border-white/10 flex items-center justify-between px-5 flex-shrink-0 z-40 relative">
                {/* Left */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 -ml-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white rounded-lg transition-all duration-200 shrink-0"
                        title="Toggle sidebar"
                    >
                        <Menu size={19} />
                    </button>

                    <div className="w-px h-5 bg-slate-200 dark:bg-white/10 mx-1.5 shrink-0" />

                    {/* Navigation Breadcrumbs */}
                    <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all flex items-center gap-1.5 font-bold text-xs shrink-0"
                            title="Go back"
                        >
                            <ArrowLeft size={15} strokeWidth={2.5} />
                            <span className="hidden sm:inline">Back</span>
                        </button>

                        <Link
                            to="/dashboard"
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors whitespace-nowrap shrink-0"
                        >
                            DASHBOARD
                        </Link>

                        {pathnames.map((part, index) => {
                            if (part === 'dashboard') return null
                            const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`
                            const isLast = index === pathnames.length - 1
                            const label = getLabel(part)

                            return (
                                <React.Fragment key={routeTo}>
                                    <ChevronRight size={10} className="text-slate-300 flex-shrink-0" />
                                    {isLast ? (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-primary truncate whitespace-nowrap">
                                            {label}
                                        </span>
                                    ) : (
                                        <Link
                                            to={routeTo}
                                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors truncate whitespace-nowrap"
                                        >
                                            {label}
                                        </Link>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </nav>
                </div>

                {/* Right */}
                <div className="flex items-center gap-2">
                    {/* Theme mode toggle */}
                    <button
                        onClick={toggleDarkMode}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white rounded-lg transition-all duration-200"
                        title={theme === 'light' ? 'Switch to dark mode' : theme === 'dark' ? 'Switch to midnight mode' : 'Switch to light mode'}
                    >
                        {theme === 'light' ? <Moon size={17} /> : theme === 'dark' ? <Moon size={17} className="text-primary-400" /> : <Sun size={17} />}
                    </button>

                    {/* Notifications Bell */}
                    <NotificationBell />

                    {/* Divider */}
                    <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

                    {/* Circle Avatar — click to open profile panel */}
                    <button
                        ref={avatarRef}
                        onClick={() => setProfileOpen(prev => !prev)}
                        className={`w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-sm font-bold shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 ${profileOpen ? 'ring-2 ring-primary-500 ring-offset-2 scale-105' : ''}`}
                        title="View profile"
                    >
                        {initial}
                    </button>
                </div>
            </header>

            {/* ── Profile Panel ───────────────────────────────── */}
            {/* Backdrop */}
            {profileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/10 dark:bg-black/30 backdrop-blur-[1px]"
                    onClick={() => setProfileOpen(false)}
                />
            )}

            {/* Panel */}
            <div
                ref={panelRef}
                className={`fixed top-[60px] right-4 z-50 w-72 bg-white dark:bg-[#0f0f0f] rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 transition-all duration-250 origin-top-right ${profileOpen
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
                    }`}
            >
                {/* Header */}
                <div className="relative px-5 pt-6 pb-4 text-center border-b border-slate-100 dark:border-white/10">
                    <button
                        onClick={() => setProfileOpen(false)}
                        className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all"
                    >
                        <X size={14} />
                    </button>

                    {/* Big Avatar */}
                    <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-2xl font-bold shadow-lg mx-auto mb-3">
                        {initial}
                    </div>

                    <h3 className="font-bold text-slate-800 dark:text-white text-base leading-snug">{user?.name}</h3>

                    <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize mt-1 ${getRoleBadgeClass(user?.role)}`}>
                        {user?.role}
                    </span>
                </div>

                {/* Info rows */}
                <div className="px-5 py-3 space-y-2.5">
                    {user?.email && (
                        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0">
                                <Mail size={13} className="text-slate-400" />
                            </div>
                            <span className="truncate">{user.email}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-5 py-2 border-t border-slate-100 dark:border-white/5 space-y-1">
                    <button
                        onClick={() => { setProfileOpen(false); navigate('/profile') }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-primary transition-all"
                    >
                        <Settings2 size={16} />
                        Account Settings
                    </button>
                </div>

                {/* Logout */}
                <div className="px-4 pb-4 pt-1">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-all duration-200"
                    >
                        <LogOut size={15} />
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    )
}
