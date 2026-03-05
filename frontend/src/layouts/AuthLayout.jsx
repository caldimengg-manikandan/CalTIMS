import React from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Timer } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { useEffect } from 'react'

export default function AuthLayout() {
    const { isAuthenticated } = useAuthStore()
    const { applyTheme } = useThemeStore()

    useEffect(() => {
        // Auth pages (Login, etc.) should stay fixed on their original theme class
        // but we ensure the CSS variables are set
        const root = document.documentElement
        root.style.setProperty('--color-primary', '#6366f1') // Default indigo-600
        root.style.setProperty('--color-primary-rgb', '99 102 241')
    }, [])

    if (isAuthenticated) return <Navigate to="/dashboard" replace />

    return (
        <div className="min-h-screen flex bg-white dark:bg-black font-sans">
            {/* Left panel — Stunning Branding with Background Image */}
            <div className="hidden lg:flex lg:w-3/5 relative overflow-hidden">
                {/* Background Image with Overlay */}
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: 'url(/assets/images/login-bg.png)' }}
                />
                <div className="absolute inset-0 bg-indigo-900/50 backdrop-blur-[1px]" />

                {/* Content Overlay */}
                <div className="relative z-10 flex flex-col justify-between p-16 text-white w-full">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/20">
                            <Timer size={28} className="text-indigo-600" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">CALTIMS</span>
                    </div>

                    <div className="space-y-8 max-w-lg">
                        <div className="space-y-4">
                            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white">
                                Manage time like a <span className="opacity-90">strategic asset.</span>
                            </h1>

                        </div>
                    </div>

                    <div className="text-white/60 text-sm font-medium flex items-center gap-6">
                        <span>© 2026 Caldim Engineering Pvt. Ltd.</span>
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-white transition-colors">Privacy</a>
                            <a href="#" className="hover:text-white transition-colors">Terms</a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right panel — Refined Auth Form Container */}
            <div className="flex-1 flex flex-col">
                <div className="flex justify-end p-8 lg:hidden">
                    <div className="flex items-center gap-2">
                        <Timer size={24} className="text-indigo-600" />
                        <span className="text-xl font-bold text-slate-900">TimesheetPro</span>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-24">
                    <div className="w-full max-w-md animate-slide-in">
                        <Outlet />
                    </div>
                </div>

                {/* Footer */}
                <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400 font-medium tracking-wide border-t border-slate-100 dark:border-slate-800">
                    Developed by{' '}
                    <span className="text-indigo-600 font-bold">Caldim</span>
                </div>
            </div>
        </div>
    )
}
