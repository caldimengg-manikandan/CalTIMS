import React from 'react'
import { Check, AlertCircle, Info, ArrowRight } from 'lucide-react'

/**
 * DaySelector - A multi-select button group for picking working days.
 */
export function DaySelector({ selectedDays = [], onChange }) {
    const days = [
        { key: 'monday', label: 'Mon' },
        { key: 'tuesday', label: 'Tue' },
        { key: 'wednesday', label: 'Wed' },
        { key: 'thursday', label: 'Thu' },
        { key: 'friday', label: 'Fri' },
        { key: 'saturday', label: 'Sat' },
        { key: 'sunday', label: 'Sun' },
    ]

    const toggleDay = (key) => {
        if (selectedDays.includes(key)) {
            onChange(selectedDays.filter(d => d !== key))
        } else {
            onChange([...selectedDays, key])
        }
    }

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {days.map((day) => {
                const isActive = selectedDays.includes(day.key)
                return (
                    <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`
                            px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-200
                            ${isActive 
                                ? 'bg-primary text-white shadow-lg shadow-primary/30 ring-2 ring-primary ring-offset-2 dark:ring-offset-slate-900' 
                                : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                            }
                        `}
                    >
                        {day.label}
                    </button>
                )
            })}
        </div>
    )
}

/**
 * StatusBadge - Shows completion status for a settings section.
 */
export function StatusBadge({ status = 'missing' }) {
    const config = {
        complete: {
            label: 'Complete',
            className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
            icon: Check
        },
        incomplete: {
            label: 'Incomplete',
            className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
            icon: Info
        },
        missing: {
            label: 'Missing Info',
            className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
            icon: AlertCircle
        }
    }

    const { label, className, icon: Icon } = config[status] || config.missing

    return (
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${className}`}>
            <Icon size={10} />
            {label}
        </span>
    )
}

/**
 * ImpactPanel - Sticky preview panel showing the effects of setting changes.
 */
export function ImpactPanel({ impacts = [] }) {
    return (
        <div className="sticky top-24 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-xl overflow-hidden">
                <div className="p-6 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest flex items-center gap-2">
                        <Info size={16} className="text-primary" />
                        Live Impact Preview
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-1">Real-time effects of your configuration</p>
                </div>
                
                <div className="p-6 space-y-6">
                    {impacts.length > 0 ? (
                        impacts.map((impact, i) => (
                            <div key={i} className="flex gap-4 group">
                                <div className="mt-1 w-5 h-5 rounded bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                                    <ArrowRight size={12} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{impact.title}</p>
                                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{impact.description}</p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center">
                            <p className="text-xs text-slate-400 italic">No significant changes detected</p>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-primary/5 border-t border-primary/10">
                    <p className="text-[10px] text-primary font-bold text-center">
                        Changes apply institution-wide upon saving.
                    </p>
                </div>
            </div>

            {/* Micro-help card */}
            <div className="p-6 rounded-[2rem] bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                <p className="text-xs font-bold">Need Help?</p>
                <p className="text-[10px] mt-2 opacity-80 leading-relaxed font-medium">
                    Our compliance engine automatically validates these settings against regional labor laws.
                </p>
            </div>
        </div>
    )
}
