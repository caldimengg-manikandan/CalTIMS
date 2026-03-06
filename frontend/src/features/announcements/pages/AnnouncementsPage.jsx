import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { announcementAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import {
    Megaphone, Plus, X, Pencil, Trash2, Bell, AlertTriangle,
    Info, Users, Calendar, CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'

// ─── Type config ──────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
    info: { label: 'Info', icon: Info, bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-400', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200', dot: 'bg-blue-500' },
    warning: { label: 'Warning', icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200', dot: 'bg-amber-500' },
    urgent: { label: 'Urgent', icon: Bell, bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-400', badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200', dot: 'bg-red-500' },
}

const ROLE_LABELS = { admin: 'Admins', manager: 'Managers', employee: 'Employees' }

// ─── Create / Edit Modal ──────────────────────────────────────────────────────
function AnnouncementModal({ existing, onClose, onSuccess }) {
    const queryClient = useQueryClient()
    const isEdit = !!existing

    const [form, setForm] = React.useState({
        title: existing?.title || '',
        content: existing?.content || '',
        type: existing?.type || 'info',
        targetRoles: existing?.targetRoles || [],
        isActive: existing?.isActive ?? true,
        expiresAt: existing?.expiresAt ? existing.expiresAt.slice(0, 10) : '',
    })

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

    const toggleRole = (role) =>
        set('targetRoles', form.targetRoles.includes(role)
            ? form.targetRoles.filter(r => r !== role)
            : [...form.targetRoles, role])

    const mutation = useMutation({
        mutationFn: (data) => isEdit
            ? announcementAPI.update(existing._id, data)
            : announcementAPI.create(data),
        onSuccess: () => {
            toast.success(isEdit ? 'Announcement updated!' : '📢 Announcement published & notifications sent!')
            queryClient.invalidateQueries({ queryKey: ['announcements-admin'] })
            queryClient.invalidateQueries({ queryKey: ['announcements'] })
            queryClient.invalidateQueries({ queryKey: ['notif-unread-count'] })
            onSuccess?.()
            onClose()
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to save'),
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!form.title.trim()) return toast.error('Title is required')
        if (!form.content.trim()) return toast.error('Content is required')
        if (form.expiresAt && !/^\d{4}-/.test(form.expiresAt)) return toast.error('Expiry year must be exactly 4 digits')
        const payload = {
            ...form,
            expiresAt: form.expiresAt || null,
        }
        mutation.mutate(payload)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-slide-in overflow-hidden">
                {/* Color top strip based on type */}
                <div className={`h-1.5 w-full ${form.type === 'urgent' ? 'bg-red-500' :
                    form.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />

                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/10">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.type === 'urgent' ? 'bg-red-100 text-red-600' :
                            form.type === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                            <Megaphone size={16} />
                        </div>
                        <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                            {isEdit ? 'Edit Announcement' : 'New Announcement'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="label">Title <span className="text-red-400">*</span></label>
                        <input
                            className="input"
                            placeholder="e.g. Office Closure on Public Holiday"
                            value={form.title}
                            onChange={e => set('title', e.target.value)}
                            required
                        />
                    </div>

                    {/* Content */}
                    <div className="space-y-1.5">
                        <label className="label">Content <span className="text-red-400">*</span></label>
                        <textarea
                            className="input resize-none"
                            rows={4}
                            placeholder="Write your announcement details here..."
                            value={form.content}
                            onChange={e => set('content', e.target.value)}
                            required
                        />
                        <p className="text-xs text-slate-400 text-right">{form.content.length}/5000</p>
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                        <label className="label">Type</label>
                        <div className="flex gap-2">
                            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => set('type', key)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${form.type === key
                                        ? `${cfg.badge} ${cfg.border} shadow-sm`
                                        : 'border-slate-200 dark:border-white/20 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                                        }`}
                                >
                                    <cfg.icon size={14} />
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Roles */}
                    <div className="space-y-2">
                        <label className="label flex items-center gap-1.5">
                            <Users size={13} className="text-slate-400" /> Target Audience
                            <span className="text-slate-400 font-normal text-xs">(empty = everyone)</span>
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {['admin', 'manager', 'employee'].map(role => (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => toggleRole(role)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.targetRoles.includes(role)
                                        ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                        : 'bg-white dark:bg-black border-slate-200 dark:border-white/20 text-slate-600 dark:text-slate-300 hover:border-primary-400'
                                        }`}
                                >
                                    {ROLE_LABELS[role]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="space-y-1.5">
                        <label className="label flex items-center gap-1.5">
                            <Calendar size={13} className="text-slate-400" /> Expires On
                            <span className="text-slate-400 font-normal text-xs">(optional)</span>
                        </label>
                        <input
                            type="date"
                            className="input"
                            value={form.expiresAt}
                            onChange={e => set('expiresAt', e.target.value)}
                            min={new Date().toISOString().slice(0, 10)}
                            max="9999-12-31"
                        />
                    </div>

                    {/* Active toggle */}
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={e => set('isActive', e.target.checked)}
                            className="w-4 h-4 rounded accent-primary-600"
                        />
                        <div>
                            <span className="text-sm font-medium text-slate-700 dark:text-white">Active</span>
                            <p className="text-xs text-slate-400">Inactive announcements are hidden from all users</p>
                        </div>
                    </label>

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                        <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1 justify-center">
                            {mutation.isPending ? <Spinner size="sm" /> : isEdit ? <CheckCircle size={16} /> : <Megaphone size={16} />}
                            {mutation.isPending ? 'Saving...' : isEdit ? 'Update' : 'Publish & Notify'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ ann, onClose }) {
    const queryClient = useQueryClient()
    const mutation = useMutation({
        mutationFn: () => announcementAPI.delete(ann._id),
        onSuccess: () => {
            toast.success('Announcement deleted')
            queryClient.invalidateQueries({ queryKey: ['announcements-admin'] })
            queryClient.invalidateQueries({ queryKey: ['announcements'] })
            onClose()
        },
        onError: () => toast.error('Failed to delete'),
    })
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white dark:bg-black rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 animate-slide-in">
                <div className="text-center mb-5">
                    <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto mb-3">
                        <Trash2 size={22} className="text-red-500" />
                    </div>
                    <h3 className="font-semibold text-slate-800 dark:text-white text-lg">Delete Announcement</h3>
                    <p className="text-sm text-slate-400 mt-1">
                        "<span className="font-medium text-slate-600 dark:text-white">{ann.title}</span>" will be permanently removed.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-60 text-sm"
                    >
                        {mutation.isPending ? <Spinner size="sm" /> : <Trash2 size={14} />}
                        {mutation.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnnouncementsPage() {
    const { user } = useAuthStore()
    const [showModal, setShowModal] = React.useState(false)
    const [editTarget, setEditTarget] = React.useState(null)
    const [deleteTarget, setDeleteTarget] = React.useState(null)

    // Pagination state
    const [page, setPage] = React.useState(1)
    const [limit, setLimit] = React.useState(10)

    const { data, isLoading } = useQuery({
        queryKey: ['announcements-admin', page, limit],
        queryFn: () => announcementAPI.getAllAdmin({ page, limit }).then(r => r.data),
    })

    const announcements = data?.data || []

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Modals */}
            {(showModal || editTarget) && (
                <AnnouncementModal
                    existing={editTarget}
                    onClose={() => { setShowModal(false); setEditTarget(null) }}
                />
            )}
            {deleteTarget && (
                <DeleteConfirm ann={deleteTarget} onClose={() => setDeleteTarget(null)} />
            )}

            {/* Header */}
            <PageHeader title="Announcements" subtitle="Create announcements — employees are notified automatically">
                <button
                    onClick={() => { setEditTarget(null); setShowModal(true) }}
                    className="btn-primary"
                >
                    <Plus size={16} /> New Announcement
                </button>
            </PageHeader>


            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : announcements.length === 0 ? (
                <div className="card py-20 text-center">
                    <Megaphone size={44} className="mx-auto text-slate-200 dark:text-slate-700 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No announcements yet</p>
                    <p className="text-sm text-slate-400 mt-1 mb-5">Create one to notify your team instantly</p>
                    <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">
                        <Plus size={15} /> Create First Announcement
                    </button>
                </div>
            ) : (
                <div className="max-h-[calc(100vh-320px)] overflow-y-auto pr-2 space-y-3">
                    {announcements.map((ann) => {
                        const cfg = TYPE_CONFIG[ann.type] || TYPE_CONFIG.info
                        const TypeIcon = cfg.icon
                        const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date()
                        return (
                            <div
                                key={ann._id}
                                className={`card border-l-4 ${cfg.border} ${!ann.isActive || isExpired ? 'opacity-60' : ''} transition-all hover:shadow-md`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
                                        <TypeIcon size={16} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{ann.title}</h3>
                                            {/* Type badge */}
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cfg.badge}`}>
                                                {ann.type}
                                            </span>
                                            {/* Status */}
                                            {!ann.isActive && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                    Inactive
                                                </span>
                                            )}
                                            {isExpired && (
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950 text-rose-500">
                                                    Expired
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">{ann.content}</p>
                                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                                            <span>By <span className="font-medium text-slate-600 dark:text-slate-300">{ann.publishedBy?.name}</span></span>
                                            <span>·</span>
                                            <span>{format(new Date(ann.createdAt), 'MMM d, yyyy')}</span>
                                            {ann.expiresAt && (
                                                <>
                                                    <span>·</span>
                                                    <span className={isExpired ? 'text-rose-400' : ''}>
                                                        Expires {format(new Date(ann.expiresAt), 'MMM d, yyyy')}
                                                    </span>
                                                </>
                                            )}
                                            {ann.targetRoles?.length > 0 && (
                                                <>
                                                    <span>·</span>
                                                    <span>
                                                        → {ann.targetRoles.map(r => ROLE_LABELS[r]).join(', ')}
                                                    </span>
                                                </>
                                            )}
                                            {(!ann.targetRoles || ann.targetRoles.length === 0) && (
                                                <>
                                                    <span>·</span>
                                                    <span>→ Everyone</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => setEditTarget(ann)}
                                            className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950 transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil size={15} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteTarget(ann)}
                                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {!isLoading && announcements.length > 0 && (
                        <Pagination
                            currentPage={data.pagination.page}
                            totalPages={data.pagination.totalPages}
                            totalResults={data.pagination.total}
                            limit={limit}
                            onPageChange={setPage}
                            onLimitChange={(l) => { setLimit(l); setPage(1); }}
                        />
                    )}
                </div>
            )}
        </div>
    )
}
