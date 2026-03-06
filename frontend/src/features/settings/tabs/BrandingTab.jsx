import React, { useRef } from 'react'
import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react'
import { useThemeStore, ACCENT_PRESETS } from '@/store/themeStore'
import { SectionCard } from '../components/SharedUI'

export default function BrandingTab() {
    const { mode, accentPreset, customColor, setMode, setAccentPreset, setCustomColor } = useThemeStore()
    const colorInputRef = useRef(null)

    const modes = [
        { id: 'light', label: 'Light', Icon: Sun },
        { id: 'dark', label: 'Dark', Icon: Moon },
        { id: 'system', label: 'System', Icon: Monitor },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Branding & Appearance</h2>
                <p className="text-sm text-slate-400">Customize the look and feel of the app. Changes apply instantly.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mode */}
                <SectionCard title="Display Mode" subtitle="Light, Dark, or follow system preference" icon={Sun}>
                    <div className="grid grid-cols-3 gap-3">
                        {modes.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                onClick={() => setMode(id)}
                                className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all text-sm font-semibold ${mode === id
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/40 hover:bg-primary/5'
                                    }`}
                            >
                                <Icon size={22} />
                                {label}
                                {mode === id && <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Active</span>}
                            </button>
                        ))}
                    </div>
                </SectionCard>

                {/* Accent Color */}
                <SectionCard title="Accent Color" subtitle="Applied to buttons, links, and active states" icon={Palette}>
                    <div className="grid grid-cols-6 gap-3 mb-4">
                        {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
                            <button
                                key={key}
                                title={preset.name}
                                onClick={() => setAccentPreset(key)}
                                style={{ backgroundColor: preset.primary }}
                                className={`w-full aspect-square rounded-xl transition-all hover:scale-110 ${accentPreset === key && !customColor
                                    ? 'ring-4 ring-offset-2 ring-current shadow-lg scale-110'
                                    : ''
                                    }`}
                            >
                                {accentPreset === key && !customColor && (
                                    <Check size={14} className="text-white mx-auto" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Custom color picker */}
                    <div className="border-t border-slate-100 dark:border-white/10 pt-4">
                        <p className="text-xs text-slate-500 font-semibold mb-2">Custom Color</p>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-white/20 cursor-pointer flex-shrink-0 overflow-hidden"
                                style={{ backgroundColor: customColor || ACCENT_PRESETS[accentPreset]?.primary }}
                                onClick={() => colorInputRef.current?.click()}
                            >
                                <input
                                    ref={colorInputRef}
                                    type="color"
                                    className="opacity-0 w-full h-full cursor-pointer"
                                    value={customColor || ACCENT_PRESETS[accentPreset]?.primary}
                                    onChange={e => setCustomColor(e.target.value)}
                                />
                            </div>
                            <input
                                type="text"
                                className="input flex-1 text-sm font-mono"
                                placeholder="#6366f1"
                                value={customColor || ''}
                                onChange={e => {
                                    const v = e.target.value
                                    if (/^#[0-9A-Fa-f]{6}$/.test(v)) setCustomColor(v)
                                    else if (!v) setAccentPreset(accentPreset)
                                }}
                            />
                            {customColor && (
                                <button
                                    onClick={() => setAccentPreset(accentPreset)}
                                    className="text-xs text-slate-500 hover:text-rose-500 transition-colors"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Live preview */}
                    <div className="mt-4 border-t border-slate-100 dark:border-white/10 pt-4">
                        <p className="text-xs text-slate-500 font-semibold mb-2">Live Preview</p>
                        <div className="flex flex-wrap gap-2 items-center">
                            <button className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all" style={{ backgroundColor: customColor || ACCENT_PRESETS[accentPreset]?.primary }}>
                                Primary Button
                            </button>
                            <span className="text-sm font-semibold" style={{ color: customColor || ACCENT_PRESETS[accentPreset]?.primary }}>
                                Accent Text Link
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: (customColor || ACCENT_PRESETS[accentPreset]?.primary) + '20', color: customColor || ACCENT_PRESETS[accentPreset]?.primary }}>
                                Badge
                            </span>
                        </div>
                    </div>
                </SectionCard>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/30 text-sm text-blue-800 dark:text-blue-300">
                <strong>✨ Live:</strong> Theme changes apply instantly and are saved to your browser. They persist across page refreshes and sessions.
            </div>
        </div>
    )
}
