import React from 'react'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function StatCard({ title, value, icon: Icon, trend, color = 'primary', description, onClick }) {
    const colorStyles = {
        primary: {
            bg: 'bg-primary-50 dark:bg-primary-900/20',
            text: 'text-primary-600 dark:text-primary-400',
            iconBg: 'bg-primary-100 dark:bg-primary-800/50',
            border: 'border-primary-100/50 dark:border-primary-400/20'
        },
        success: {
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            text: 'text-emerald-600 dark:text-emerald-400',
            iconBg: 'bg-emerald-100 dark:bg-emerald-800/50',
            border: 'border-emerald-100/50 dark:border-emerald-400/20'
        },
        warning: {
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            text: 'text-amber-600 dark:text-amber-400',
            iconBg: 'bg-amber-100 dark:bg-amber-800/50',
            border: 'border-amber-100/50 dark:border-amber-400/20'
        },
        danger: {
            bg: 'bg-rose-50 dark:bg-rose-900/20',
            text: 'text-rose-600 dark:text-rose-400',
            iconBg: 'bg-rose-100 dark:bg-rose-800/50',
            border: 'border-rose-100/50 dark:border-rose-400/20'
        },
        info: {
            bg: 'bg-sky-50 dark:bg-sky-900/20',
            text: 'text-sky-600 dark:text-sky-400',
            iconBg: 'bg-sky-100 dark:bg-sky-800/50',
            border: 'border-sky-100/50 dark:border-sky-400/20'
        },
    }

    const style = colorStyles[color] || colorStyles.primary

    return (
        <div
            onClick={onClick}
            className={clsx(
                'group relative p-6 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden',
                'animate-fade-in',
                onClick && 'cursor-pointer active:scale-95'
            )}
        >
            {/* Background decoration */}
            <div className={clsx('absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity', style.bg)} />

            <div className="relative flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">
                            {value ?? '0'}
                        </h3>
                    </div>
                    {description && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            {description}
                        </p>
                    )}
                </div>

                {Icon && (
                    <div className={clsx(
                        'w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm',
                        style.iconBg, style.text
                    )}>
                        <Icon size={24} strokeWidth={2.5} />
                    </div>
                )}
            </div>

            {trend && (
                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5 flex items-center gap-2">
                    <div className={clsx(
                        'flex items-center px-1.5 py-0.5 rounded-lg text-[10px] font-bold',
                        trend.value >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600'
                    )}>
                        {trend.value >= 0 ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                        {Math.abs(trend.value)}%
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{trend.label}</span>
                </div>
            )}
        </div>
    )
}
