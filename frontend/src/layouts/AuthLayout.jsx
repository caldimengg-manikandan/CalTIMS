import React, { useEffect, useState } from 'react'
import { Outlet, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Clock } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import { useSettingsStore } from '@/store/settingsStore'
import { PrivacyModal, TermsModal } from '@/features/auth/components/LegalModals'
import SupportModal from '@/features/auth/components/SupportModal'
import SupportFloatingButton from '@/components/support/SupportFloatingButton'

export default function AuthLayout() {
    const { isAuthenticated } = useAuthStore()
    const { applyTheme } = useThemeStore()
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans relative overflow-hidden text-slate-900">
            <PrivacyModal isOpen={legalType === 'privacy'} onClose={() => setLegalType(null)} />
            <TermsModal isOpen={legalType === 'terms'} onClose={() => setLegalType(null)} />
            <SupportModal isOpen={legalType === 'support'} onClose={() => setLegalType(null)} />

            {/* Absolute Brand Logo (Top Left) */}
            <div className="absolute top-8 left-8 hidden sm:block">
                <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity font-semibold tracking-tight text-lg text-slate-900">
                    {logoUrl ? (
                         <img src={logoUrl} alt="Logo" className="h-6 object-contain" />
                    ) : (
                         <div className="flex items-center gap-2">
                             <Clock size={20} className="text-indigo-600" />
                             <span>{companyName}</span>
                         </div>
                    )}
                </Link>
            </div>

            <div className="relative z-10 w-full max-w-[420px] px-6 py-12">
                {/* Mobile Brand Logo */}
                <div className="flex justify-center mb-8 sm:hidden">
                    <Link to="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight text-slate-900">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="h-6 object-contain" />
                        ) : (
                            <div className="flex items-center gap-2">
                                <Clock size={20} className="text-indigo-600" />
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
                <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-medium text-slate-500">
                    <button onClick={() => setLegalType('privacy')} className="hover:text-slate-900 transition-colors">Privacy</button>
                    <span>&middot;</span>
                    <button onClick={() => setLegalType('terms')} className="hover:text-slate-900 transition-colors">Terms</button>
                    <span>&middot;</span>
                    <button onClick={() => setLegalType('support')} className="hover:text-slate-900 transition-colors">Support</button>
                </div>
            </div>

            <SupportFloatingButton />
        </div>
    )
}

