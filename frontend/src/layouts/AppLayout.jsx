import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useThemeStore } from '@/store/themeStore'
import { clsx } from 'clsx'

export default function AppLayout() {
    const { sidebarOpen } = useUIStore()
    const { fetchGeneralSettings, general } = useSettingsStore()
    const { applyTheme } = useThemeStore()

    useEffect(() => {
        applyTheme()
        fetchGeneralSettings()
    }, [])

    useEffect(() => {
        if (general?.companyName) {
            document.title = `${general.companyName} — Timesheet Management System`
        }
        if (general?.weekStartDay) {
            import('moment').then(m => {
                const moment = m.default || m
                moment.updateLocale('en', {
                    week: {
                        dow: general.weekStartDay === 'sunday' ? 0 : 1
                    }
                })
            })
        }
    }, [general])

    return (
        <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-black">
            {/* Sidebar */}
            <Sidebar />

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 dark:bg-black/50 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => useUIStore.getState().toggleSidebar()}
                />
            )}

            {/* Main content */}
            <div className={clsx(
                'flex flex-col flex-1 overflow-hidden transition-all duration-300',
                sidebarOpen ? 'md:ml-64' : 'md:ml-[68px]'
            )}>
                <Navbar />
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 animate-fade-in pb-20 md:pb-6 relative w-full">
                    <Outlet />
                </main>
                {/* Fixed Footer */}
                <footer className="py-3 px-6 bg-white dark:bg-black border-t border-slate-100 dark:border-white/10 text-center flex items-center justify-center gap-1.5 flex-shrink-0 z-40">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        © {new Date().getFullYear()} Developed by
                    </span>
                    <span className="text-[11px] font-black text-primary uppercase tracking-widest">
                        Caldim
                    </span>
                </footer>
            </div>
        </div>
    )
}
