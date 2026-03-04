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

            {/* Main content */}
            <div className={clsx(
                'flex flex-col flex-1 overflow-hidden transition-all duration-300',
                sidebarOpen ? 'ml-64' : 'ml-[68px]'
            )}>
                <Navbar />
                <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
                    <Outlet />
                </main>
                {/* Fixed Footer */}
                <footer className="py-4 px-6 bg-surface-50 dark:bg-black border-t border-slate-100 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400 font-medium tracking-wide">
                    Developed by{' '}
                    <span className="text-indigo-600 font-bold">Caldim</span>
                </footer>
            </div>
        </div>
    )
}
