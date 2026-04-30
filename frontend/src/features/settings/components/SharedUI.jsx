import React, { useState } from 'react'
import { Plus, X } from 'lucide-react'

export function SectionCard({ title, subtitle, icon: Icon, children }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden h-full flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
                {Icon && (
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-primary" />
                    </div>
                )}
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">{title}</h3>
                    {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5 flex-1">{children}</div>
        </div>
    )
}

export function Chip({ label, onRemove, disabled }) {
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {label}
            {!disabled && (
                <button onClick={onRemove} className="hover:text-rose-500 transition-colors">
                    <X size={12} />
                </button>
            )}
        </span>
    )
}

export function AddChipInput({ onAdd, placeholder, disabled, maxLength = 50 }) {
    const [val, setVal] = useState('')
    const handle = () => {
        if (val.trim()) { onAdd(val.trim()); setVal('') }
    }
    return (
        <div className="space-y-2 mt-3">
            <div className="flex gap-2">
                <input
                    className="input flex-1 text-sm"
                    placeholder={placeholder}
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handle()}
                    disabled={disabled}
                    maxLength={maxLength}
                />
                <button
                    onClick={handle}
                    disabled={disabled || !val.trim()}
                    className="btn-primary px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-40"
                >
                    <Plus size={14} /> Add
                </button>
            </div>
            {val.length > 0 && (
                <p className={`text-[10px] font-bold text-right transition-colors ${val.length >= maxLength ? 'text-rose-500' : 'text-slate-400'}`}>
                    {val.length} / {maxLength} characters
                </p>
            )}
        </div>
    )
}
