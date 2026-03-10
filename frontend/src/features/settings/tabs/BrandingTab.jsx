import React, { useState, useEffect, useRef } from 'react'
import { Sun, Moon, Monitor, Palette, Check } from 'lucide-react'
import { useThemeStore, ACCENT_PRESETS } from '@/store/themeStore'
import { SectionCard } from '../components/SharedUI'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { Upload, Image as ImageIcon, Save } from 'lucide-react'

export default function BrandingTab() {
    const qc = useQueryClient()
    const { mode, accentPreset, customColor, setMode, setAccentPreset, setCustomColor } = useThemeStore()
    const colorInputRef = useRef(null)
    const logoInputRef = useRef(null)
    const faviconInputRef = useRef(null)

    const [branding, setBranding] = React.useState({
        organizationName: 'CALTIMS',
        tagline: 'TimeSheet Management System',
        logoUrl: '',
        faviconUrl: '',
        primaryColor: '#4f46e5',
        secondaryColor: '#6366f1'
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    React.useEffect(() => {
        if (data?.branding) {
            setBranding({
                organizationName: data.branding.organizationName || 'CALTIMS',
                tagline: data.branding.tagline || 'Time Information Management System',
                logoUrl: data.branding.logoUrl || '',
                faviconUrl: data.branding.faviconUrl || '',
                primaryColor: data.branding.primaryColor || '#4f46e5',
                secondaryColor: data.branding.secondaryColor || '#6366f1'
            })
            // Sync with local theme store if needed
            if (data.branding.primaryColor) setCustomColor(data.branding.primaryColor)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            branding: {
                ...branding,
                primaryColor: customColor || branding.primaryColor
            }
        }),
        onSuccess: () => {
            toast.success('Branding updated!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setBranding(f => ({ ...f, [k]: v }))

    const handleFileUpload = async (e, type) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        const loadingToast = toast.loading(`Uploading ${type}...`)
        try {
            const res = await settingsAPI.uploadBranding(formData)
            const url = res.data.data.url
            if (type === 'logo') upd('logoUrl', url)
            else if (type === 'favicon') upd('faviconUrl', url)
            toast.success(`${type} uploaded successfully`, { id: loadingToast })
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to upload ${type}`, { id: loadingToast })
        }
    }

    const modes = [
        { id: 'light', label: 'Light', Icon: Sun },
        { id: 'dark', label: 'Dark', Icon: Moon },
        { id: 'system', label: 'System', Icon: Monitor },
    ]

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6 pb-6">
            <div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Institutional Branding</h2>
                <p className="text-sm text-slate-500 font-medium">Customize your enterprise identity and global interface</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Visual Identity */}
                <div className="lg:col-span-8 space-y-8">
                    <SectionCard title="Identity" subtitle="Core brand assets and naming" icon={ImageIcon}>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                            <div className="md:col-span-7 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Organization Name</label>
                                    <input
                                        className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                        value={branding.organizationName}
                                        onChange={e => upd('organizationName', e.target.value)}
                                        placeholder="CALTIMS"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Corporate Tagline</label>
                                    <input
                                        className="input w-full h-12 text-sm font-bold bg-slate-50/50 dark:bg-white/5"
                                        value={branding.tagline}
                                        onChange={e => upd('tagline', e.target.value)}
                                        placeholder="Time Information Management System"
                                    />
                                </div>

                                <div className="p-5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50/30 dark:bg-white/5 flex items-center gap-6">
                                    <div className="flex-shrink-0">
                                        {branding.faviconUrl ? (
                                            <img src={branding.faviconUrl} alt="Favicon" className="h-10 w-10 object-contain rounded-lg" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                                <Upload size={16} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <button
                                            onClick={() => faviconInputRef.current?.click()}
                                            className="text-xs font-black uppercase tracking-tight text-indigo-600 dark:text-indigo-400 hover:underline"
                                        >
                                            Upload Favicon
                                        </button>
                                        <p className="text-[10px] text-slate-400 font-medium">ICO, PNG or SVG, max 100KB</p>
                                        <input
                                            ref={faviconInputRef}
                                            type="file"
                                            className="hidden"
                                            accept="image/*,image/x-icon"
                                            onChange={(e) => handleFileUpload(e, 'favicon')}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-5 flex flex-col h-full">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block text-center md:text-left">Corporate Logo</label>
                                <div className="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2rem] bg-slate-50/50 dark:bg-white/5 group hover:border-indigo-400/50 transition-colors">
                                    <div className="mb-6 transform transition-transform group-hover:scale-105">
                                        {branding.logoUrl ? (
                                            <img src={branding.logoUrl} alt="Logo" className="max-h-20 w-auto object-contain" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-3xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-400">
                                                <Upload size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => logoInputRef.current?.click()}
                                        className="btn btn-ghost btn-sm text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400"
                                    >
                                        Select Image
                                    </button>
                                    <input
                                        ref={logoInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, 'logo')}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-3 font-medium">PNG or SVG, max 500KB</p>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                <div className="lg:col-span-4 space-y-8">
                    {/* Color System */}
                    <SectionCard title="Atmosphere" subtitle="Applied accent color system" icon={Palette}>
                        <div className="grid grid-cols-5 gap-3 mb-6">
                            {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setAccentPreset(key)
                                        setCustomColor(null)
                                    }}
                                    style={{ backgroundColor: preset.primary }}
                                    className={`w-full aspect-square rounded-full transition-all hover:scale-110 active:scale-95 ${accentPreset === key && !customColor
                                        ? 'ring-4 ring-offset-4 ring-indigo-600 dark:ring-indigo-400 scale-90'
                                        : 'opacity-80 hover:opacity-100'
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="space-y-4 mb-8">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Custom Primary Hex</label>
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-12 h-12 rounded-2xl border-2 border-slate-200 dark:border-white/20 cursor-pointer overflow-hidden shadow-sm flex-shrink-0"
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
                                    className="input flex-1 h-12 text-sm font-mono font-bold bg-slate-50/50 dark:bg-white/5"
                                    placeholder="#4F46E5"
                                    value={customColor || ''}
                                    onChange={e => {
                                        const v = e.target.value
                                        if (/^#[0-9A-Fa-f]{6}$/.test(v)) setCustomColor(v)
                                        else if (!v) setAccentPreset(accentPreset)
                                    }}
                                />
                            </div>
                        </div>

                        {/* Live Preview Sample */}
                        <div className="p-5 rounded-3xl bg-slate-50/30 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Live Preview</p>
                            <div className="space-y-4">
                                <div className="h-3 w-2/3 rounded-full bg-slate-200 dark:bg-slate-800" />
                                <div className="flex items-center gap-3">
                                    <div className="h-8 px-4 rounded-xl flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: customColor || ACCENT_PRESETS[accentPreset]?.primary }}>
                                        ACTION
                                    </div>
                                    <div className="h-2 w-12 rounded-full" style={{ backgroundColor: customColor || ACCENT_PRESETS[accentPreset]?.primary }} />
                                    <div className="h-2 w-8 rounded-full opacity-30" style={{ backgroundColor: customColor || ACCENT_PRESETS[accentPreset]?.primary }} />
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard title="Display Mode" subtitle="Interface preference" icon={Sun}>
                        <div className="grid grid-cols-3 gap-3">
                            {modes.map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setMode(id)}
                                    className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all group ${mode === id
                                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                                        : 'border-slate-100 dark:border-white/5 text-slate-400 hover:border-slate-200'
                                        }`}
                                >
                                    <Icon size={16} className={`mb-2 ${mode === id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                                    <p className="text-[10px] font-black tracking-tight">{label}</p>
                                    {mode === id && <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-indigo-600" />}
                                </button>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            </div>

            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Sync Identity
                </button>
            </div>
        </div>
    )
}
