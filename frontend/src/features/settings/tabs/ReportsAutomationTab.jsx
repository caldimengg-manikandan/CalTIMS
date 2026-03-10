import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Settings2, X, Send, Eye, Save, Check, Clock, Search, Plus, AtSign } from 'lucide-react'
import { reportSchedulesAPI, settingsAPI, projectAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import toast from 'react-hot-toast'
import { SectionCard } from '../components/SharedUI'

const FREQUENCIES = ['daily', 'weekly', 'fortnightly', 'monthly']
const REPORT_TYPES = [
    { value: 'approved', label: 'Approved Timesheets' },
    { value: 'rejected', label: 'Rejected Timesheets' },
    { value: 'pending', label: 'Pending (Submitted) Timesheets' },
    { value: 'all', label: 'All Timesheets (Full Report)' },
]
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
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [sendPdfPanel, setSendPdfPanel] = useState(false)
    const [sendEmails, setSendEmails] = useState('')

    const closePreview = () => {
        setPreviewOpen(false)
        setSendPdfPanel(false)
        if (previewPdfUrl) { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null) }
    }

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
        mutationFn: () => reportSchedulesAPI.previewPdf({ reportType: form.reportType, projectIds: form.projectIds }),
        onSuccess: r => {
            if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl)
            const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }))
            setPreviewPdfUrl(url)
            setSendPdfPanel(false)
            setSendEmails('')
            setPreviewOpen(true)
        },
        onError: e => toast.error(e.response?.data?.message || 'Preview failed'),
    })

    const sendPdfMutation = useMutation({
        mutationFn: () => {
            const emails = sendEmails.split(/[,\n]+/).map(e => e.trim()).filter(Boolean)
            return reportSchedulesAPI.sendPdf({ reportType: form.reportType, projectIds: form.projectIds, recipientEmails: emails })
        },
        onSuccess: r => { toast.success(r.data.message || 'PDF sent!'); setSendPdfPanel(false) },
        onError: e => toast.error(e.response?.data?.message || 'Send failed'),
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

            {/* Preview Modal — shows the actual PDF */}
            <Modal isOpen={previewOpen} onClose={closePreview} title="Report Preview (PDF)">
                {/* PDF viewer embed */}
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800">
                    {previewPdfUrl
                        ? <embed
                            src={previewPdfUrl}
                            type="application/pdf"
                            className="w-full"
                            style={{ height: '65vh', minHeight: '480px' }}
                        />
                        : <div className="p-8 text-center text-slate-400">No preview available</div>}
                </div>

                {/* Send PDF panel */}
                <div className="mt-4 space-y-3">
                    <button
                        onClick={() => { setSendPdfPanel(v => !v); if (!sendEmails) setSendEmails((form.recipientIds.map(id => (employees || []).find(e => e._id === id)?.email).filter(Boolean)).join(', ')) }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all ${sendPdfPanel
                            ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                            }`}>
                        <AtSign size={15} /> Send this PDF via Email
                    </button>

                    {sendPdfPanel && (
                        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/60 dark:bg-indigo-900/20 p-4 space-y-3">
                            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                <AtSign size={12} /> Recipient email addresses (comma separated)
                            </p>
                            <textarea
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                                placeholder="alice@company.com, bob@company.com"
                                value={sendEmails}
                                onChange={e => setSendEmails(e.target.value)}
                            />
                            <button
                                onClick={() => sendPdfMutation.mutate()}
                                disabled={sendPdfMutation.isPending || !sendEmails.trim()}
                                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-400/20 disabled:opacity-50 transition-all">
                                {sendPdfMutation.isPending ? <Spinner size="sm" /> : <Send size={14} />} Send PDF Now
                            </button>
                        </div>
                    )}
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
export default function ReportsAutomationTab() {
    const qc = useQueryClient()
    const [formOpen, setFormOpen] = useState(false)
    const [editTarget, setEditTarget] = useState(null)
    const [historyTarget, setHistoryTarget] = useState(null)
    const [globalSettings, setGlobalSettings] = useState({
        defaultFormat: 'PDF',
        autoSchedule: false,
        frequency: 'Weekly'
    })

    const { data: settingsData } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (settingsData?.report) {
            setGlobalSettings({
                defaultFormat: settingsData.report.defaultFormat || 'PDF',
                autoSchedule: !!settingsData.report.autoSchedule,
                frequency: settingsData.report.frequency || 'Weekly'
            })
        }
    }, [settingsData])

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

    const globalSaveMutation = useMutation({
        mutationFn: (report) => settingsAPI.updateSettings({ report }),
        onSuccess: () => {
            toast.success('Global report settings saved!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id) => reportSchedulesAPI.remove(id),
        onSuccess: () => { toast.success('Schedule deleted.'); qc.invalidateQueries(['report-schedules']) },
        onError: e => toast.error(e.response?.data?.message || 'Delete failed'),
    })

    const toggleActiveMutation = useMutation({
        mutationFn: ({ id, isActive }) => reportSchedulesAPI.update(id, { isActive }),
        onSuccess: (_, vars) => { toast.success(vars.isActive ? 'Activated' : 'Paused'); qc.invalidateQueries(['report-schedules']) },
        onError: e => toast.error(e.response?.data?.message || 'Update failed'),
    })

    const sendNowMutation = useMutation({
        mutationFn: (id) => reportSchedulesAPI.sendNow(id),
        onSuccess: r => { toast.success(r.data.data?.message || 'Report sent!'); qc.invalidateQueries(['report-schedules']) },
        onError: e => toast.error(e.response?.data?.message || 'Send failed'),
    })

    const openCreate = () => { setEditTarget(null); setFormOpen(true) }
    const openEdit = (s) => { setEditTarget(s); setFormOpen(true) }

    const updGlobal = (k, v) => {
        const next = { ...globalSettings, [k]: v }
        setGlobalSettings(next)
        globalSaveMutation.mutate(next)
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Intelligence & Reporting</h2>
                    <p className="text-sm text-slate-500 font-medium">Configure institutional data delivery and automated indexing</p>
                </div>
                <button onClick={openCreate}
                    className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
                    <Plus size={16} /> New Schedule
                </button>
            </div>

            {/* Global Defaults — 12 col grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Left: Report Defaults */}
                <div className="lg:col-span-8">
                    <SectionCard title="Report Defaults" subtitle="Standardized format and global delivery controls" icon={Settings2}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Format Picker */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Standard Export Format</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'PDF', icon: '📄', desc: 'Portable' },
                                        { id: 'Excel', icon: '📊', desc: 'Spreadsheet' },
                                        { id: 'CSV', icon: '📃', desc: 'Raw Data' },
                                    ].map(fmt => (
                                        <button
                                            key={fmt.id}
                                            onClick={() => updGlobal('defaultFormat', fmt.id)}
                                            className={`flex flex-col items-center justify-center gap-1 py-4 rounded-2xl border-2 text-center transition-all ${globalSettings.defaultFormat === fmt.id
                                                ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-500/10'
                                                : 'border-slate-100 dark:border-white/5 bg-slate-50/30 hover:border-slate-200'
                                                }`}
                                        >
                                            <span className="text-xl leading-none">{fmt.icon}</span>
                                            <span className={`text-xs font-black ${globalSettings.defaultFormat === fmt.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>{fmt.id}</span>
                                            <span className="text-[9px] text-slate-400">{fmt.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Global Auto-Send toggle */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Global Auto-Send</label>
                                    <button
                                        onClick={() => updGlobal('autoSchedule', !globalSettings.autoSchedule)}
                                        className={`w-full py-4 px-5 rounded-2xl border-2 flex items-center justify-between transition-all ${globalSettings.autoSchedule
                                            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-500/10'
                                            : 'border-slate-100 dark:border-white/5 bg-slate-50/30 hover:border-slate-200'
                                            }`}
                                    >
                                        <div className="text-left">
                                            <p className={`text-xs font-black uppercase tracking-widest ${globalSettings.autoSchedule ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                                {globalSettings.autoSchedule ? 'Globally Active' : 'Globally Paused'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{globalSettings.autoSchedule ? 'All active schedules will send automatically' : 'Click to enable auto-delivery'}</p>
                                        </div>
                                        <div className={`relative w-11 h-6 rounded-full flex items-center px-1 flex-shrink-0 transition-all ${globalSettings.autoSchedule ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${globalSettings.autoSchedule ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </div>
                                    </button>
                                </div>
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-start gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                                        Global Auto-Send controls whether all pipelines will deliver on their configured schedule. Individual schedules can further be toggled independently.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right: System Status panel */}
                <div className="lg:col-span-4 p-6 rounded-[2rem] bg-slate-900 border border-white/5 shadow-2xl flex flex-col justify-between min-h-[200px]">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                            <Mail size={20} />
                        </div>
                        <p className="text-xs font-black uppercase tracking-widest text-white">System Status</p>
                    </div>
                    <div>
                        <p className="text-[40px] font-black text-white leading-none tracking-tighter mb-1">
                            {schedules.filter(s => s.isActive).length}
                        </p>
                        <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">Active Pipelines</p>
                        <div className="h-px bg-white/10 mb-4" />
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            Delivering scheduled intelligence to <span className="text-white font-black">{schedules.reduce((acc, s) => acc + (s.recipientIds?.length || 0), 0)}</span> stakeholders across {schedules.length} pipeline(s).
                        </p>
                    </div>
                    <div className={`mt-4 px-3 py-2 rounded-xl flex items-center gap-2 ${globalSettings.autoSchedule ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
                        <div className={`w-2 h-2 rounded-full ${globalSettings.autoSchedule ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                        <p className={`text-[9px] font-black uppercase tracking-widest ${globalSettings.autoSchedule ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {globalSettings.autoSchedule ? 'Auto-Send On' : 'Auto-Send Off'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Schedule List */}
            <SectionCard title="Automation Pipelines" subtitle="Granular delivery schedules and specialized report triggers" icon={Clock}>
                {isLoading ? (
                    <div className="flex justify-center py-16"><Spinner size="lg" /></div>
                ) : !schedules.length ? (
                    <div className="py-24 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <Plus size={32} />
                        </div>
                        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No Pipelines Configured</p>
                        <p className="text-sm text-slate-500 mt-2 font-medium">Create a schedule to automate your institutional reporting.</p>
                        <button onClick={openCreate} className="mt-6 px-6 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all">
                            Initialize Pipeline
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {schedules.map(s => {
                            const c = STATUS_COLORS[s.reportType] || STATUS_COLORS.all
                            return (
                                <div key={s._id} className={`group relative rounded-[1.5rem] border transition-all ${s.isActive ? 'border-indigo-200/50 dark:border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-500/5' : 'border-slate-100 dark:border-white/5 grayscale'}`}>
                                    <div className="p-5 flex flex-wrap items-center gap-5">
                                        {/* Status indicator */}
                                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.isActive ? c.dot : 'bg-slate-300'} ${s.isActive ? 'shadow-md' : ''}`} />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-1.5">
                                                <p className="text-sm font-black text-slate-800 dark:text-white tracking-tight">{s.name}</p>
                                                <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${c.badge}`}>
                                                    {s.reportType}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400">
                                                <span className="flex items-center gap-1.5 capitalize"><Clock size={11} className="text-indigo-400" /> {s.frequency} @ {s.scheduledTime}</span>
                                                <span className="flex items-center gap-1.5"><Mail size={11} className="text-indigo-400" /> {s.recipientIds?.length || 0} Recipients</span>
                                                {s.lastSentAt && <span>Last: {new Date(s.lastSentAt).toLocaleDateString('en-IN')}</span>}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => sendNowMutation.mutate(s._id)}
                                                disabled={sendNowMutation.isPending}
                                                className="h-9 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 disabled:opacity-60"
                                            >
                                                {sendNowMutation.isPending ? <Spinner size="sm" color="white" /> : <Send size={13} />} Send Now
                                            </button>
                                            <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-white/5 p-1 rounded-xl">
                                                <button onClick={() => setHistoryTarget({ id: s._id, name: s.name })} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-white/10 transition-all" title="View History"><Clock size={15} /></button>
                                                <button onClick={() => openEdit(s)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-white/10 transition-all" title="Edit Schedule"><Settings2 size={15} /></button>
                                                <button onClick={() => { if (confirm(`Purge "${s.name}"?`)) deleteMutation.mutate(s._id) }} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-white/10 transition-all" title="Delete"><X size={15} /></button>
                                            </div>
                                            <button
                                                onClick={() => toggleActiveMutation.mutate({ id: s._id, isActive: !s.isActive })}
                                                className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 flex items-center px-1 ${s.isActive ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${s.isActive ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </SectionCard>

            {/* Form Modal */}
            <ScheduleFormModal open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null) }} initial={editTarget} employees={employees} allProjects={allProjects} />

            {/* History Modal */}
            {historyTarget && <HistoryModal scheduleId={historyTarget.id} scheduleName={historyTarget.name} onClose={() => setHistoryTarget(null)} />}
        </div>
    )
}
