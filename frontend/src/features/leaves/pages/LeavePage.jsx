import React from 'react'
import { useLocation } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leaveAPI, userAPI, settingsAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import { format, differenceInCalendarDays } from 'date-fns'
import {
    Plus, Calendar, X, Check, Ban,
    AlertCircle, FileText, Search, SlidersHorizontal,
    Download, CheckCircle2, XCircle, Users, ClipboardList,
    ChevronDown, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import Pagination from '@/components/ui/Pagination';
import ProGuard from '@/components/ui/ProGuard';



/* ─── Shared Modal Shell ─────────────────────────────────────── */
function Modal({ open, onClose, maxWidth = 'max-w-md', children }) {
    if (!open) return null
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
                style={{ maxHeight: '90vh' }}>
                {children}
            </div>
        </div>
    )
}

// ─── Edit Eligibility Modal ──────────────────────────────────────────
function EditEligibilityModal({ user, onClose, onSave, isPending }) {
    const { data: tsSettings } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
    })
    const LEAVE_TYPES = tsSettings?.eligibleLeaveTypes || ['annual', 'sick', 'casual']

    const [form, setForm] = React.useState({})

    React.useEffect(() => {
        if (user?.leaveBalance) {
            const initial = {}
            LEAVE_TYPES.forEach(t => {
                initial[t] = user.leaveBalance[t] || 0
            })
            setForm(initial)
        }
    }, [user, LEAVE_TYPES])

    return (
        <Modal open onClose={onClose} maxWidth="max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                        <SlidersHorizontal size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Edit Leave Eligibility</h2>
                        <p className="text-xs text-slate-400">{user?.name} ({user?.employeeId})</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-5">
                {LEAVE_TYPES.map(type => (
                    <div key={type} className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{type} Leave Entitlement (Days)</label>
                        <input
                            type="number"
                            className="input"
                            value={form[type]}
                            onChange={e => setForm(f => ({ ...f, [type]: Number(e.target.value) }))}
                            min="0"
                        />
                    </div>
                ))}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button type="button" onClick={() => onSave(form)} disabled={isPending} className="btn-primary flex-1 justify-center">
                    {isPending ? <Spinner size="sm" /> : <Check size={16} />}
                    {isPending ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </Modal>
    )
}

// ─── Apply Leave Modal ────────────────────────────────────────────────────────
function ApplyLeaveModal({ onClose, balance }) {
    const queryClient = useQueryClient()
    const { user } = useAuthStore()
    const { data: tsSettings } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
    })
    const LEAVE_TYPES = tsSettings?.eligibleLeaveTypes || ['annual', 'sick', 'casual']

    const [form, setForm] = React.useState({
        leaveType: 'annual',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: '',
        reason: '',
    })

    React.useEffect(() => {
        if (LEAVE_TYPES.length > 0 && !LEAVE_TYPES.includes(form.leaveType)) {
            setForm(f => ({ ...f, leaveType: LEAVE_TYPES[0] }))
        }
    }, [LEAVE_TYPES])

    const days = form.startDate && form.endDate
        ? Math.max(1, differenceInCalendarDays(new Date(form.endDate), new Date(form.startDate)) + 1)
        : 0

    const mutation = useMutation({
        mutationFn: (data) => leaveAPI.apply(data),
        onSuccess: () => {
            toast.success('Leave application submitted!')
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
            queryClient.invalidateQueries({ queryKey: ['leaves-admin'] })
            queryClient.invalidateQueries({ queryKey: ['leave-balance', user?.id] })
            queryClient.invalidateQueries({ queryKey: ['calendar-leaves'] })
            onClose()
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to apply'),
    })

    const currentBalance = balance?.[form.leaveType] || 0
    const isLop = form.leaveType === 'lop'
    const hasInsufficientBalance = !isLop && days > currentBalance

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.startDate || !form.endDate) return toast.error('Please select dates')
        if (!/^\d{4}-/.test(form.startDate) || !/^\d{4}-/.test(form.endDate)) return toast.error('Year must be exactly 4 digits')
        if (new Date(form.endDate) < new Date(form.startDate)) return toast.error('End date must be after start date')
        if (hasInsufficientBalance) return toast.error(`Insufficient ${form.leaveType} leave balance`)
        mutation.mutate({ ...form, totalDays: days })
    }

    return (
        <Modal open onClose={onClose} maxWidth="max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                        <ClipboardList size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Apply for Leave</h2>
                        {balance && !isLop && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {form.leaveType} Balance: <span className={hasInsufficientBalance ? 'text-red-500' : 'text-emerald-500'}>{currentBalance} Days</span>
                            </p>
                        )}
                        {isLop && (
                            <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                                Loss of Pay — No balance deducted
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={18} /></button>
            </div>
            <form id="leave-application-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Type</label>
                    <select className="input" value={form.leaveType}
                        onChange={e => setForm(f => ({ ...f, leaveType: e.target.value }))}>
                        {LEAVE_TYPES.map(t => (
                            <option key={t} value={t} className="capitalize">{t.toUpperCase()}</option>
                        ))}
                        <option value="lop">LOP (Loss of Pay)</option>
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Start Date <span className="text-slate-400 font-normal">(*)</span></label>
                        <input type="date" className="input" max="9999-12-31" value={form.startDate}
                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">End Date <span className="text-slate-400 font-normal">(*)</span></label>
                        <input type="date" className="input" max="9999-12-31" value={form.endDate} min={form.startDate}
                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value, isHalfDay: false }))} required />
                    </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                    <input 
                        type="checkbox" 
                        id="isHalfDay"
                        className="w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                        checked={form.isHalfDay}
                        onChange={e => {
                            const checked = e.target.checked;
                            setForm(f => ({ 
                                ...f, 
                                isHalfDay: checked,
                                endDate: checked ? f.startDate : f.endDate 
                            }));
                        }}
                    />
                    <label htmlFor="isHalfDay" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                        Apply as Half Day
                    </label>
                </div>
                {days > 0 && (
                    <div className={`rounded-xl px-4 py-2.5 text-sm font-medium border ${isLop
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-100'
                        : hasInsufficientBalance
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-100'
                            : 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-100'
                        }`}>
                        📅 {days} day{days !== 1 ? 's' : ''} of {isLop ? 'Loss of Pay (LOP)' : `${form.leaveType} leave`}
                        {hasInsufficientBalance && <span className="block text-[10px] uppercase font-black mt-1">Insufficient Balance</span>}
                        {isLop && <span className="block text-[10px] uppercase font-black mt-1">These days will not be paid</span>}
                    </div>
                )}
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Reason <span className="text-slate-400 font-normal">(required)</span></label>
                    <textarea className="input resize-none" rows={3} placeholder="Briefly describe the reason for leave..."
                        value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} required />
                </div>
            </form>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" form="leave-application-form" disabled={mutation.isPending || hasInsufficientBalance} className="btn-primary flex-1 justify-center disabled:opacity-50">
                    {mutation.isPending ? <Spinner size="sm" /> : <Plus size={16} />}
                    {mutation.isPending ? 'Submitting...' : hasInsufficientBalance ? 'Low Balance' : 'Submit Application'}
                </button>
            </div>
        </Modal>
    )
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────
function RejectModal({ leave, onClose, onConfirm, isPending }) {
    const [reason, setReason] = React.useState('')
    return (
        <Modal open onClose={onClose} maxWidth="max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <XCircle size={18} className="text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Reject Leave</h2>
                        <p className="text-xs text-slate-400">{leave?.userId?.name || 'Employee'}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{leave?.userId?.name || 'Employee'}</p>
                    <p className="text-xs text-slate-400 mt-0.5 capitalize">{leave?.leaveType} leave · {leave?.totalDays} day(s)</p>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Rejection Reason <span className="text-slate-400 font-normal">(optional)</span></label>
                    <textarea className="input resize-none" rows={3}
                        placeholder="Provide a reason for rejection..."
                        value={reason} onChange={e => setReason(e.target.value)} autoFocus />
                </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button onClick={onClose} className="btn-secondary flex-1">Keep Leave</button>
                <button
                    onClick={() => onConfirm(reason)}
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                    {isPending ? <Spinner size="sm" /> : <Ban size={16} />}
                    Reject Leave
                </button>
            </div>
        </Modal>
    )
}

// ─── Cancel Modal (for Employee) ──────────────────────────────────────────
function CancelModal({ leave, onClose, onConfirm, isPending }) {
    const [reason, setReason] = React.useState('')
    return (
        <Modal open onClose={onClose} maxWidth="max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Ban size={18} className="text-amber-500" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Cancel Request</h2>
                        <p className="text-xs text-slate-400">{leave?.leaveId}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl">
                    <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                        <span className="font-bold flex items-center gap-1.5 mb-1"><AlertCircle size={14} /> Please Note:</span>
                        Once cancelled, this request will be moved to history and cannot be reopened. You will need to apply again if you change your mind.
                    </p>
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Cancellation Reason <span className="text-slate-400 font-normal">(*)</span></label>
                    <textarea className="input resize-none" rows={3}
                        placeholder="Why are you cancelling this request?..."
                        value={reason} onChange={e => setReason(e.target.value)} autoFocus required />
                </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button onClick={onClose} className="btn-secondary flex-1">Back</button>
                <button
                    onClick={() => onConfirm(reason)}
                    disabled={isPending || !reason.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                    {isPending ? <Spinner size="sm" /> : <Ban size={16} />}
                    Cancel Leave
                </button>
            </div>
        </Modal>
    )
}

// ─── View Details Modal ────────────────────────────────────────────────────────
function LeaveDetailModal({ leave, onClose, onApprove, onReject }) {
    if (!leave) return null
    return (
        <Modal open onClose={onClose} maxWidth="max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                        <Eye size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 dark:text-white">Leave Details</h2>
                        <p className="text-xs text-slate-400 capitalize">{leave.leaveType} leave</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
                {[
                    { label: 'Leave ID', value: leave.leaveId || '—', className: 'font-mono' },
                    { label: 'Employee', value: leave.userId?.name || '—' },
                    { label: 'Employee ID', value: leave.userId?.employeeId || '—' },
                    { label: 'Leave Type', value: leave.leaveType, className: 'capitalize' },
                    { label: 'From', value: format(new Date(leave.startDate), 'MMM d, yyyy') },
                    { label: 'To', value: format(new Date(leave.endDate), 'MMM d, yyyy') },
                    { label: 'Duration', value: `${leave.totalDays} day(s)` },
                    { label: 'Applied On', value: format(new Date(leave.createdAt), 'MMM d, yyyy') },
                ].map(({ label, value, className }) => (
                    <div key={label} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                        <div className="min-w-0">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
                            <p className={`text-sm font-medium text-slate-700 dark:text-white ${className || ''}`}>{value}</p>
                        </div>
                    </div>
                ))}
                {leave.reason && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 font-bold">Application Reason</p>
                        <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium break-words whitespace-pre-wrap">
                            {leave.reason}
                        </div>
                    </div>
                )}
                {leave.rejectionReason && (
                    <div className="p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-2xl border border-rose-100 dark:border-rose-900/20 shadow-sm">
                        <p className="text-[10px] text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2 font-bold">Rejection Reason</p>
                        <div className="text-sm text-rose-700 dark:text-rose-200 leading-relaxed font-medium italic break-words whitespace-pre-wrap">
                            "{leave.rejectionReason}"
                        </div>
                    </div>
                )}
                {leave.cancellationReason && (
                    <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20 shadow-sm">
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-2 font-bold">Cancellation Reason</p>
                        <div className="text-sm text-amber-700 dark:text-amber-200 leading-relaxed font-medium italic break-words whitespace-pre-wrap">
                            "{leave.cancellationReason}"
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <StatusBadge status={leave.status} />
                    {leave.approvedBy?.name && (
                        <span className="text-xs text-slate-400">
                            {leave.status === 'approved' ? 'Approved by' : leave.status === 'rejected' ? 'Rejected by' : 'Processed by'}{' '}
                            <span className="font-semibold text-slate-600 dark:text-slate-300">{leave.approvedBy.name}</span>
                        </span>
                    )}
                </div>
            </div>
            {leave.status === 'pending' && onApprove && onReject && (
                <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <button onClick={() => { onClose(); onReject(leave) }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition-colors">
                        <Ban size={14} /> Reject
                    </button>
                    <button onClick={() => { onApprove(leave._id); onClose() }}
                        className="flex-[2] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors">
                        <Check size={14} /> Approve
                    </button>
                </div>
            )}
        </Modal>
    )
}

// ─── Admin / Manager Leave Management ────────────────────────────────────────
function AdminLeaveView() {
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = React.useState('applications') // 'applications' | 'eligibility'
    const [search, setSearch] = React.useState('')
    const [showFilters, setShowFilters] = React.useState(false)
    const { data: tsSettings } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
    })
    const LEAVE_TYPES = tsSettings?.eligibleLeaveTypes || ['annual', 'sick', 'casual']

    const { data: filterOptions } = useQuery({
        queryKey: ['leaves-filter-options'],
        queryFn: () => leaveAPI.getFilterOptions().then(r => r.data.data),
    })

    const [filters, setFilters] = React.useState({
        status: '',
        leaveType: '',
        userId: '',
        leaveId: '',
    })
    const [tempFilters, setTempFilters] = React.useState(filters)

    const [eligibilityFilters, setEligibilityFilters] = React.useState({
        department: '',
    })
    const [tempEligibilityFilters, setTempEligibilityFilters] = React.useState(eligibilityFilters)
    const [showEligibilityFilters, setShowEligibilityFilters] = React.useState(false)

    const [rejectTarget, setRejectTarget] = React.useState(null)
    const [viewTarget, setViewTarget] = React.useState(null)
    const [editTarget, setEditTarget] = React.useState(null)

    // Pagination state for applications
    const [appPage, setAppPage] = React.useState(1)
    const [appLimit, setAppLimit] = React.useState(10)

    // Pagination state for eligibility
    const [eligPage, setEligPage] = React.useState(1)
    const [eligLimit, setEligLimit] = React.useState(10)

    const effectiveSearch = search.trim().length >= 2 ? search.trim() : ''

    const { data, isLoading } = useQuery({
        queryKey: ['leaves-admin', filters, effectiveSearch, appPage, appLimit],
        queryFn: () => leaveAPI.getAll({ ...filters, isAdminView: true, search: effectiveSearch, page: appPage, limit: appLimit }).then(r => r.data),
    })

    // Reset appPage when filters change
    React.useEffect(() => {
        setAppPage(1)
    }, [filters, effectiveSearch])

    // Reset eligPage when filters change
    React.useEffect(() => {
        setEligPage(1)
    }, [eligibilityFilters, effectiveSearch])

    const { data: employeesData, isLoading: employeesLoading } = useQuery({
        queryKey: ['employees', 'all', eligPage, eligLimit, eligibilityFilters, effectiveSearch],
        queryFn: () => userAPI.getAll({ ...eligibilityFilters, search: effectiveSearch, page: eligPage, limit: eligLimit }).then(r => r.data)
    })

    const employees = employeesData?.data || []

    const leaves = data?.data || []
    const activeFilterCount = Object.values(filters).filter(v => v !== '').length

    const eligibilityDepartments = React.useMemo(() =>
        [...new Set(employees.map(e => e.department).filter(Boolean))].sort(),
        [employees]);

    const filteredEmployees = React.useMemo(() => {
        return employees.filter(e => {
            const matchesSearch = effectiveSearch === '' ||
                e.name?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
                e.employeeId?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
                e.department?.toLowerCase().includes(effectiveSearch.toLowerCase());

            const matchesDept = !eligibilityFilters.department || e.department === eligibilityFilters.department;

            return matchesSearch && matchesDept;
        });
    }, [employees, effectiveSearch, eligibilityFilters]);

    const activeEligibilityFilterCount = Object.values(eligibilityFilters).filter(v => v !== '').length

    // Stats
    const stats = React.useMemo(() => ({
        total: leaves.length,
        pending: leaves.filter(l => l.status === 'pending').length,
        approved: leaves.filter(l => l.status === 'approved').length,
        rejected: leaves.filter(l => l.status === 'rejected').length,
    }), [leaves])

    const approveMutation = useMutation({
        mutationFn: (id) => leaveAPI.approve(id),
        onSuccess: () => {
            toast.success('Leave approved!')
            queryClient.invalidateQueries({ queryKey: ['leaves-admin'] })
            queryClient.invalidateQueries({ queryKey: ['calendar-leaves'] })
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            queryClient.invalidateQueries({ queryKey: ['leave-balance'] })
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to approve'),
    })

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }) => leaveAPI.reject(id, reason),
        onSuccess: () => {
            toast.success('Leave rejected')
            setRejectTarget(null)
            queryClient.invalidateQueries({ queryKey: ['leaves-admin'] })
            queryClient.invalidateQueries({ queryKey: ['calendar-leaves'] })
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to reject'),
    })

    const updateEligibilityMutation = useMutation({
        mutationFn: ({ id, leaveBalance }) => userAPI.update(id, { leaveBalance }),
        onSuccess: () => {
            toast.success('Leave eligibility updated!')
            setEditTarget(null)
            queryClient.invalidateQueries({ queryKey: ['employees'] })
            queryClient.invalidateQueries({ queryKey: ['leave-balance'] })
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update eligibility'),
    })

    // CSV Export
    const handleExportCSV = () => {
        if (!leaves.length) { toast.error('No data to export'); return }
        const headers = ['Leave ID', 'Employee', 'Employee ID', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Applied On', 'Reason']
        const rows = leaves.map(l => [
            l.leaveId || '',
            l.userId?.name || '',
            l.userId?.employeeId || '',
            l.leaveType,
            format(new Date(l.startDate), 'yyyy-MM-dd'),
            format(new Date(l.endDate), 'yyyy-MM-dd'),
            l.totalDays,
            l.status,
            format(new Date(l.createdAt), 'yyyy-MM-dd'),
            l.reason || ''
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'leaves.csv'; a.click()
        URL.revokeObjectURL(url)
        toast.success('Exported successfully')
    }

    const handleExportEligibilityCSV = () => {
        if (!employees.length) { toast.error('No data to export'); return }
        const headers = ['Employee ID', 'Name', 'Department', ...LEAVE_TYPES.map(t => `${t.toUpperCase()} Balance`)]
        const rows = employees.map(e => [
            e.employeeId || '',
            e.name || '',
            e.department || '',
            ...LEAVE_TYPES.map(t => e.leaveBalance?.[t] || 0)
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'leave_eligibility.csv'; a.click()
        URL.revokeObjectURL(url)
        toast.success('Exported successfully')
    }

    return (
        <ProGuard
            title="Leave Management"
            subtitle="Centralized leave management, policy enforcement, and eligibility tracking are Enterprise Pro features."
            icon={ClipboardList}
        >
            <div className="h-[calc(100vh-160px)] flex flex-col gap-4 animate-fade-in overflow-hidden">
                <PageHeader title="Leave Management">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto self-stretch md:self-auto">
                        <button
                            onClick={() => setActiveTab('applications')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'applications' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Applications
                        </button>
                        <button
                            onClick={() => setActiveTab('eligibility')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'eligibility' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Leave Eligibility
                        </button>
                        {/* {stats.pending > 0 && activeTab === 'applications' && (
                        <div className="ml-2 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[10px] uppercase font-black tracking-wider animate-pulse self-center">
                            {stats.pending} New
                        </div>
                    )} */}
                    </div>
                </PageHeader>


                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total', value: stats.total, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                        { label: 'Pending', value: stats.pending, icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                        { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                        { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
                    ].map((st) => (
                        <div key={st.label} className="card p-4 flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${st.bg} ${st.color} shrink-0`}><st.icon size={18} /></div>
                            <div>
                                <p className="text-xl font-bold text-slate-800 dark:text-white leading-none mb-0.5">{st.value}</p>
                                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{st.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {activeTab === 'applications' ? (
                    <>
                        {/* Toolbar */}
                        <div className="card p-3">
                            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                                {/* Search */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search overall (min. 2 characters)..."
                                        className="input pl-9 h-9 text-sm w-full"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {/* Filter Button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => {
                                                if (!showFilters) setTempFilters(filters)
                                                setShowFilters(p => !p)
                                            }}
                                            className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0
                                                ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            <SlidersHorizontal size={15} />
                                            Filters
                                            {activeFilterCount > 0 && (
                                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-[10px] font-bold">
                                                    {activeFilterCount}
                                                </span>
                                            )}
                                            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Filter Dropdown */}
                                        {showFilters && (
                                            <>
                                                <div className="fixed inset-0 z-20" onClick={() => setShowFilters(false)} />
                                                <div className="absolute right-0 top-11 z-30 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 space-y-5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Filter By</span>
                                                        {activeFilterCount > 0 && (
                                                            <button onClick={() => {
                                                                const reset = { status: '', leaveType: '', userId: '', leaveId: '' }
                                                                setTempFilters(reset)
                                                                setFilters(reset)
                                                            }}
                                                                className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider">
                                                                Reset All
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-4 pr-1">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-2">
                                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Leave ID</label>
                                                                <select
                                                                    className="input text-sm h-10"
                                                                    value={tempFilters.leaveId}
                                                                    onChange={e => setTempFilters(f => ({ ...f, leaveId: e.target.value }))}
                                                                >
                                                                    <option value="">All IDs</option>
                                                                    {filterOptions?.leaveIds?.map(id => (
                                                                        <option key={id} value={id}>{id}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Employee</label>
                                                                <select
                                                                    className="input text-sm h-10"
                                                                    value={tempFilters.userId}
                                                                    onChange={e => setTempFilters(f => ({ ...f, userId: e.target.value }))}
                                                                >
                                                                    <option value="">All Employees</option>
                                                                    {employees.map(emp => (
                                                                        <option key={emp._id} value={emp._id}>{emp.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="space-y-2">
                                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
                                                                <select
                                                                    className="input text-sm h-10"
                                                                    value={tempFilters.status}
                                                                    onChange={e => setTempFilters(f => ({ ...f, status: e.target.value }))}
                                                                >
                                                                    <option value="">All Status</option>
                                                                    {filterOptions?.statuses?.map(s => (
                                                                        <option key={s} value={s} className="capitalize">{s}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Type</label>
                                                                <select
                                                                    className="input text-sm h-10"
                                                                    value={tempFilters.leaveType}
                                                                    onChange={e => setTempFilters(f => ({ ...f, leaveType: e.target.value }))}
                                                                >
                                                                    <option value="">All Types</option>
                                                                    {filterOptions?.leaveTypes?.map(t => (
                                                                        <option key={t} value={t} className="capitalize">{t}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 pt-2">
                                                        <button onClick={() => setTempFilters({ status: '', leaveType: '', userId: '', leaveId: '' })} className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold transition-all">Clear</button>
                                                        <button onClick={() => {
                                                            setFilters(tempFilters)
                                                            setShowFilters(false)
                                                        }} className="flex-[2] h-11 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-[0.98]">Apply Filters</button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <Download size={15} /> Export
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="card p-0 flex flex-col overflow-hidden min-h-0">
                            {isLoading ? (
                                <div className="flex justify-center py-16"><Spinner size="lg" /></div>
                            ) : leaves.length === 0 ? (
                                <div className="py-20 text-center">
                                    <Calendar size={40} className="mx-auto text-slate-200 mb-3" />
                                    <p className="text-slate-400 uppercase text-xs tracking-widest font-semibold">No applications found</p>
                                </div>
                            ) : (
                                <div className="table-wrapper lg:max-h-[calc(100vh-480px)] overflow-y-auto rounded-none border-0 shadow-none flex-1">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="sticky top-0 z-20 bg-white dark:bg-black border-b border-slate-100 dark:border-white/10">
                                            <tr>
                                                <th>ID</th>
                                                <th>Employee</th>
                                                <th>Leave Type</th>
                                                <th>From</th>
                                                <th>To</th>
                                                <th>Days</th>
                                                <th>Applied On</th>
                                                <th className="text-center">Status</th>
                                                <th className="text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {leaves.map((leave) => (
                                                <tr key={leave._id}>
                                                    <td>
                                                        <span className="text-[10px] font-mono font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg">{leave.leaveId || '—'}</span>
                                                    </td>
                                                    <td>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-xs shrink-0">{leave.userId?.name?.charAt(0)?.toUpperCase() || '?'}</div>
                                                            <div>
                                                                <p className="font-medium text-slate-800 dark:text-white leading-tight">{leave.userId?.name || '—'}</p>
                                                                {/* <p className="text-[10px] text-slate-400 font-mono mt-0.5">{leave.userId?.employeeId || '—'}</p> */}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="capitalize text-sm font-medium text-slate-700 dark:text-white">{leave.leaveType}</td>
                                                    <td className="text-sm text-slate-600 dark:text-slate-300">{format(new Date(leave.startDate), 'MMM d, yyyy')}</td>
                                                    <td className="text-sm text-slate-600 dark:text-slate-300">{format(new Date(leave.endDate), 'MMM d, yyyy')}</td>
                                                    <td>
                                                        <span className="font-bold text-primary-600 text-sm">{leave.totalDays}</span>
                                                        <span className="text-xs text-slate-400"> d</span>
                                                    </td>
                                                    <td className="text-sm text-slate-500">{format(new Date(leave.createdAt), 'MMM d, yyyy')}</td>
                                                    <td className="text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <StatusBadge status={leave.status} />
                                                            {leave.approvedBy?.name && (
                                                                <span className="text-[10px] text-slate-400">by {leave.approvedBy.name.split(' ')[0]}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="text-right">
                                                        <div className="flex justify-end items-center gap-1">
                                                            <button onClick={() => setViewTarget(leave)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Eye size={16} /></button>
                                                            {leave.status === 'pending' && (
                                                                <>
                                                                    <button onClick={() => setRejectTarget(leave)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><XCircle size={16} /></button>
                                                                    <button onClick={() => approveMutation.mutate(leave._id)} disabled={approveMutation.isPending} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><CheckCircle2 size={16} /></button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {!isLoading && leaves.length > 0 && (
                                <Pagination
                                    currentPage={data.pagination.page}
                                    totalPages={data.pagination.totalPages}
                                    totalResults={data.pagination.total}
                                    limit={appLimit}
                                    onPageChange={setAppPage}
                                    onLimitChange={(l) => { setAppLimit(l); setAppPage(1); }}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        {/* Eligibility Toolbar */}
                        <div className="card p-3">
                            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                                {/* Search */}
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search overall (min. 2 characters)..."
                                        className="input pl-9 h-9 text-sm w-full"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {/* Filter Button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => {
                                                if (!showEligibilityFilters) setTempEligibilityFilters(eligibilityFilters)
                                                setShowEligibilityFilters(p => !p)
                                            }}
                                            className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm font-medium transition-colors ${showEligibilityFilters || activeEligibilityFilterCount > 0
                                                ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        >
                                            <SlidersHorizontal size={15} />
                                            Filters
                                            {activeEligibilityFilterCount > 0 && (
                                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-500 text-white text-[10px] font-bold">
                                                    {activeEligibilityFilterCount}
                                                </span>
                                            )}
                                            <ChevronDown size={14} className={`transition-transform ${showEligibilityFilters ? 'rotate-180' : ''}`} />
                                        </button>

                                        {/* Filter Dropdown */}
                                        {showEligibilityFilters && (
                                            <>
                                                <div className="fixed inset-0 z-20" onClick={() => setShowEligibilityFilters(false)} />
                                                <div className="absolute right-0 top-11 z-30 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 space-y-5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Filter By</span>
                                                        {activeEligibilityFilterCount > 0 && (
                                                            <button onClick={() => {
                                                                const reset = { department: '' }
                                                                setTempEligibilityFilters(reset)
                                                                setEligibilityFilters(reset)
                                                            }}
                                                                className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider">
                                                                Reset All
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Department</label>
                                                            <select
                                                                className="input text-sm h-10"
                                                                value={tempEligibilityFilters.department}
                                                                onChange={e => setTempEligibilityFilters({ department: e.target.value })}
                                                            >
                                                                <option value="">All Departments</option>
                                                                {eligibilityDepartments.map(dept => (
                                                                    <option key={dept} value={dept}>{dept}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 pt-2">
                                                        <button onClick={() => setTempEligibilityFilters({ department: '' })} className="flex-1 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold transition-all">Clear</button>
                                                        <button onClick={() => {
                                                            setEligibilityFilters(tempEligibilityFilters)
                                                            setShowEligibilityFilters(false)
                                                        }} className="flex-[2] h-11 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-[0.98]">Apply Filters</button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <button onClick={handleExportEligibilityCSV} className="flex items-center gap-2 px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                        <Download size={15} /> Export
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="card p-0 flex flex-col overflow-hidden min-h-0">
                            <div className="table-wrapper lg:max-h-[calc(100vh-480px)] overflow-y-auto rounded-none border-0 shadow-none flex-1">
                                <table className="w-full">
                                    <thead className="sticky top-0 z-20 bg-white dark:bg-black border-b border-slate-100 dark:border-white/10">
                                        <tr>
                                            <th>Employee</th>
                                            {LEAVE_TYPES.map(t => (
                                                <th key={t} className="text-center capitalize">{t} Leave</th>
                                            ))}
                                            <th className="text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEmployees.map((emp) => (
                                            <tr key={emp._id}>
                                                <td>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs shrink-0">{emp.name?.charAt(0)?.toUpperCase()}</div>
                                                        <div>
                                                            <p className="font-medium text-slate-800 dark:text-white leading-tight">{emp.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{emp.employeeId} • {emp.department}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                {LEAVE_TYPES.map((t, idx) => (
                                                    <td key={t} className="text-center">
                                                        <div className={`inline-flex items-center justify-center px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-xs font-bold leading-none min-w-[2.5rem]`}>
                                                            {emp.leaveBalance?.[t] || 0}
                                                        </div>
                                                    </td>
                                                ))}
                                                <td className="text-right">
                                                    <button
                                                        onClick={() => setEditTarget(emp)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-primary-600 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-xs font-bold transition-colors"
                                                    >
                                                        Edit Eligibility
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredEmployees.length === 0 && (
                                            <tr>
                                                <td colSpan={LEAVE_TYPES.length + 2} className="py-20 text-center">
                                                    <Search size={40} className="mx-auto text-slate-200 mb-3" />
                                                    <p className="text-slate-400 uppercase text-xs tracking-widest font-semibold">No employees found</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {!employeesLoading && filteredEmployees.length > 0 && (
                                <Pagination
                                    currentPage={employeesData.pagination.page}
                                    totalPages={employeesData.pagination.totalPages}
                                    totalResults={employeesData.pagination.total}
                                    limit={eligLimit}
                                    onPageChange={setEligPage}
                                    onLimitChange={(l) => { setEligLimit(l); setEligPage(1); }}
                                />
                            )}
                        </div>
                    </>
                )
                }

                {/* ══ Modals ══ */}
                {
                    rejectTarget && (
                        <RejectModal
                            leave={rejectTarget}
                            onClose={() => setRejectTarget(null)}
                            onConfirm={(reason) => rejectMutation.mutate({ id: rejectTarget._id, reason })}
                            isPending={rejectMutation.isPending}
                        />
                    )
                }
                <LeaveDetailModal
                    leave={viewTarget}
                    onClose={() => setViewTarget(null)}
                    onApprove={(id) => approveMutation.mutate(id)}
                    onReject={(leave) => setRejectTarget(leave)}
                />
                {
                    editTarget && (
                        <EditEligibilityModal
                            user={editTarget}
                            onClose={() => setEditTarget(null)}
                            onSave={(leaveBalance) => updateEligibilityMutation.mutate({ id: editTarget._id, leaveBalance })}
                            isPending={updateEligibilityMutation.isPending}
                        />
                    )
                }
            </div>
        </ProGuard>
    )
}

// ─── Employee Leave View ──────────────────────────────────────────────────────
function EmployeeLeaveView() {
    const { user } = useAuthStore()
    const queryClient = useQueryClient()
    const [showModal, setShowModal] = React.useState(false)
    const [cancelTarget, setCancelTarget] = React.useState(null)
    const [viewTarget, setViewTarget] = React.useState(null)

    // Pagination state
    const [page, setPage] = React.useState(1)
    const [limit, setLimit] = React.useState(10)

    const { data: tsSettings } = useQuery({
        queryKey: ['settings', 'timesheet'],
        queryFn: () => settingsAPI.getTimesheetSettings().then(r => r.data.data),
    })
    const LEAVE_TYPES = tsSettings?.eligibleLeaveTypes || ['annual', 'sick', 'casual']

    const { data: balance } = useQuery({
        queryKey: ['leave-balance', user?.id],
        queryFn: () => leaveAPI.getBalance(user.id).then(r => r.data.data),
        enabled: !!user?.id,
    })

    const { data: leavesData, isLoading } = useQuery({
        queryKey: ['leaves', page, limit],
        queryFn: () => leaveAPI.getAll({ page, limit }).then(r => r.data),
    })

    const leaves = leavesData?.data || []

    const cancelMutation = useMutation({
        mutationFn: ({ id, reason }) => leaveAPI.cancel(id, reason),
        onSuccess: () => {
            toast.success('Leave cancelled')
            setCancelTarget(null)
            queryClient.invalidateQueries({ queryKey: ['leaves'] })
            queryClient.invalidateQueries({ queryKey: ['leave-balance', user?.id] })
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Cannot cancel leave'),
    })

    const balanceColors = ['text-blue-600', 'text-emerald-600', 'text-amber-600', 'text-purple-600', 'text-rose-600', 'text-primary']

    return (
        <ProGuard
            title="Leave Management"
            subtitle="Automated leave tracking, balance management, and approval workflows are exclusive to the Enterprise Pro tier."
            icon={ClipboardList}
        >
            <div className="h-[calc(100vh-160px)] flex flex-col gap-4 animate-fade-in overflow-hidden">
                {showModal && <ApplyLeaveModal onClose={() => setShowModal(false)} balance={balance} />}

                <PageHeader title="Leave Tracker">
                    <button onClick={() => setShowModal(true)} className="btn-primary">
                        <Plus size={16} /> Apply for Leave
                    </button>
                </PageHeader>

                {/* Leave Balance Cards */}
                {balance && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                        {Object.entries(balance)
                            .filter(([type]) => LEAVE_TYPES.includes(type))
                            .map(([type, days], i) => (
                                <div key={type} className="card text-center hover:shadow-md transition-shadow">
                                    <p className={`text-3xl font-bold ${balanceColors[i % balanceColors.length]}`}>{days}</p>
                                    <p className="text-sm text-slate-500 capitalize mt-1 font-medium">{type}</p>
                                    <p className="text-xs text-slate-400">days left</p>
                                </div>
                            ))}
                        {/* LOP Card — shows days taken (no balance exists for LOP) */}
                        {(() => {
                            const lopDays = (leaves || [])
                                .filter(l => l.leaveType === 'lop' && ['approved', 'pending'].includes(l.status))
                                .reduce((sum, l) => sum + (l.totalDays || 0), 0)
                            return (
                                <div className="card text-center hover:shadow-md transition-shadow border border-red-100 dark:border-red-900/30">
                                    <p className="text-3xl font-bold text-red-500">{lopDays}</p>
                                    <p className="text-sm text-slate-500 mt-1 font-medium">LOP</p>
                                    <p className="text-xs text-slate-400">days taken</p>
                                </div>
                            )
                        })()}
                    </div>
                )}

                {/* Leave Applications Table */}
                <div className="card p-0 flex flex-col overflow-hidden min-h-0">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <h3 className="text-slate-700 dark:text-white flex items-center gap-2">
                            <FileText size={16} className="text-slate-400" />
                            Leave Applications
                        </h3>
                        <span className="text-xs text-slate-400 font-medium">{leaves?.length || 0} record{leaves?.length !== 1 ? 's' : ''}</span>
                    </div>
                    {isLoading ? (
                        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
                    ) : !leaves?.length ? (
                        <div className="py-12 text-center">
                            <Calendar size={36} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-slate-400">No leave applications yet.</p>
                            <button onClick={() => setShowModal(true)} className="btn-primary mt-4 mx-auto">
                                <Plus size={14} /> Apply for Leave
                            </button>
                        </div>
                    ) : (
                        <div className="table-wrapper lg:max-h-[calc(100vh-480px)] overflow-y-auto rounded-none rounded-b-2xl border-0 shadow-none flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-20 bg-white dark:bg-black border-b border-slate-100 dark:border-white/10">
                                    <tr>
                                        <th>ID</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Applied On</th><th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaves.map((leave) => (
                                        <tr key={leave._id}>
                                            <td>
                                                <span className="text-[10px] font-mono font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg">{leave.leaveId || '—'}</span>
                                            </td>
                                            <td className="capitalize font-medium">{leave.leaveType}</td>
                                            <td>{format(new Date(leave.startDate), 'MMM d, yyyy')}</td>
                                            <td>{format(new Date(leave.endDate), 'MMM d, yyyy')}</td>
                                            <td className="font-semibold text-primary-600">{leave.totalDays}</td>
                                            <td className="max-w-[200px] truncate text-slate-400 text-xs">{leave.reason || '—'}</td>
                                            <td>
                                                <div className="flex flex-col gap-1 items-start">
                                                    <StatusBadge status={leave.status} />
                                                    {leave.approvedBy?.name && (
                                                        <span className="text-[10px] text-slate-400">
                                                            {leave.status === 'approved' ? 'Approved by' : 'Rejected by'} {leave.approvedBy.name.split(' ')[0]}
                                                        </span>
                                                    )}
                                                    {leave.status === 'rejected' && leave.rejectionReason && (
                                                        <span className="text-[9px] text-rose-400 italic max-w-[100px] truncate">"{leave.rejectionReason}"</span>
                                                    )}
                                                    {leave.status === 'cancelled' && leave.cancellationReason && (
                                                        <span className="text-[9px] text-orange-400 italic max-w-[100px] truncate">"{leave.cancellationReason}"</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="text-slate-400">{format(new Date(leave.createdAt), 'MMM d, yyyy')}</td>
                                            <td>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => setViewTarget(leave)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"><Eye size={16} /></button>
                                                    {leave.status === 'pending' && (
                                                        <button
                                                            onClick={() => setCancelTarget(leave)}
                                                            disabled={cancelMutation.isPending}
                                                            className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {!isLoading && leaves.length > 0 && (
                        <Pagination
                            currentPage={leavesData.pagination.page}
                            totalPages={leavesData.pagination.totalPages}
                            totalResults={leavesData.pagination.total}
                            limit={limit}
                            onPageChange={setPage}
                            onLimitChange={(l) => { setLimit(l); setPage(1); }}
                        />
                    )}
                </div>
                {cancelTarget && (
                    <CancelModal
                        leave={cancelTarget}
                        onClose={() => setCancelTarget(null)}
                        onConfirm={(reason) => cancelMutation.mutate({ id: cancelTarget._id, reason })}
                        isPending={cancelMutation.isPending}
                    />
                )}
                <LeaveDetailModal
                    leave={viewTarget}
                    onClose={() => setViewTarget(null)}
                />
            </div>
        </ProGuard>
    )
}

// ─── Main Export: Role-based routing ─────────────────────────────────────────
export default function LeavePage() {
    const { user } = useAuthStore()
    const location = useLocation()
    const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager'
    const isManageView = location.pathname.includes('/manage')

    if (isAdminOrManager && isManageView) {
        return <AdminLeaveView />
    }
    return <EmployeeLeaveView />
}
