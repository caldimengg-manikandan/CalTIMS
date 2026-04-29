import React, { useState, useEffect, useRef } from 'react'
import { Sun, Moon, Monitor, Palette, Check, Building2, CheckCircle2, Shield, Info, Upload, Image as ImageIcon, Save } from 'lucide-react'
import { useThemeStore, ACCENT_PRESETS } from '@/store/themeStore'
import { SectionCard } from '../components/SharedUI'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

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

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* Configuration Panel */}
                <div className="lg:col-span-7 space-y-8">
                    {/* Atmosphere: Color System */}
                    <SectionCard title="Atmosphere" subtitle="Applied accent color system" icon={Palette}>
                        <div className="grid grid-cols-5 gap-4 mb-8 pt-2">
                            {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
                                <button
                                    key={key}
                                    onClick={() => {
                                        setLocalAccentPreset(key)
                                        setLocalCustomColor(null)
                                    }}
                                    style={{ backgroundColor: preset.primary }}
                                    className={`w-full aspect-square rounded-2xl transition-all hover:scale-110 active:scale-95 shadow-sm ${localAccentPreset === key && !localCustomColor
                                        ? 'ring-4 ring-offset-4 ring-primary scale-90 shadow-xl'
                                        : 'opacity-80 hover:opacity-100 hover:shadow-md'
                                        }`}
                                />
                            ))}
                        </div>

                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Custom Primary Hex</label>
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-14 h-14 rounded-2xl border-4 border-white dark:border-slate-800 cursor-pointer overflow-hidden shadow-lg flex-shrink-0 transition-transform hover:scale-105"
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
                                <div className="relative flex-1">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">#</span>
                                    <input
                                        type="text"
                                        className="input w-full h-14 pl-8 text-sm font-mono font-bold bg-slate-50/50 dark:bg-white/5 border-slate-100 dark:border-white/5 focus:border-primary/50 transition-colors"
                                        placeholder="4F46E5"
                                        value={(localCustomColor || '').replace('#', '')}
                                        onChange={e => {
                                            const v = e.target.value
                                            if (/^[0-9A-Fa-f]{0,6}$/.test(v)) {
                                                if (v.length === 6) setLocalCustomColor(`#${v}`)
                                                else if (!v) setLocalCustomColor(null)
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Display Mode */}
                    <SectionCard title="Display Mode" subtitle="Interface preference" icon={Sun}>
                        <div className="grid grid-cols-3 gap-4 pt-2">
                            {modes.map(({ id, label, Icon }) => (
                                <button
                                    key={id}
                                    onClick={() => setLocalMode(id)}
                                    className={`flex flex-col items-center gap-3 p-6 rounded-[2rem] border-2 transition-all group ${localMode === id
                                        ? 'border-primary bg-primary/5 text-primary shadow-lg shadow-primary/5'
                                        : 'border-slate-100 dark:border-white/5 text-slate-400 hover:border-slate-200 hover:bg-slate-50/50'
                                        }`}
                                >
                                    <div className={`p-3 rounded-2xl ${localMode === id ? 'bg-primary text-white shadow-lg' : 'bg-slate-50 dark:bg-white/5 group-hover:scale-110 transition-transform'}`}>
                                        <Icon size={24} />
                                    </div>
                                    <p className="text-[10px] font-black tracking-widest uppercase">{label}</p>
                                </button>
                            ))}
                        </div>
                    </SectionCard>
                </div>

                {/* Sticky Preview Panel */}
                <div className="lg:col-span-5 sticky top-24">
                    <div className="relative group">
                        {/* Decorative background elements */}
                        <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-indigo-500/10 rounded-[3rem] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden">
                            {/* Browser Header */}
                            <div className="px-6 py-4 bg-slate-50/80 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
                                </div>
                                <div className="px-4 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 shadow-sm">
                                    <p className="text-[9px] font-bold text-slate-400 tracking-tight flex items-center gap-2">
                                        <Shield size={10} className="text-emerald-500" />
                                        app.caltims.com/settings
                                    </p>
                                </div>
                                <div className="w-10" /> {/* Spacer */}
                            </div>

                            {/* Mock Interface Container */}
                            <div className={`h-[420px] overflow-hidden ${localMode === 'dark' ? 'dark bg-[#080d14]' : 'bg-white'}`}>
                                <div className="flex h-full">
                                    {/* Mock Sidebar */}
                                    <div className="w-14 border-r border-slate-100 dark:border-white/5 p-3 flex flex-col gap-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transform hover:rotate-12 transition-transform" style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }}>
                                            <Building2 size={14} className="text-white" />
                                        </div>
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className={`w-8 h-8 rounded-lg flex items-center justify-center ${i === 1 ? 'bg-primary/10' : 'bg-slate-50 dark:bg-white/5'}`}>
                                                <div className={`w-3 h-3 rounded-sm ${i === 1 ? '' : 'bg-slate-200 dark:bg-slate-700'}`} style={i === 1 ? { backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary } : {}} />
                                            </div>
                                        ))}
                                    </div>

                                    {/* Mock Main Content */}
                                    <div className="flex-1 flex flex-col">
                                        {/* Mock Topbar */}
                                        <div className="h-12 border-b border-slate-100 dark:border-white/5 px-4 flex items-center justify-between">
                                            <div className="h-2 w-24 rounded bg-slate-100 dark:bg-white/10" />
                                            <div className="flex gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10" />
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/10" />
                                            </div>
                                        </div>

                                        {/* Mock Content Body */}
                                        <div className="p-6 space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="space-y-1.5">
                                                    <div className="h-4 w-40 rounded bg-slate-200 dark:bg-white/10" />
                                                    <div className="h-2 w-56 rounded bg-slate-50 dark:bg-white/5" />
                                                </div>
                                                <div className="h-9 px-5 rounded-xl shadow-lg flex items-center justify-center text-[9px] font-black text-white transform hover:scale-105 active:scale-95 transition-all" style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }}>
                                                    SAVE CHANGES
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                                                    <div className="h-2.5 w-16 rounded" style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }} />
                                                    <div className="space-y-2">
                                                        <div className="h-2 w-full rounded bg-slate-50 dark:bg-white/5" />
                                                        <div className="h-2 w-2/3 rounded bg-slate-50 dark:bg-white/5" />
                                                    </div>
                                                </div>
                                                <div className="p-5 rounded-3xl bg-slate-50/50 dark:bg-white/5 space-y-4">
                                                    <div className="h-2.5 w-12 rounded bg-slate-200 dark:bg-slate-700" />
                                                    <div className="flex gap-1.5">
                                                        <div className="h-6 w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5" />
                                                        <div className="h-6 w-12 rounded-lg bg-primary/20" style={{ backgroundColor: (localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary) + '33' }} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="h-20 w-full rounded-3xl border-2 border-dashed border-slate-100 dark:border-white/5 flex flex-col items-center justify-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: localCustomColor || ACCENT_PRESETS[localAccentPreset]?.primary }} />
                                                </div>
                                                <p className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">Live Preview Area</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-center gap-2 px-4">
                            <Info size={14} className="text-primary" />
                            <p className="text-[10px] text-slate-500 font-medium italic text-center">
                                Adjustments shown above provide a real-time simulation of the enterprise environment.
                            </p>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    )
}
