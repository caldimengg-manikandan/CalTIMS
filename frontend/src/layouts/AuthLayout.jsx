import React, { useEffect, useState } from 'react'
import { Outlet, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Clock, Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { useSettingsStore } from '@/store/settingsStore'
import { PrivacyModal, TermsModal } from '@/features/auth/components/LegalModals'
import SupportModal from '@/features/auth/components/SupportModal'
import SupportFloatingButton from '@/components/support/SupportFloatingButton'

export default function AuthLayout() {
    const { isAuthenticated } = useAuthStore()
    const { applyTheme, mode, setMode } = useThemeStore()
    const general = useSettingsStore(s => s.general)
    const companyName = general?.branding?.organizationName || general?.organization?.companyName || 'CalTIMS'
    const logoUrl = general?.branding?.logoUrl

    const [legalType, setLegalType] = useState(null) // 'privacy' | 'terms' | 'support'

    useEffect(() => {
        if (general?.branding) {
            applyTheme(false) // Assuming standard or light theme
            useThemeStore.getState().syncFromBranding(general.branding)
        } else {
            applyTheme(false)
        }
    }, [applyTheme, general?.branding])

    if (isAuthenticated) return <Navigate to="/dashboard" replace />

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans relative overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <PrivacyModal isOpen={legalType === 'privacy'} onClose={() => setLegalType(null)} />
            <TermsModal isOpen={legalType === 'terms'} onClose={() => setLegalType(null)} />
            <SupportModal isOpen={legalType === 'support'} onClose={() => setLegalType(null)} />

            <div className="absolute top-8 left-8 hidden sm:block">
                <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity font-semibold tracking-tight text-lg text-slate-900 dark:text-slate-100">
                    {logoUrl ? (
                         <img src={logoUrl} alt="Logo" className="h-6 object-contain" />
                    ) : (
                         <div className="flex items-center gap-2">
                             <Clock size={20} className="text-[var(--color-primary)]" />
                             <span>{companyName}</span>
                         </div>
                    )}
                </Link>
            </div>

            {/* Theme Toggle (Top Right) */}
            <div className="absolute top-8 right-8">
                <button
                    onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
                    className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-all shadow-sm"
                    aria-label="Toggle theme"
                >
                    {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            <div className="relative z-10 w-full max-w-[480px] px-6 py-12">
                {/* Mobile Brand Logo */}
                <div className="flex justify-center mb-8 sm:hidden">
                    <Link to="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight text-slate-900 dark:text-slate-100">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-6 object-contain" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <Clock size={20} className="text-[var(--color-primary)]" />
                                <span>{companyName}</span>
                            </div>
                        )}
                    </Link>
                </div>

                {/* Outlet (LoginPage, SignupPage, etc) */}
                <div className="w-full animate-in fade-in duration-500 ease-out">
                    <Outlet />
                </div>

                {/* Footer Links */}
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <button onClick={() => setLegalType('privacy')} className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Privacy</button>
                    <span className="text-slate-300 dark:text-slate-800">&middot;</span>
                    <button onClick={() => setLegalType('terms')} className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Terms</button>
                    <span className="text-slate-300 dark:text-slate-800">&middot;</span>
                    <button onClick={() => setLegalType('support')} className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Support</button>
                </div>
            </div>

            <SupportFloatingButton />
        </div>
    )
}

