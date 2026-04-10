import React, { useState, useEffect, useRef } from 'react'
import { Sun, Moon, Monitor, Palette, Check, Building2, CheckCircle2 } from 'lucide-react'
import { useThemeStore, ACCENT_PRESETS } from '@/store/themeStore'
import { SectionCard } from '../components/SharedUI'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { Upload, Image as ImageIcon, Save } from 'lucide-react'

export default function BrandingTab() {
    const qc = useQueryClient()
    const { mode: globalMode, accentPreset: globalAccentPreset, customColor: globalCustomColor, setMode: setGlobalMode, setAccentPreset: setGlobalAccentPreset, setCustomColor: setGlobalCustomColor } = useThemeStore()
    const [localMode, setLocalMode] = useState(globalMode)
    const [localAccentPreset, setLocalAccentPreset] = useState(globalAccentPreset)
    const [localCustomColor, setLocalCustomColor] = useState(globalCustomColor)
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
            if (data.branding.primaryColor) {
                // We don't overwrite localCustomColor blindly here because we only want to fetch initial data.
                // It is already correctly fetched on load from useThemeStore which is persisted.
            }
        }
    }, [data])

    const [logoFile, setLogoFile] = useState(null)
    const [faviconFile, setFaviconFile] = useState(null)

    const saveMutation = useMutation({
        mutationFn: async () => {
            let finalLogoUrl = branding.logoUrl
            let finalFaviconUrl = branding.faviconUrl

            if (logoFile) {
                const fData = new FormData()
                fData.append('file', logoFile)
                const res = await settingsAPI.uploadBranding(fData)
                finalLogoUrl = res.data.data.url
            }

            if (faviconFile) {
                const fData = new FormData()
                fData.append('file', faviconFile)
                const res = await settingsAPI.uploadBranding(fData)
                finalFaviconUrl = res.data.data.url
            }

            const updatedBranding = {
                ...branding,
                logoUrl: finalLogoUrl,
                faviconUrl: finalFaviconUrl,
                primaryColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary || branding.primaryColor
            }

            return settingsAPI.updateSettings({ branding: updatedBranding })
        },
        onSuccess: () => {
            setGlobalMode(localMode)
            setGlobalAccentPreset(localAccentPreset)
            setGlobalCustomColor(localCustomColor)
            setLogoFile(null)
            setFaviconFile(null)
            toast.success('Branding updated!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setBranding(f => ({ ...f, [k]: v }))

    const handleFileUpload = (e, type) => {
        const file = e.target.files?.[0]
        if (!file) return

        const url = URL.createObjectURL(file)
        if (type === 'logo') {
            setLogoFile(file)
            upd('logoUrl', url)
        } else if (type === 'favicon') {
            setFaviconFile(file)
            upd('faviconUrl', url)
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Institutional Branding</h2>
                    <p className="text-sm text-slate-500 font-medium">Customize your enterprise identity and global interface</p>
                </div>
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
                >
                    {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={18} />}
                    Save Changes
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-12 space-y-8 max-w-4xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Color System */}
                        <SectionCard title="Atmosphere" subtitle="Applied accent color system" icon={Palette}>
                            <div className="grid grid-cols-4 gap-3 mb-8">
                                {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setLocalAccentPreset(key)
                                            setLocalCustomColor(null)
                                        }}
                                        style={{ backgroundColor: preset.primary }}
                                        className={`w-full aspect-square rounded-full transition-all hover:scale-110 active:scale-95 ${localAccentPreset === key && !localCustomColor
                                            ? 'ring-4 ring-offset-4 ring-primary scale-90 shadow-lg'
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
                                        style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }}
                                        onClick={() => colorInputRef.current?.click()}
                                    >
                                        <input
                                            ref={colorInputRef}
                                            type="color"
                                            className="opacity-0 w-full h-full cursor-pointer"
                                            value={localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary}
                                            onChange={e => setLocalCustomColor(e.target.value)}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        className="input flex-1 h-12 text-sm font-mono font-bold bg-slate-50/50 dark:bg-white/5"
                                        placeholder="#4F46E5"
                                        value={localCustomColor || ''}
                                        onChange={e => {
                                            const v = e.target.value
                                            if (/^#[0-9A-Fa-f]{6}$/.test(v)) setLocalCustomColor(v)
                                            else if (!v) setLocalAccentPreset(localAccentPreset)
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Live Preview Sample */}
                            {/* <div className="p-5 rounded-3xl bg-slate-50/30 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Live Preview</p>
                                <div className="space-y-4">
                                    <div className="h-3 w-2/3 rounded-full bg-slate-200 dark:bg-slate-800" />
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 px-4 rounded-xl flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }}>
                                            ACTION
                                        </div>
                                        <div className="h-2 w-12 rounded-full" style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }} />
                                        <div className="h-2 w-8 rounded-full opacity-30" style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }} />
                                    </div>
                                </div>
                            </div> */}
                        </SectionCard>

                        <div className="space-y-8">
                            <SectionCard title="Display Mode" subtitle="Interface preference" icon={Sun}>
                                <div className="grid grid-cols-1 gap-3">
                                    {modes.map(({ id, label, Icon }) => (
                                        <button
                                            key={id}
                                            onClick={() => setLocalMode(id)}
                                            className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group ${localMode === id
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-slate-100 dark:border-white/5 text-slate-400 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-xl ${localMode === id ? 'bg-primary/10 text-primary' : 'bg-slate-50 dark:bg-white/5'}`}>
                                                <Icon size={20} />
                                            </div>
                                            <p className="text-xs font-black tracking-tight uppercase">{label}</p>
                                            {localMode === id && <div className="ml-auto w-2 h-2 rounded-full bg-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    )
}
