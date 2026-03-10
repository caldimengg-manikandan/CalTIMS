import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Settings2, Mail, LayoutGrid, Palette, Globe,
    Plus, X, Send, Eye, Save, Check, ChevronDown, ClipboardCheck,
    Sun, Moon, Monitor, Search, Clock, Users
} from 'lucide-react'
import { settingsAPI, projectAPI, reportSchedulesAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { useThemeStore, ACCENT_PRESETS } from '@/store/themeStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSystemStore } from '@/store/systemStore'
import PageHeader from '@/components/ui/PageHeader'

// ── Constants ────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'report', label: 'Report Settings', icon: Mail },
    { id: 'timesheet', label: 'Timesheet', icon: LayoutGrid },
    { id: 'attendance', label: 'Attendance Integration', icon: ClipboardCheck },
    { id: 'general', label: 'General', icon: Globe },
]

const FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'monthly']
const REPORT_TYPES = [
    { value: 'approved', label: 'Approved Timesheets' },
    { value: 'rejected', label: 'Rejected Timesheets' },
    { value: 'pending', label: 'Pending (Submitted) Timesheets' },
    { value: 'all', label: 'All Timesheets (Full Report)' },
]
const TIMEZONES = [
    'Asia/Kolkata', 'UTC', 'America/New_York', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Asia/Dubai', 'Asia/Singapore',
    'Asia/Tokyo', 'Australia/Sydney',
]
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

// ── Small reusable components ─────────────────────────────────────────────
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

function Chip({ label, onRemove, disabled }) {
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

function AddChipInput({ onAdd, placeholder, disabled }) {
    const [val, setVal] = useState('')
    const handle = () => {
        if (val.trim()) { onAdd(val.trim()); setVal('') }
    }
    return (
        <div className="flex gap-2 mt-3">
            <input
                className="input flex-1 text-sm"
                placeholder={placeholder}
                value={val}
                onChange={e => setVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()}
                disabled={disabled}
            />
            <button
                onClick={handle}
                disabled={disabled || !val.trim()}
                className="btn-primary px-3 py-2 rounded-lg text-sm flex items-center gap-1 disabled:opacity-40"
            >
                <Plus size={14} /> Add
            </button>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — REPORT SETTINGS (Schedules)
// ════════════════════════════════════════════════════════════════════════════


const STATUS_COLORS = {
    approved: { dot: 'bg-emerald-500', badge: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30' },
    rejected: { dot: 'bg-rose-500', badge: 'text-rose-700 bg-rose-50 dark:bg-rose-900/30' },
    pending: { dot: 'bg-amber-500', badge: 'text-amber-700 bg-amber-50 dark:bg-amber-900/30' },
    all: { dot: 'bg-blue-500', badge: 'text-blue-700 bg-blue-50 dark:bg-blue-900/30' },
}

const BLANK_FORM = {
    name: '', frequency: 'weekly', scheduledTime: '09:00',
    reportType: 'approved', recipientIds: [], projectIds: [], isActive: true,
}

/* ── Inner: Schedule Form Modal ─────────────────────────────────────────── */
function ScheduleFormModal({ open, onClose, initial, employees, allProjects }) {
    const qc = useQueryClient()
    const isEdit = !!initial?._id
    const [form, setForm] = useState(BLANK_FORM)
    const [empSearch, setEmpSearch] = useState('')
    const [projSearch, setProjSearch] = useState('')
    const [previewHtml, setPreviewHtml] = useState(null)
    const [previewOpen, setPreviewOpen] = useState(false)

    useEffect(() => {
        if (open) {
            setForm(initial
                ? {
                    name: initial.name || '',
                    frequency: initial.frequency || 'weekly',
                    scheduledTime: initial.scheduledTime || '09:00',
                    reportType: initial.reportType || 'approved',
                    recipientIds: (initial.recipientIds || []).map(r => r._id || r),
                    projectIds: initial.projectIds || [],
                    isActive: initial.isActive !== false,
                }
                : BLANK_FORM)
        }
    }, [open, initial])

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const toggleItem = (key, id) =>
        upd(key, form[key].includes(id) ? form[key].filter(x => x !== id) : [...form[key], id])

    const saveMutation = useMutation({
        mutationFn: () => isEdit
            ? reportSchedulesAPI.update(initial._id, form)
            : reportSchedulesAPI.create(form),
        onSuccess: () => {
            toast.success(isEdit ? 'Schedule updated!' : 'Schedule created — auto-send enabled!')
            qc.invalidateQueries(['report-schedules'])
            onClose()
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const previewMutation = useMutation({
        mutationFn: () => reportSchedulesAPI.preview({ reportType: form.reportType, projectIds: form.projectIds }),
        onSuccess: r => { setPreviewHtml(r.data.data?.html); setPreviewOpen(true) },
        onError: e => toast.error(e.response?.data?.message || 'Preview failed'),
    })

    const filtEmp = (employees || []).filter(e => !empSearch || e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.email.toLowerCase().includes(empSearch.toLowerCase()))
    const filtProj = (allProjects || []).filter(p => !projSearch || p.name.toLowerCase().includes(projSearch.toLowerCase()))
    const isAllProj = form.projectIds.length === 0

    return (
        <>
            <Modal isOpen={open} onClose={onClose} title={isEdit ? 'Edit Schedule' : 'New Report Schedule'}>
                <div className="space-y-5 overflow-y-auto max-h-[80vh] pr-1">
                    {/* Name */}
                    <div>
                        <label className="label">Schedule Name *</label>
                        <input className="input w-full" placeholder="e.g. Weekly Approved Report" value={form.name}
                            onChange={e => upd('name', e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Frequency */}
                        <div>
                            <label className="label mb-2 block">Frequency</label>
                            <div className="space-y-1.5">
                                {FREQUENCIES.map(f => (
                                    <button key={f} onClick={() => upd('frequency', f)}
                                        className={`w-full text-left px-3 py-2 rounded-xl border text-sm font-medium transition-all flex items-center justify-between
                                    ${form.frequency === f ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-primary/5'}`}>
                                        <span className="capitalize">{f}</span>
                                        {form.frequency === f && <Check size={13} />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Report Type + Time */}
                        <div className="space-y-4">
                            <div>
                                <label className="label mb-2 block">Report Type</label>
                                <div className="space-y-1.5">
                                    {REPORT_TYPES.map(rt => {
                                        const c = STATUS_COLORS[rt.value]
                                        return (
                                            <button key={rt.value} onClick={() => upd('reportType', rt.value)}
                                                className={`w-full text-left px-3 py-2 rounded-xl border text-sm font-medium transition-all flex items-center gap-2
                                            ${form.reportType === rt.value ? `border-primary ${c.badge}` : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:bg-primary/5'}`}>
                                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                                                {rt.label}
                                                {form.reportType === rt.value && <Check size={13} className="ml-auto" />}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div>
                                <label className="label">Delivery Time</label>
                                <input type="time" className="input w-full font-bold" value={form.scheduledTime}
                                    onChange={e => upd('scheduledTime', e.target.value)} />
                                <p className="text-[10px] text-slate-400 mt-1">Auto-sends at this time based on frequency</p>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <div>
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Active</p>
                                    <p className="text-xs text-slate-400">Auto-send emails on schedule</p>
                                </div>
                                <button onClick={() => upd('isActive', !form.isActive)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${form.isActive ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Recipients */}
                    <div>
                        <label className="label mb-2 block">Recipients *</label>
                        <div className="relative mb-2">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className="input pl-8 text-sm w-full" placeholder="Search employees..."
                                value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
                        </div>
                        <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-100 dark:border-white/10 rounded-xl p-2">
                            {filtEmp.map(emp => {
                                const sel = form.recipientIds.includes(emp._id)
                                return (
                                    <button key={emp._id} onClick={() => toggleItem('recipientIds', emp._id)}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-all ${sel ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${sel ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'}`}>
                                            {emp.name?.[0]?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-semibold truncate">{emp.name}</span>
                                            <span className="text-slate-400 text-xs ml-2">{emp.email}</span>
                                        </div>
                                        {sel && <Check size={12} className="flex-shrink-0" />}
                                    </button>
                                )
                            })}
                            {!filtEmp.length && <p className="text-xs text-slate-400 text-center py-4">No employees found</p>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{form.recipientIds.length} selected</p>
                    </div>

                    {/* Projects */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">Projects</label>
                            <button onClick={() => upd('projectIds', [])}
                                className={`text-xs px-2 py-1 rounded-lg border font-bold transition-all ${isAllProj ? 'bg-primary text-white border-transparent' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}>
                                All Projects
                            </button>
                        </div>
                        <div className="relative mb-2">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className="input pl-8 text-sm w-full" placeholder="Search projects..."
                                value={projSearch} onChange={e => setProjSearch(e.target.value)} />
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-100 dark:border-white/10 rounded-xl p-2">
                            {filtProj.map(proj => {
                                const sel = form.projectIds.includes(proj._id)
                                return (
                                    <button key={proj._id} onClick={() => toggleItem('projectIds', proj._id)}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-all ${sel ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${sel ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'}`}>
                                            {proj.code?.[0] || proj.name?.[0]}
                                        </div>
                                        <span className="font-semibold truncate flex-1">{proj.name}</span>
                                        {sel && <Check size={12} className="flex-shrink-0" />}
                                    </button>
                                )
                            })}
                            {!filtProj.length && <p className="text-xs text-slate-400 text-center py-4">No projects found</p>}
                        </div>
                        {!isAllProj && <p className="text-xs text-slate-400 mt-1">{form.projectIds.length} project(s) selected</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2 border-t border-slate-100 dark:border-white/10">
                        <button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                            {previewMutation.isPending ? <Spinner size="sm" /> : <Eye size={14} />} Preview
                        </button>
                        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || !form.recipientIds.length}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm shadow-md shadow-primary/20 disabled:opacity-40 transition-all">
                            {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={15} />}
                            {isEdit ? 'Update Schedule' : 'Create Schedule'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Preview Modal */}
            <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title="Email Preview">
                <div className="overflow-auto max-h-[60vh] rounded-xl border border-slate-200 dark:border-white/10">
                    {previewHtml
                        ? <iframe title="email-preview" srcDoc={previewHtml} className="w-full border-0" style={{ minHeight: '480px' }} />
                        : <div className="p-8 text-center text-slate-400">No preview available</div>}
                </div>
            </Modal>
        </>
    )
}

/* ── Inner: History Modal ─────────────────────────────────────────────────── */
function HistoryModal({ scheduleId, scheduleName, onClose }) {
    const { data: history, isLoading } = useQuery({
        queryKey: ['schedule-history', scheduleId],
        queryFn: () => reportSchedulesAPI.getHistory(scheduleId).then(r => r.data.data),
        enabled: !!scheduleId,
    })
    return (
        <Modal isOpen={!!scheduleId} onClose={onClose} title={`Send History — ${scheduleName}`}>
            {isLoading ? (
                <div className="flex justify-center py-10"><Spinner size="lg" /></div>
            ) : !history?.length ? (
                <div className="py-14 text-center">
                    <Clock size={32} className="text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No sends yet. This schedule will auto-send at the configured time.</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {history.map((h, i) => (
                        <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${h.status === 'success' ? 'border-emerald-100 bg-emerald-50 dark:bg-emerald-900/20' : 'border-rose-100 bg-rose-50 dark:bg-rose-900/20'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold ${h.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                {h.status === 'success' ? '✓' : '✗'}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm font-semibold ${h.status === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                                    {h.status === 'success' ? `Sent to ${h.recipientCount} recipient(s)` : 'Failed'}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">{h.reportTitle}</p>
                                {h.error && <p className="text-xs text-rose-500 mt-1 font-mono">{h.error}</p>}
                            </div>
                            <p className="text-[11px] text-slate-400 flex-shrink-0">
                                {new Date(h.sentAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    )
}

/* ── Main ReportTab ─────────────────────────────────────────────────────── */
function ReportTab() {
    const qc = useQueryClient()
    const [formOpen, setFormOpen] = useState(false)
    const [editTarget, setEditTarget] = useState(null)
    const [historyTarget, setHistoryTarget] = useState(null)   // { id, name }

    const { data: schedules = [], isLoading } = useQuery({
        queryKey: ['report-schedules'],
        queryFn: () => reportSchedulesAPI.getAll().then(r => r.data.data),
    })
    const { data: employees } = useQuery({
        queryKey: ['settings', 'employees', ''],
        queryFn: () => settingsAPI.getPickerEmployees('').then(r => r.data.data),
    })
    const { data: allProjects } = useQuery({
        queryKey: ['projects', 'all-minimal'],
        queryFn: () => projectAPI.getAll({ limit: 200 }).then(r => r.data.data),
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => reportSchedulesAPI.remove(id),
        onSuccess: () => { toast.success('Schedule deleted — auto-send stopped.'); qc.invalidateQueries(['report-schedules']) },
        onError: e => toast.error(e.response?.data?.message || 'Delete failed'),
    })

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, isActive }) => reportSchedulesAPI.update(id, { isActive }),
        onSuccess: (_, vars) => { toast.success(vars.isActive ? 'Schedule activated' : 'Schedule paused'); qc.invalidateQueries(['report-schedules']) },
        onError: e => toast.error(e.response?.data?.message || 'Update failed'),
    })

    const sendNowMutation = useMutation({
        mutationFn: (id) => reportSchedulesAPI.sendNow(id),
        onSuccess: r => { toast.success(r.data.data?.message || 'Report sent!'); qc.invalidateQueries(['report-schedules']) },
        onError: e => toast.error(e.response?.data?.message || 'Send failed'),
    })

    const openCreate = () => { setEditTarget(null); setFormOpen(true) }
    const openEdit = (s) => { setEditTarget(s); setFormOpen(true) }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Report Settings</h2>
                    <p className="text-sm text-slate-400">Configure automated report generation and delivery</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary/90 transition-all">
                    <Plus size={15} /> New Schedule
                </button>
            </div>

            {/* Schedule List */}
            {isLoading ? (
                <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : !schedules.length ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                    <Mail size={36} className="text-slate-300 mx-auto mb-3" />
                    <p className="font-semibold text-slate-500">No report schedules yet</p>
                    <p className="text-sm text-slate-400 mt-1">Create a schedule and emails will send automatically</p>
                    <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/20 mx-auto hover:bg-primary/90 transition-all">
                        <Plus size={14} /> Create First Schedule
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {schedules.map(s => {
                        const c = STATUS_COLORS[s.reportType] || STATUS_COLORS.all
                        const recipientNames = (s.recipientIds || []).map(r => r.name || r).slice(0, 3).join(', ')
                        const moreCount = (s.recipientIds || []).length - 3
                        return (
                            <div key={s._id} className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-sm overflow-hidden transition-all ${s.isActive ? 'border-slate-100 dark:border-white/10' : 'border-slate-200 dark:border-white/5 opacity-70'}`}>
                                <div className="flex flex-wrap items-center gap-4 p-4">
                                    {/* Status indicator */}
                                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.isActive ? c.dot : 'bg-slate-300'}`} />

                                    {/* Main info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <p className="font-bold text-slate-800 dark:text-white text-sm">{s.name}</p>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.badge}`}>
                                                {s.reportType}
                                            </span>
                                            {!s.isActive && (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-500">
                                                    Paused
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            <span className="capitalize">{s.frequency}</span>
                                            {' at '}<strong className="text-slate-600 dark:text-slate-300">{s.scheduledTime || '09:00'}</strong>
                                            {' · '}{recipientNames || 'No recipients'}
                                            {moreCount > 0 && ` +${moreCount} more`}
                                            {s.lastSentAt && (
                                                <span className="ml-2 text-slate-300">
                                                    · Last sent {new Date(s.lastSentAt).toLocaleDateString('en-IN')}
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {/* Toggle active */}
                                        <button
                                            onClick={() => toggleActiveMutation.mutate({ id: s._id, isActive: !s.isActive })}
                                            title={s.isActive ? 'Pause' : 'Activate'}
                                            className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${s.isActive ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${s.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>

                                        <button onClick={() => setHistoryTarget({ id: s._id, name: s.name })} title="View History"
                                            className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all">
                                            <Clock size={15} />
                                        </button>
                                        <button onClick={() => openEdit(s)} title="Edit"
                                            className="p-2 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all">
                                            <Settings2 size={15} />
                                        </button>
                                        <button onClick={() => { if (window.confirm(`Delete "${s.name}"? Auto-send will stop.`)) deleteMutation.mutate(s._id) }}
                                            title="Delete" className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all">
                                            <X size={15} />
                                        </button>
                                        <button onClick={() => sendNowMutation.mutate(s._id)} disabled={sendNowMutation.isPending} title="Send Now"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all disabled:opacity-50">
                                            {sendNowMutation.isPending ? <Spinner size="sm" /> : <Send size={12} />} Send
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Form Modal */}
            <ScheduleFormModal
                open={formOpen}
                onClose={() => { setFormOpen(false); setEditTarget(null) }}
                initial={editTarget}
                employees={employees}
                allProjects={allProjects}
            />

            {/* History Modal */}
            {historyTarget && (
                <HistoryModal
                    scheduleId={historyTarget.id}
                    scheduleName={historyTarget.name}
                    onClose={() => setHistoryTarget(null)}
                />
            )}
        </div>
    )
}



// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — TIMESHEET CUSTOMIZATION
// ════════════════════════════════════════════════════════════════════════════
function TimesheetTab() {
    const qc = useQueryClient()
    const [taskCategories, setTaskCategories] = useState([])
    const [leaveTypes, setLeaveTypes] = useState([])
    const [eligibleLeaveTypes, setEligibleLeaveTypes] = useState([])
    const [maxEntriesPerDay, setMaxEntriesPerDay] = useState(0)
    const [maxEntriesPerWeek, setMaxEntriesPerWeek] = useState(0)
    const [permissionMaxHoursPerDay, setPermissionMaxHoursPerDay] = useState(4)
    const [permissionMaxDaysPerWeek, setPermissionMaxDaysPerWeek] = useState(0)
    const [permissionMaxDaysPerMonth, setPermissionMaxDaysPerMonth] = useState(0)

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data) {
            setTaskCategories(data.taskCategories || [])
            setLeaveTypes(data.leaveTypes || [])
            setEligibleLeaveTypes(data.eligibleLeaveTypes || [])
            setMaxEntriesPerDay(data.maxEntriesPerDay || 0)
            setMaxEntriesPerWeek(data.maxEntriesPerWeek || 0)
            setPermissionMaxHoursPerDay(data.permissionMaxHoursPerDay || 4)
            setPermissionMaxDaysPerWeek(data.permissionMaxDaysPerWeek || 0)
            setPermissionMaxDaysPerMonth(data.permissionMaxDaysPerMonth || 0)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.saveTimesheetSettings({
            taskCategories,
            leaveTypes,
            eligibleLeaveTypes,
            maxEntriesPerDay: Number(maxEntriesPerDay),
            maxEntriesPerWeek: Number(maxEntriesPerWeek),
            permissionMaxHoursPerDay: Number(permissionMaxHoursPerDay),
            permissionMaxDaysPerWeek: Number(permissionMaxDaysPerWeek),
            permissionMaxDaysPerMonth: Number(permissionMaxDaysPerMonth)
        }),
        onSuccess: () => { toast.success('Timesheet settings saved!'); qc.invalidateQueries(['settings', 'timesheet']) },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Timesheet Customization</h2>
                <p className="text-sm text-slate-400">Manage available task categories and leave types shown in the Timesheet Entry page</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Task Categories */}
                <SectionCard title="Task Categories" subtitle="Shown in the Task dropdown during timesheet entry" icon={LayoutGrid}>
                    <div className="flex flex-wrap gap-2">
                        {taskCategories.map((cat, i) => (
                            <Chip
                                key={i}
                                label={cat}
                                onRemove={() => setTaskCategories(taskCategories.filter((_, idx) => idx !== i))}
                            />
                        ))}
                    </div>
                    <AddChipInput
                        placeholder="e.g. Code Review, Research..."
                        onAdd={(val) => {
                            if (!taskCategories.includes(val)) setTaskCategories([...taskCategories, val])
                            else toast.error('Category already exists')
                        }}
                    />
                    <p className="text-xs text-slate-400 mt-3">Note: 'Leave' and 'Holiday' are always available and cannot be removed</p>
                </SectionCard>

                {/* Leave Types */}
                <SectionCard title="Leave Types" subtitle="Shown when employees select a leave row" icon={Clock}>
                    <div className="flex flex-wrap gap-2">
                        {leaveTypes.map((lt, i) => (
                            <Chip
                                key={i}
                                label={lt}
                                onRemove={() => setLeaveTypes(leaveTypes.filter((_, idx) => idx !== i))}
                            />
                        ))}
                    </div>
                    <AddChipInput
                        placeholder="e.g. Bereavement, Study Leave..."
                        onAdd={(val) => {
                            if (!leaveTypes.includes(val)) setLeaveTypes([...leaveTypes, val])
                            else toast.error('Leave type already exists')
                        }}
                    />
                </SectionCard>

                {/* Eligible Leave Types */}
                <SectionCard title="Leave Eligibility" subtitle="Types that carry a yearly balance" icon={Users}>
                    <div className="flex flex-wrap gap-2">
                        {eligibleLeaveTypes.map((elt, i) => (
                            <Chip
                                key={i}
                                label={elt}
                                onRemove={() => setEligibleLeaveTypes(eligibleLeaveTypes.filter((_, idx) => idx !== i))}
                            />
                        ))}
                    </div>
                    <AddChipInput
                        placeholder="e.g. Marriage, Compassionate..."
                        onAdd={(val) => {
                            if (!eligibleLeaveTypes.includes(val.toLowerCase())) setEligibleLeaveTypes([...eligibleLeaveTypes, val.toLowerCase()])
                            else toast.error('Eligible type already exists')
                        }}
                    />
                    <p className="text-[10px] text-slate-400 mt-2 font-medium bg-slate-50 dark:bg-white/5 p-2 rounded-lg italic border border-slate-100 dark:border-white/10 leading-relaxed">
                        Adding a type here enables entitlement management in Leave Management &gt; Leave Eligibility.
                    </p>
                </SectionCard>

                {/* Entry Limits */}
                <SectionCard title="Entry Limits" subtitle="Enforce maximum entries per day/week" icon={Settings2}>
                    <div className="space-y-4">
                        <div>
                            <label className="label mb-1.5 block">Daily Hour Limit</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={permissionMaxHoursPerDay}
                                    onChange={e => setPermissionMaxHoursPerDay(e.target.value)}
                                    placeholder="4"
                                />
                                <span className="text-xs text-slate-400 font-medium">Hours</span>
                            </div>
                        </div>
                        <div>
                            <label className="label mb-1.5 block">Weekly Days Limit</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={permissionMaxDaysPerWeek}
                                    onChange={e => setPermissionMaxDaysPerWeek(e.target.value)}
                                    placeholder="0 for no limit"
                                />
                                <span className="text-xs text-slate-400 font-medium">Days</span>
                            </div>
                        </div>
                        <div>
                            <label className="label mb-1.5 block">Monthly Days Limit</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="0"
                                    className="input flex-1 text-sm font-bold"
                                    value={permissionMaxDaysPerMonth}
                                    onChange={e => setPermissionMaxDaysPerMonth(e.target.value)}
                                    placeholder="0 for no limit"
                                />
                                <span className="text-xs text-slate-400 font-medium">Days</span>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 italic">Set to 0 to disable entry limits.</p>
                    </div>
                </SectionCard>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-sm text-amber-800 dark:text-amber-300">
                <strong>💡 Note:</strong> Changes take effect immediately in the Timesheet Entry page after saving. Existing timesheets with old categories are not affected.
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all"
                >
                    {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={16} />}
                    Save Changes
                </button>
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — THEME & APPEARANCE
// ════════════════════════════════════════════════════════════════════════════
function ThemeTab() {
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
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Theme & Appearance</h2>
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

// ════════════════════════════════════════════════════════════════════════════
// TAB 4 — GENERAL SETTINGS
// ════════════════════════════════════════════════════════════════════════════
function GeneralTab() {
    const qc = useQueryClient()
    const { updateGeneralSettings } = useSettingsStore()
    const { appVersion, toggleVersion } = useSystemStore()
    const [form, setForm] = useState({
        companyName: '',
        timezone: 'Asia/Kolkata',
        workingHoursPerDay: 8,
        strictDailyHours: false,
        isWeekendWorkable: false,
        weekStartDay: 'monday',
        dateFormat: 'DD/MM/YYYY',
    })

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'general'],
        queryFn: () => settingsAPI.getGeneralSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data) setForm({ ...form, ...data })
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.saveGeneralSettings(form),
        onSuccess: () => {
            toast.success('General settings saved!')
            updateGeneralSettings(form)
            qc.invalidateQueries(['settings', 'general'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const upd = (k, v) => setForm(f => ({ ...f, [k]: v }))

    const handleToggleTier = async () => {
        const nextVersion = appVersion === 'basic' ? 'pro' : 'basic'
        try {
            await toggleVersion(nextVersion)
            toast.success(`Application switched to ${nextVersion.toUpperCase()} mode!`)
            qc.invalidateQueries()
        } catch (error) {
            // Error is handled in store
        }
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">General Settings</h2>
                <p className="text-sm text-slate-400">App-wide configuration affecting all users</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Application Tier */}
                <SectionCard title="Application Tier" subtitle="Switch between Basic and Pro features (Demo)" icon={Settings2}>
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                Pro Enterprise Mode
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">Enables Compliance, Reports, Incident support, Leave Tracker, and Leave Management</p>
                        </div>
                        <button
                            onClick={handleToggleTier}
                            className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${appVersion === 'pro' ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${appVersion === 'pro' ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </SectionCard>

                {/* Organization */}
                <SectionCard title="Organization" subtitle="Company identity settings" icon={Globe}>
                    <div className="space-y-4">
                        <div>
                            <label className="label">Company Name</label>
                            <input
                                className="input w-full"
                                placeholder="CALTIMS"
                                value={form.companyName}
                                onChange={e => upd('companyName', e.target.value)}
                            />
                            <p className="text-xs text-slate-400 mt-1">Shown in report emails and page header</p>
                        </div>
                        <div>
                            <label className="label">Timezone</label>
                            <div className="relative">
                                <select
                                    className="input w-full appearance-none pr-9"
                                    value={form.timezone}
                                    onChange={e => upd('timezone', e.target.value)}
                                >
                                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="label">Date Format</label>
                            <div className="grid grid-cols-3 gap-2">
                                {DATE_FORMATS.map(fmt => (
                                    <button
                                        key={fmt}
                                        onClick={() => upd('dateFormat', fmt)}
                                        className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${form.dateFormat === fmt
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/40'
                                            }`}
                                    >
                                        {fmt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>

                {/* Working Hours */}
                <SectionCard title="Working Hours" subtitle="Used for timesheet validation and reporting" icon={Clock}>
                    <div className="space-y-4">
                        <div>
                            <label className="label">Working Hours per Day</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min={1} max={12} step={0.5}
                                    value={form.workingHoursPerDay}
                                    onChange={e => upd('workingHoursPerDay', parseFloat(e.target.value))}
                                    className="flex-1 accent-primary"
                                />
                                <div className="w-20 text-center">
                                    <input
                                        type="number"
                                        min={1} max={24} step={0.5}
                                        className="input text-center font-bold text-primary"
                                        value={form.workingHoursPerDay}
                                        onChange={e => upd('workingHoursPerDay', parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Standard: 8 hours</p>
                        </div>

                        {/* Strict Working Hours Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white">
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-white">Strict Daily Hours</p>
                                <p className="text-[10px] text-slate-400">Require exactly {form.workingHoursPerDay} hrs/day for any entry</p>
                            </div>
                            <button onClick={() => upd('strictDailyHours', !form.strictDailyHours)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${form.strictDailyHours ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.strictDailyHours ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Weekend Entry Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white">
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-white">Enable Weekend Entry</p>
                                <p className="text-[10px] text-slate-400">Allow timesheet entry for Saturday and Sunday</p>
                            </div>
                            <button onClick={() => upd('isWeekendWorkable', !form.isWeekendWorkable)}
                                className={`relative w-11 h-6 rounded-full transition-colors ${form.isWeekendWorkable ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-white/20'}`}>
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isWeekendWorkable ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div>
                            <label className="label">Week Start Day</label>
                            <div className="grid grid-cols-2 gap-3">
                                {['monday', 'sunday'].map(day => (
                                    <button
                                        key={day}
                                        onClick={() => upd('weekStartDay', day)}
                                        className={`py-3 rounded-xl border-2 capitalize text-sm font-semibold transition-all ${form.weekStartDay === day
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/40'
                                            }`}
                                    >
                                        {day === 'monday' ? 'Monday (Mon–Sun)' : 'Sunday (Sun–Sat)'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </SectionCard>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all"
                >
                    {saveMutation.isPending ? <Spinner size="sm" /> : <Save size={16} />}
                    Save Changes
                </button>
            </div>
        </div>
    )
}


// ════════════════════════════════════════════════════════════════════════════
// TAB 5 — ATTENDANCE INTEGRATION
// ════════════════════════════════════════════════════════════════════════════
function AttendanceTab() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight">Attendance Integration</h2>
                <p className="text-sm text-slate-400">Configure biometric and access control system synchronization</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SectionCard
                    title="System Status"
                    subtitle="Current connection to organization's attendance gateway"
                    icon={ClipboardCheck}
                >
                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-black border border-slate-100 dark:border-white transition-all hover:border-amber-200">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                                    <ClipboardCheck size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-tight text-slate-700 dark:text-slate-200">Integration Status</p>
                                    <p className="text-xs font-bold text-amber-500">NOT CONFIGURED</p>
                                </div>
                            </div>
                            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95">
                                Configure Integration
                            </button>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10">
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                Connect your ZKTeco, HID, or Suprema biometric devices to automatically sync swipe-in and swipe-out times with employee timesheets.
                            </p>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard
                    title="Device Logs"
                    subtitle="Real-time activity from connected devices"
                    icon={Clock}
                >
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-300 mb-3">
                            <Clock size={24} />
                        </div>
                        <p className="text-sm font-semibold text-slate-500">No active streams</p>
                        <p className="text-[10px] text-slate-400 mt-1">Configure integration to view real-time logs</p>
                    </div>
                </SectionCard>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/30 text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                <strong>💡 Pro Tip:</strong> Integrating with biometric devices allows for automatic "Office Presence" calculation, which can be compared against timesheet hours for accuracy auditing.
            </div>
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ════════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('report')

    const tabMap = {
        report: <ReportTab />,
        timesheet: <TimesheetTab />,
        attendance: <AttendanceTab />,
        general: <GeneralTab />,
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader title="Settings" />

            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === id
                            ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        <Icon size={15} />
                        <span className="hidden sm:inline">{label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
                {tabMap[activeTab]}
            </div>
        </div>
    )
}
