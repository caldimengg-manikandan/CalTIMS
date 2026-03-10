import React, { useEffect, useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Timer } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { PrivacyModal, TermsModal } from '@/features/auth/components/LegalModals'
import SupportModal from '@/features/auth/components/SupportModal'
import SupportFloatingButton from '@/components/support/SupportFloatingButton'

export default function AuthLayout() {
    const { isAuthenticated } = useAuthStore()
    const { applyTheme } = useThemeStore()
    const [legalType, setLegalType] = useState(null) // 'privacy' | 'terms' | 'support'

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
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
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
<<<<<<< HEAD
                        <span className="text-2xl font-bold tracking-tight">CALTIMS - TIMESHEET MANAGEMENT SYSTEM </span>
=======
                        <span className="text-2xl font-bold tracking-tight uppercase">CALTIMS - Time Information Management System </span>
>>>>>>> 8b93e344d44b62b529df386e628143fa80062aa9
                    </div>

                    <div className="space-y-8 max-w-lg">
                        <div className="space-y-4">
                            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-white">
                                Manage time like a <span className="opacity-90">strategic asset.</span>
                            </h1>
                        </div>
                    </div>

                    <div className="text-white/60 text-sm font-medium flex items-center gap-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">© 2026 Caldim Engineering Pvt. Ltd.</span>
                        <div className="flex items-center gap-4 text-[10px] uppercase font-black tracking-widest">
                            <button onClick={() => setLegalType('privacy')} className="hover:text-white transition-colors">Privacy</button>
                            <span className="opacity-20">|</span>
                            <button onClick={() => setLegalType('terms')} className="hover:text-white transition-colors">Terms</button>
                            <span className="opacity-20">|</span>
                            <button onClick={() => setLegalType('support')} className="hover:text-white transition-colors">Support</button>
                        </div>
                    </div>
                </div>
            </div>

            <PrivacyModal isOpen={legalType === 'privacy'} onClose={() => setLegalType(null)} />
            <TermsModal isOpen={legalType === 'terms'} onClose={() => setLegalType(null)} />
            <SupportModal isOpen={legalType === 'support'} onClose={() => setLegalType(null)} />

            {/* Right panel — Refined Auth Form Container */}
            <div className="flex-1 flex flex-col">
                <div className="flex justify-end p-8 lg:hidden">
                    <div className="flex items-center gap-2">
                        <Timer size={24} className="text-indigo-600" />
                        <span className="text-xl font-bold text-slate-900">CALTIMS</span>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center p-8 sm:p-12 lg:p-24">
                    <div className="w-full max-w-xl animate-slide-in">
                        <Outlet />
                    </div>
                </div>

                <SupportFloatingButton />

                {/* Footer */}
                <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400 font-medium tracking-wide border-t border-slate-100 dark:border-slate-800">
                    Developed by{' '}
                    <span className="text-indigo-600 font-bold">Caldim</span>
                </div>
            </div>
        </div>
    )
}
