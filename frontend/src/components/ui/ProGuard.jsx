import React from 'react'
import { Zap } from 'lucide-react'
import { useSystemStore } from '@/store/systemStore'

/**
 * A component that guards Pro features by showing an "Upgrade to Pro" splash screen
 * when the application is in 'basic' mode.
 */
export default function ProGuard({ children, title, subtitle, icon: Icon = Zap }) {
    const { appVersion } = useSystemStore()

    if (appVersion === 'basic') {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center animate-fade-in px-4">
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-primary rounded-full flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/10">
                    <Icon size={36} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                    {title || 'Enterprise Pro Feature'}
                </h2>
                <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
                    {subtitle || 'This advanced feature is part of our Enterprise Pro tier. Upgrade to unlock specialized tools, AI insights, and enhanced workspace management.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="px-6 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-400 rounded-xl text-sm font-medium border border-slate-200 dark:border-white/10 flex items-center gap-2 cursor-not-allowed">
                        <span>Contact Admin to Upgrade</span>
                    </div>
                </div>
            </div>
        )
    }

    return children
}
