import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { userAPI, authAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import {
    User, Lock, Palette, Sun, Moon, Monitor,
    Check, Save, Eye, EyeOff, Shield, Mail, Phone, Calendar as CalendarIcon, Briefcase
} from 'lucide-react'
import { useThemeStore, ACCENT_PRESETS } from '@/store/themeStore'
import PageHeader from '@/components/ui/PageHeader'

// ── Shared UI Components ─────────────────────────────────────────────────────
function SectionCard({ title, subtitle, icon: Icon, children }) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center gap-3">
                {Icon && (
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon size={18} className="text-primary" />
                    </div>
                )}
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">{title}</h3>
                    {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            <div className="p-5">{children}</div>
        </div>
    )
}

// ── Tab 1: Profile Info ──────────────────────────────────────────────────────
function InfoTab({ profile }) {
    return (
        <div className="space-y-6">
            <div className="card">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center text-white text-4xl font-black shadow-lg shadow-primary/20">
                        {profile?.name?.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{profile?.name}</h2>
                        <p className="text-slate-500 font-medium flex items-center gap-2 mt-1">
                            <Mail size={14} /> {profile?.email}
                        </p>
                        <div className="flex gap-2 mt-3">
                            <span className="badge badge-primary-100 text-primary-700 bg-primary-50 dark:bg-primary-900/30 px-3 py-1 font-bold capitalize">{profile?.role}</span>
                            {profile?.department && (
                                <span className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 dark:border-white/10">
                                    {profile?.department}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-12 pt-8 border-t border-slate-100 dark:border-white/5">
                    {[
                        { label: 'Employee ID', value: profile?.employeeId, icon: Shield },
                        { label: 'Designation', value: profile?.designation || '—', icon: Briefcase },
                        { label: 'Joining Date', value: profile?.joiningDate ? new Date(profile.joiningDate).toLocaleDateString() : '—', icon: CalendarIcon },
                        { label: 'Phone', value: profile?.phone || '—', icon: Phone },
                    ].map((item) => (
                        <div key={item.label} className="flex gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 flex items-center justify-center flex-shrink-0 text-slate-400">
                                <item.icon size={18} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Tab 2: Theme ─────────────────────────────────────────────────────────────
function ThemeTab() {
    const { mode, accentPreset, customColor, setMode, setAccentPreset, setCustomColor } = useThemeStore()
    const colorInputRef = useRef(null)

    const modes = [
        { id: 'light', label: 'Light', Icon: Sun },
        { id: 'dark', label: 'Dark', Icon: Moon },
        { id: 'system', label: 'System', Icon: Monitor },
    ]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionCard title="Display Mode" subtitle="Choose your preferred interface style" icon={Sun}>
                <div className="grid grid-cols-3 gap-3">
                    {modes.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setMode(id)}
                            className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all text-sm font-bold ${mode === id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-100 dark:border-white/10 text-slate-500 hover:border-primary/40 hover:bg-primary/5'
                                }`}
                        >
                            <Icon size={22} />
                            {label}
                        </button>
                    ))}
                </div>
            </SectionCard>

            <SectionCard title="Accent Color" subtitle="Applied to active states across the app" icon={Palette}>
                <div className="grid grid-cols-6 gap-3 mb-6">
                    {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
                        <button
                            key={key}
                            title={preset.name}
                            onClick={() => setAccentPreset(key)}
                            style={{ backgroundColor: preset.primary }}
                            className={`w-full aspect-square rounded-xl transition-all hover:scale-110 shadow-sm ${accentPreset === key && !customColor
                                ? 'ring-4 ring-offset-2 ring-primary shadow-lg scale-110'
                                : ''
                                }`}
                        >
                            {accentPreset === key && !customColor && (
                                <Check size={14} className="text-white mx-auto" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="border-t border-slate-100 dark:border-white/5 pt-4">
                    <p className="text-xs font-bold text-slate-500 mb-2">Custom Color Picker</p>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-11 h-11 rounded-xl border-2 border-slate-200 dark:border-white/10 cursor-pointer flex-shrink-0 overflow-hidden shadow-sm"
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
                            className="input flex-1 text-sm font-mono tracking-wider"
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
                                className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            </SectionCard>
        </div>
    )
}

// ── Tab 3: Security (Change Password) ────────────────────────────────────────
function SecurityTab({ isForced }) {
    const [pwdForm, setPwdForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' })
    const [showPwds, setShowPwds] = useState({ old: false, new: false, confirm: false })
    const { logout } = useAuthStore()

    const changeMutation = useMutation({
        mutationFn: (data) => authAPI.changePassword(data),
        onSuccess: () => {
            toast.success('Password changed successfully! Please log in again.')
            setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
            setTimeout(() => logout(), 1500)
        },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to change password'),
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (pwdForm.newPassword !== pwdForm.confirmPassword) {
            return toast.error('New passwords do not match')
        }
        if (pwdForm.newPassword.length < 8) {
            return toast.error('Password must be at least 8 characters')
        }
        changeMutation.mutate({
            currentPassword: pwdForm.oldPassword,
            newPassword: pwdForm.newPassword,
            confirmPassword: pwdForm.confirmPassword
        })
    }

    return (
        <div className="max-w-xl">
            {isForced && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3">
                    <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-sm">Action Required</h4>
                        <p className="text-xs mt-1">Your password has expired. You must change your password before you can continue using the application.</p>
                    </div>
                </div>
            )}
            <SectionCard title="Change Password" subtitle="Update your security credentials" icon={Lock}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Old Password</label>
                        <div className="relative">
                            <input
                                type={showPwds.old ? 'text' : 'password'}
                                className="input pr-10"
                                placeholder="••••••••"
                                required
                                value={pwdForm.oldPassword}
                                onChange={e => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                            />
                            <button type="button" onClick={() => setShowPwds({ ...showPwds, old: !showPwds.old })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPwds.old ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">New Password</label>
                        <div className="relative">
                            <input
                                type={showPwds.new ? 'text' : 'password'}
                                className="input pr-10"
                                placeholder="••••••••"
                                required
                                value={pwdForm.newPassword}
                                onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                            />
                            <button type="button" onClick={() => setShowPwds({ ...showPwds, new: !showPwds.new })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPwds.new ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                        <div className="relative">
                            <input
                                type={showPwds.confirm ? 'text' : 'password'}
                                className="input pr-10"
                                placeholder="••••••••"
                                required
                                value={pwdForm.confirmPassword}
                                onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                            />
                            <button type="button" onClick={() => setShowPwds({ ...showPwds, confirm: !showPwds.confirm })} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                {showPwds.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button type="submit" disabled={changeMutation.isPending} className="btn-primary w-full justify-center py-3 shadow-lg shadow-primary/20">
                            {changeMutation.isPending ? <Spinner size="sm" /> : <Save size={18} />}
                            Update Password
                        </button>
                    </div>
                </form>
            </SectionCard>
        </div>
    )
}


// ── Main Profile Page ────────────────────────────────────────────────────────
export default function ProfilePage() {
    const { user } = useAuthStore()
    const location = useLocation()
    const isForced = location.state?.forcePasswordChange

    const [activeTab, setActiveTab] = useState(isForced ? 'security' : 'info')

    useEffect(() => {
        if (isForced && activeTab !== 'security') {
            setActiveTab('security')
        }
    }, [isForced])

    const { data: profile, isLoading } = useQuery({
        queryKey: ['me'],
        queryFn: () => userAPI.getMe().then(r => r.data.data),
    })

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center pt-32 gap-4">
            <Spinner size="lg" />
            <p className="text-slate-400 font-medium animate-pulse">Loading profile data...</p>
        </div>
    )

    const tabs = [
        { id: 'info', label: 'Basic Info', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: 'theme', label: 'Theme & Appearance', icon: Palette },
    ]

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
            <PageHeader title="Account Settings" />

            {/* Tab Navigation */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        disabled={isForced && tab.id !== 'security'}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all
                            ${activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-primary shadow-sm ring-1 ring-slate-200 dark:ring-white/10'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 dark:hover:bg-white/5'
                            }
                            ${isForced && tab.id !== 'security' ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-slide-in">
                {activeTab === 'info' && <InfoTab profile={profile} />}
                {activeTab === 'security' && <SecurityTab isForced={isForced} />}
                {activeTab === 'theme' && <ThemeTab />}
            </div>
        </div>
    )
}
