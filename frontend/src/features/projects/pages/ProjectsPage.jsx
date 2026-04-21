import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectAPI, userAPI } from '@/services/endpoints'
import StatusBadge from '@/components/ui/StatusBadge'
import TwoStepConfirmModal from '@/components/ui/TwoStepConfirmModal'

import Spinner from '@/components/ui/Spinner'
import {
    Search, Plus, SlidersHorizontal, Download, Eye, X,
    ChevronDown, Pencil, Trash2, FolderOpen, Users,
    Calendar, Building2, TrendingUp, CheckCircle2,
    AlertCircle, Briefcase, UserPlus, Save, ShieldCheck,
    User
} from 'lucide-react'
import { format, isValid } from 'date-fns'
import toast from 'react-hot-toast'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import PageHeader from '@/components/ui/PageHeader'
import Pagination from '@/components/ui/Pagination'

const projectSchema = z.object({
    name: z.string().min(3, 'Project name must be at least 3 characters').max(100, 'Name cannot exceed 100 characters'),
    code: z.string().min(2, 'Project code is required').max(20, 'Code cannot exceed 20 characters'),
    description: z.string().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
    clientName: z.string().max(100, 'Client name cannot exceed 100 characters').optional().nullable(),
    startDate: z.string().min(1, 'Start date is required').regex(/^\d{4}-/, 'Year must be exactly 4 digits'),
    endDate: z.string().min(1, 'End date is required').regex(/^\d{4}-/, 'Year must be exactly 4 digits'),
    status: z.enum(['active', 'completed', 'on-hold']).default('active'),
    managerId: z.string().min(1, 'Project manager is required'),
    allocatedEmployees: z.array(z.object({
        userId: z.string().min(1, 'Member selection is required'),
        role: z.string().max(50, 'Role cannot exceed 50 characters').default('Developer'),
        allocationPercent: z.number().min(0, 'Min 0%').max(100, 'Max 100%').default(100),
        budgetHours: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().min(0).default(0))
    })).min(1, 'At least one team member is required').default([]),
    onlyProjectTasks: z.boolean().default(false),
    budgetHours: z.preprocess((val) => val === '' ? 0 : Number(val), z.number().min(0).default(0))
}).refine((data) => {
    if (!data.endDate || !data.startDate) return true;
    return new Date(data.endDate) >= new Date(data.startDate);
}, {
    message: "End date cannot be before start date",
    path: ["endDate"]
})

const budgetHoursSchema = z.preprocess(
    (val) => val === '' ? 0 : Number(val), 
    z.number({ invalid_type_error: 'Must be a number' })
     .min(0, 'Budget hours cannot be negative')
     .max(99999999, 'Max 8 digits allowed')
     .default(0)
)

/* ─── Shared Modal Shell ─────────────────────────────────────── */
function Modal({ open, onClose, maxWidth = 'max-w-2xl', children }) {
    if (!open) return null
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className={`w-full ${maxWidth} bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
                style={{ maxHeight: '90vh' }}
            >
                {children}
            </div>
        </div>
    )
}

function ModalHeader({ icon, title, subtitle, onClose }) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white shadow-md">
                    {icon}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h2>
                    {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
                </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X size={20} />
            </button>
        </div>
    )
}

/* ─── Project Form Modal (Add / Edit) ────────────────────────── */
function ProjectFormModal({ project, onClose }) {
    const queryClient = useQueryClient()
    const isEdit = !!project

    const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm({
        resolver: zodResolver(projectSchema),
        defaultValues: project ? {
            ...project,
            startDate: project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : '',
            endDate: project.endDate && isValid(new Date(project.endDate)) ? format(new Date(project.endDate), 'yyyy-MM-dd') : '',
            managerId: project.manager?._id || project.manager?.id || project.managerId || '',
            allocatedEmployees: (project.team_members || project.allocatedEmployees)?.map(a => ({
                userId: a.user?._id || a.user?.id || a.userId?._id || a.userId || '',
                role: a.role || 'Developer',
                allocationPercent: a.allocationPercent || 100,
                budgetHours: a.budgetHours || 0
            })) || []
        } : {
            status: 'active',
            allocatedEmployees: [],
            startDate: format(new Date(), 'yyyy-MM-dd'),
            onlyProjectTasks: false
        }
    })

    React.useEffect(() => {
        if (project) {
            reset({
                ...project,
                startDate: project.startDate ? format(new Date(project.startDate), 'yyyy-MM-dd') : '',
                endDate: project.endDate && isValid(new Date(project.endDate)) ? format(new Date(project.endDate), 'yyyy-MM-dd') : '',
                managerId: project.manager?._id || project.manager?.id || project.managerId || '',
                allocatedEmployees: (project.team_members || project.allocatedEmployees)?.map(a => ({
                    userId: a.user?._id || a.user?.id || a.userId?._id || a.userId || '',
                    role: a.role || 'Developer',
                    allocationPercent: a.allocationPercent || 100,
                    budgetHours: a.budgetHours || 0
                })) || []
            })
        }
    }, [project, reset])

    const { fields, append, remove } = useFieldArray({ control, name: 'allocatedEmployees' })

    const { data: managers } = useQuery({
        queryKey: ['users', 'managers'],
        queryFn: () => userAPI.getAll({ role: 'manager' }).then(r => r.data.data || [])
    })
    const { data: allEmployees, isLoading: isAllLoading } = useQuery({
        queryKey: ['users', 'all'],
        queryFn: () => userAPI.getAll({ limit: 5000 }).then(r => r.data.data || [])
    })

    const mutation = useMutation({
        mutationFn: (payload) => isEdit ? projectAPI.update(project._id, payload) : projectAPI.create(payload),
        onSuccess: () => {
            toast.success(`Project ${isEdit ? 'updated' : 'created'} successfully!`)
            queryClient.invalidateQueries({ queryKey: ['projects'] })
            onClose()
        },
        onError: (err) => toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} project`)
    })

    // ─── Real-time calculations ───
    const watchedProjectBudget = watch('budgetHours') || 0
    const watchedAllocations = watch('allocatedEmployees') || []
    const totalAllocated = watchedAllocations.reduce((sum, emp) => sum + (Number(emp.budgetHours) || 0), 0)
    const remainingBudget = watchedProjectBudget - totalAllocated

    const onFormSubmit = (data) => {
        const payload = {
            ...data,
            code: data.code.toUpperCase(),
            allocatedEmployees: (data.allocatedEmployees || [])
                .filter(emp => !!emp.userId)
                .map(emp => ({
                    userId: emp.userId,
                    role: emp.role || 'Developer',
                    allocationPercent: Number(emp.allocationPercent) || 100,
                    budgetHours: Number(emp.budgetHours) || 0
                })),
            endDate: data.endDate && data.endDate !== '' ? data.endDate : null,
            description: data.description || '',
            clientName: data.clientName || ''
        }
        const cleanPayload = Object.fromEntries(
            Object.entries(payload).filter(([key]) => !['_id', '__v', 'createdAt', 'updatedAt', 'id'].includes(key))
        )
        mutation.mutate(cleanPayload)
    }

    const onFormError = (err) => {
        const firstError = Object.values(err)[0]
        toast.error(firstError?.message || 'Please check the form for errors')
    }

    return (
        <Modal open onClose={onClose} maxWidth="max-w-2xl">
            <ModalHeader
                icon={isEdit ? <Pencil size={20} /> : <Plus size={20} />}
                title={isEdit ? 'Edit Project' : 'New Project'}
                subtitle={isEdit ? project.code : 'Create a new project'}
                onClose={onClose}
            />
            <form id="project-form" onSubmit={handleSubmit(onFormSubmit, onFormError)}
                className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Basic Info */}
                <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                        Project Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Name *</label>
                            <input {...register('name')} maxLength={100} className={`input ${errors.name ? 'border-rose-400' : ''}`} placeholder="e.g. Website Redesign" />
                            {errors.name && <p className="text-[10px] text-rose-500">{errors.name.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Code *</label>
                            <input {...register('code')} maxLength={20} className={`input font-mono uppercase ${errors.code ? 'border-rose-400' : ''}`} placeholder="PRJ-001" />
                            {errors.code && <p className="text-[10px] text-rose-500">{errors.code.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Budget Hours</label>
                            <div className="relative">
                                <input 
                                    {...register('budgetHours')} 
                                    type="number" 
                                    step="0.5" 
                                    className={`input ${errors.budgetHours ? 'border-red-500 ring-red-200 animate-shake' : ''}`} 
                                    placeholder="e.g. 100" 
                                    onKeyDown={(e) => {
                                        if (['e', 'E', '+', '-'].includes(e.key)) {
                                            e.preventDefault();
                                            toast.error('Only positive numbers allowed', { duration: 1000, position: 'bottom-center' });
                                        }
                                    }}
                                    onInput={(e) => {
                                        if (e.target.value.length > 8) e.target.value = e.target.value.slice(0, 8);
                                        if (Number(e.target.value) < 0) e.target.value = 0;
                                    }}
                                />
                                {errors.budgetHours && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                                        <AlertCircle size={10} /> {errors.budgetHours.message}
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-1">
                                <p className="text-[10px] text-slate-400 leading-tight">Total hours for the project.</p>
                                <span className={`text-[10px] font-bold ${remainingBudget < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    Rem: {remainingBudget}h
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                            <select {...register('status')} className="input">
                                <option value="active">Active</option>
                                <option value="on-hold">On Hold</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Client Name</label>
                            <input {...register('clientName')} maxLength={100} className="input" placeholder="Optional" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Start Date *</label>
                            <input 
                                {...register('startDate')} 
                                type="date" 
                                max="9999-12-31" 
                                className={`input ${errors.startDate ? 'border-rose-400' : ''}`} 
                                onChange={e => {
                                    let val = e.target.value;
                                    const parts = val.split('-');
                                    if (parts[0] && parts[0].length > 4) {
                                        parts[0] = parts[0].slice(0, 4);
                                        val = parts.join('-');
                                    }
                                    const currentEnd = watch('endDate');
                                    setValue('startDate', val);
                                    if (currentEnd && val > currentEnd) {
                                        setValue('endDate', val);
                                    }
                                }}
                            />
                            {errors.startDate && <p className="text-[10px] text-rose-500">{errors.startDate.message}</p>}
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">End Date *</label>
                            <input 
                                {...register('endDate')} 
                                type="date" 
                                max="9999-12-31" 
                                min={watch('startDate')}
                                onChange={e => {
                                    let val = e.target.value;
                                    const parts = val.split('-');
                                    if (parts[0] && parts[0].length > 4) {
                                        parts[0] = parts[0].slice(0, 4);
                                        val = parts.join('-');
                                    }
                                    setValue('endDate', val);
                                }}
                                className={`input ${errors.endDate ? 'border-rose-400' : ''}`} 
                            />
                            {errors.endDate && <p className="text-[10px] text-rose-500">{errors.endDate.message}</p>}
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project Manager *</label>
                            <select {...register('managerId')} className={`input ${errors.managerId ? 'border-rose-400' : ''}`}>
                                <option value="">Select a manager...</option>
                                {managers?.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                            </select>
                            {errors.managerId && <p className="text-[10px] text-rose-500">{errors.managerId.message}</p>}
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                            <textarea {...register('description')} maxLength={500} rows={2} className="input resize-none" placeholder="Optional project details..." />
                        </div>
                    </div>
                </div>

                {/* Team */}
                <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Users size={13} /> Team Assignment *
                        </h3>
                        <button type="button" onClick={() => append({ userId: '', role: 'Developer', allocationPercent: 100, budgetHours: 0 })}
                            className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                            <UserPlus size={13} /> Add Member
                        </button>
                    </div>
                    <div className="space-y-3">
                        {fields.map((field, index) => (
                            <div key={field.id} className="flex gap-3 items-start bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                <div className="flex-1">
                                    <select {...register(`allocatedEmployees.${index}.userId`)} className={`input text-xs h-9 ${errors.allocatedEmployees?.[index]?.userId ? 'border-rose-400' : ''}`}>
                                        <option value="">{isAllLoading ? 'Loading members...' : 'Select Member...'}</option>
                                        {allEmployees?.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                                    </select>
                                    {errors.allocatedEmployees?.[index]?.userId && (
                                        <p className="text-[10px] text-rose-500 mt-0.5">{errors.allocatedEmployees[index].userId.message}</p>
                                    )}
                                </div>
                                <div className="w-32">
                                    <input {...register(`allocatedEmployees.${index}.role`)} maxLength={50} className="input text-xs h-9" placeholder="Dev, PM..." />
                                </div>
                                <div className="w-20">
                                    <input 
                                        type="number" 
                                        {...register(`allocatedEmployees.${index}.allocationPercent`, { valueAsNumber: true })}
                                        className="input text-xs h-9 text-center" 
                                        placeholder="%" 
                                        title="Allocation %" 
                                        onKeyDown={(e) => ['e', 'E', '+', '-', '.'].includes(e.key) && e.preventDefault()}
                                    />
                                </div>
                                <div className="w-20">
                                    <input 
                                        type="number" 
                                        step="0.5" 
                                        {...register(`allocatedEmployees.${index}.budgetHours`, { valueAsNumber: true })}
                                        className={`input text-xs h-9 text-center ${errors.allocatedEmployees?.[index]?.budgetHours ? 'border-red-500' : ''}`} 
                                        placeholder="Hrs" 
                                        title="Budget Hours" 
                                        onKeyDown={(e) => {
                                            if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
                                        }}
                                        onInput={(e) => {
                                            if (e.target.value.length > 8) e.target.value = e.target.value.slice(0, 8);
                                            if (Number(e.target.value) < 0) e.target.value = 0;
                                        }}
                                    />
                                </div>
                                <button type="button" onClick={() => remove(index)}
                                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                                    <Trash2 size={15} />
                                </button>
                            </div>
                        ))}
                        {errors.allocatedEmployees?.message && (
                            <p className="text-[10px] text-rose-500 font-bold mt-2 flex items-center gap-1">
                                <AlertCircle size={10} /> {errors.allocatedEmployees.message}
                            </p>
                        )}
                        {fields.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                No team members assigned yet
                            </p>
                        )}
                    </div>
                </div>
            </form>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button type="button" onClick={onClose} disabled={mutation.isPending} className="btn-secondary">Cancel</button>
                <button type="submit" form="project-form" disabled={mutation.isPending} className="btn-primary min-w-[150px]">
                    {mutation.isPending ? 'Saving...' : <><Save size={15} /> {isEdit ? 'Save Changes' : 'Create Project'}</>}
                </button>
            </div>
        </Modal>
    )
}

/* ─── View Modal ─────────────────────────────────────────────── */
function ProjectViewModal({ project, onClose, onEdit }) {
    const statusColor = { active: 'text-emerald-600', 'on-hold': 'text-amber-600', completed: 'text-blue-600' }
    return (
        <Modal open onClose={onClose} maxWidth="max-w-lg">
            <ModalHeader icon={<Eye size={20} />} title="Project Details" subtitle={project.code} onClose={onClose} />
            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold shrink-0">
                        <FolderOpen size={26} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white">{project.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-bold font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{project.code}</span>
                            <StatusBadge status={project.status} />
                        </div>
                    </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 gap-3">
                    {[
                        { icon: <User size={15} />, label: 'Manager', value: project.manager?.name || project.managerId?.name || '—' },
                        { icon: <Building2 size={15} />, label: 'Client', value: project.clientName || '—' },
                        { icon: <Calendar size={15} />, label: 'Start Date', value: project.startDate ? format(new Date(project.startDate), 'MMM d, yyyy') : '—' },
                        { icon: <Calendar size={15} />, label: 'End Date', value: project.endDate && isValid(new Date(project.endDate)) ? format(new Date(project.endDate), 'MMM d, yyyy') : '—' },
                        { icon: <Briefcase size={15} />, label: 'Budget Hours', value: project.budgetHours ? `${project.budgetHours} h` : 'No limit' },
                        { icon: <Users size={15} />, label: 'Team Size', value: `${(project.team_members || project.allocatedEmployees)?.length || 0} Members` },
                        { icon: <CheckCircle2 size={15} />, label: 'Task Isolation', value: project.onlyProjectTasks ? 'Only project tasks' : 'All categories' },
                    ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <span className="text-slate-400 shrink-0">{icon}</span>
                            <div className="min-w-0">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
                                <p className="text-sm font-medium text-slate-700 dark:text-white truncate">{value}</p>
                            </div>
                        </div>
                    ))}
                    {project.description && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Description</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{project.description}</p>
                        </div>
                    )}
                </div>

                {/* Team */}
                {project.allocatedEmployees?.length > 0 && (
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Team Members</p>
                        <div className="space-y-2">
                            {(project.team_members || project.allocatedEmployees).map((a, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center text-white text-[10px] font-bold">
                                            {(a.user?.name || a.userId?.name || 'M').charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-white">{a.user?.name || a.userId?.name || '—'}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right mr-2">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Budget</p>
                                            <p className="text-xs font-black text-slate-700 dark:text-white">{a.budgetHours || 0}h</p>
                                        </div>
                                        <span className="text-xs text-slate-400">{a.role}</span>
                                        <span className="text-[10px] font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 px-1.5 py-0.5 rounded">{a.allocationPercent}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <button onClick={() => { onClose(); onEdit(project) }} className="btn-secondary flex items-center gap-2">
                    <Pencil size={14} /> Edit
                </button>
                <button onClick={onClose} className="btn-primary">Close</button>
            </div>
        </Modal>
    )
}


/* ─── Main Page ──────────────────────────────────────────────── */
export default function ProjectsPage() {
    const [search, setSearch] = React.useState('')
    const [status, setStatus] = React.useState('')
    const [selectedProjId, setSelectedProjId] = React.useState('')
    const [managerId, setManagerId] = React.useState('')
    const [showFilters, setShowFilters] = React.useState(false)
    const [tempFilters, setTempFilters] = React.useState({ status: '', selectedProjId: '', managerId: '' })

    // Pagination state
    const [page, setPage] = React.useState(1)
    const [limit, setLimit] = React.useState(10)

    // Modal states
    const [addOpen, setAddOpen] = React.useState(false)
    const [editProject, setEditProject] = React.useState(null)
    const [viewProject, setViewProject] = React.useState(null)
    const [deleteProject, setDeleteProject] = React.useState(null)
    const [teamProject, setTeamProject] = React.useState(null)   // for Team Members popup

    const queryClient = useQueryClient()
    const invalidate = () => queryClient.invalidateQueries(['projects'])

    // Fetch all projects for the ID dropdown
    const { data: allProjectsList } = useQuery({
        queryKey: ['all-projects-list'],
        queryFn: () => projectAPI.getAll({ limit: 5000 }).then(r => r.data.data || []),
    })

    const { data: managersList } = useQuery({
        queryKey: ['users', 'managers-filter'],
        queryFn: () => userAPI.getAll({ role: 'manager' }).then(r => r.data.data || [])
    })

    const effectiveSearch = search.trim().length >= 2 ? search.trim() : ''

    // Main filtered query
    const { data, isLoading } = useQuery({
        queryKey: ['projects', { search: effectiveSearch, status, selectedProjId, managerId, page, limit }],
        queryFn: () => projectAPI.getAll({ search: effectiveSearch, status, code: selectedProjId, managerId, page, limit }).then(r => r.data),
    })

    // Reset page when filters change
    React.useEffect(() => {
        setPage(1)
    }, [effectiveSearch, status, selectedProjId, managerId])

    const projects = data?.data || []
    const activeFilterCount = [status, selectedProjId, managerId].filter(Boolean).length

    // Stats derived from current data (full list)
    const stats = React.useMemo(() => {
        const all = allProjectsList || []
        return {
            total: all.length,
            active: all.filter(p => p.status === 'active').length,
            onHold: all.filter(p => p.status === 'on-hold').length,
            completed: all.filter(p => p.status === 'completed').length,
        }
    }, [allProjectsList])

    /* ── Delete mutation ── */
    const deleteMut = useMutation({
        mutationFn: (id) => projectAPI.delete(id),
        onSuccess: () => { toast.success('Project deleted'); invalidate(); setDeleteProject(null) },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete')
    })

    const clearFilters = () => { setStatus(''); setSelectedProjId(''); setManagerId('') }

    /* ── CSV Export ── */
    const handleExportCSV = () => {
        if (!projects.length) { toast.error('No data to export'); return }
        const headers = ['Name', 'Code', 'Status', 'Manager', 'Client', 'Start Date', 'End Date', 'Team Members']
        const rows = projects.map(p => [
            p.name, p.code, p.status,
            p.manager?.name || p.managerId?.name || '',
            p.clientName || '',
            p.startDate ? format(new Date(p.startDate), 'yyyy-MM-dd') : '',
            p.endDate && isValid(new Date(p.endDate)) ? format(new Date(p.endDate), 'yyyy-MM-dd') : '',
            (p.team_members || p.allocatedEmployees)?.map(a => a.user?.name || a.userId?.name || '').filter(Boolean).join(', ')
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'projects.csv'; a.click()
        URL.revokeObjectURL(url)
        toast.success('Exported successfully')
    }

    return (
        <div className="h-[calc(100vh-160px)] flex flex-col gap-4 animate-fade-in overflow-hidden">
            <PageHeader title="Projects" />

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total', val: stats.total, icon: Briefcase, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-900/20' },
                    { label: 'Active', val: stats.active, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
                    { label: 'On Hold', val: stats.onHold, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
                    { label: 'Completed', val: stats.completed, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
                ].map((st) => (
                    <div key={st.label} className="card p-4 flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl ${st.bg} ${st.color}`}><st.icon size={18} /></div>
                        <div>
                            <p className="text-xl font-bold text-slate-800 dark:text-white leading-none mb-0.5">{st.val}</p>
                            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{st.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="card p-3">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
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
                        {/* Filters */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (!showFilters) setTempFilters({ status, selectedProjId, managerId })
                                    setShowFilters(p => !p)
                                }}
                                className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-sm font-medium transition-colors ${showFilters || activeFilterCount > 0
                                    ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
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

                            {/* Quick clear */}
                            {activeFilterCount > 0 && !showFilters && (
                                <button
                                    onClick={() => {
                                        clearFilters()
                                        setTempFilters({ status: '', selectedProjId: '', managerId: '' })
                                    }}
                                    className="px-2 h-9 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                                    title="Clear all filters"
                                >
                                    <X size={14} /> Clear
                                </button>
                            )}

                            {/* Filter Dropdown */}
                            {showFilters && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowFilters(false)} />
                                    <div className="absolute right-0 top-11 z-30 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 space-y-5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.1em]">Filter By</span>
                                            {activeFilterCount > 0 && (
                                                <button onClick={() => {
                                                    const reset = { status: '', selectedProjId: '', managerId: '' }
                                                    setTempFilters(reset)
                                                    setStatus('')
                                                    setSelectedProjId('')
                                                    setManagerId('')
                                                }}
                                                    className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-wider">
                                                    Reset All
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {/* Project ID dropdown */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Project Code</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                    value={tempFilters.selectedProjId}
                                                    onChange={e => setTempFilters(p => ({ ...p, selectedProjId: e.target.value }))}
                                                >
                                                    <option value="">All Projects</option>
                                                    {allProjectsList?.map(p => (
                                                        <option key={p.id} value={p.code}>{p.id} — {p.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Department = Manager filter */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Manager</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                    value={tempFilters.managerId}
                                                    onChange={e => setTempFilters(p => ({ ...p, managerId: e.target.value }))}
                                                >
                                                    <option value="">All Managers</option>
                                                    {managersList?.map(m => (
                                                        <option key={m._id} value={m._id}>{m.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Status */}
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 cursor-pointer font-medium"
                                                    value={tempFilters.status}
                                                    onChange={e => setTempFilters(p => ({ ...p, status: e.target.value }))}
                                                >
                                                    <option value="">All Status</option>
                                                    <option value="active">Active</option>
                                                    <option value="on-hold">On Hold</option>
                                                    <option value="completed">Completed</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => setTempFilters({ status: '', selectedProjId: '', managerId: '' })}
                                                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setStatus(tempFilters.status)
                                                    setSelectedProjId(tempFilters.selectedProjId)
                                                    setManagerId(tempFilters.managerId)
                                                    setShowFilters(false)
                                                }}
                                                className="flex-[2] h-11 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary-200 dark:shadow-none transition-all active:scale-[0.98]"
                                            >
                                                Apply Filters
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Export */}
                        <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <Download size={15} /> Export CSV
                        </button>

                        {/* New Project */}
                        <button onClick={() => setAddOpen(true)} className="btn-primary h-9 text-sm px-4">
                            <Plus size={15} /> New Project
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card p-0 flex flex-col overflow-hidden min-h-0">
                {isLoading ? (
                    <div className="py-20 flex justify-center"><Spinner size="lg" /></div>
                ) : (
                    <div className="table-wrapper max-h-[800px] lg:max-h-[calc(100vh-450px)] overflow-y-auto rounded-none border-0 shadow-none">
                        <table className="w-full">
                            <thead className="sticky top-0 z-20 bg-white dark:bg-black border-b border-slate-100 dark:border-white/10">
                                <tr>
                                    <th>Project</th>
                                    <th>Manager</th>
                                    <th>Team</th>
                                    <th>Dates</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((proj) => (
                                    <tr key={proj._id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white shrink-0">
                                                    <FolderOpen size={16} />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-white">{proj.name}</p>
                                                    {/* <p className="text-[10px] text-slate-400 font-mono font-bold">{proj.code}</p> */}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <p className="text-sm text-slate-600 dark:text-white">{proj.manager?.name || proj.managerId?.name || '—'}</p>
                                            {proj.clientName && <p className="text-[10px] text-slate-400">{proj.clientName}</p>}
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => setTeamProject(proj)}
                                                className="flex items-center gap-2 group/team cursor-pointer hover:opacity-80 transition-opacity"
                                                title="View team members"
                                            >
                                                <div className="flex -space-x-1.5">
                                                    {(proj.team_members || proj.allocatedEmployees)?.slice(0, 3).map((a, i) => (
                                                        <div key={i} title={a.user?.name || a.userId?.name}
                                                            className="w-6 h-6 rounded-full gradient-primary border-2 border-white dark:border-slate-900 flex items-center justify-center text-white text-[9px] font-bold">
                                                            {(a.user?.name || a.userId?.name || 'M').charAt(0)}
                                                        </div>
                                                    ))}
                                                    {(proj.team_members || proj.allocatedEmployees || []).length > 3 && (
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-slate-500 text-[9px] font-bold">
                                                            +{(proj.team_members || proj.allocatedEmployees).length - 3}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-xs text-slate-400 group-hover/team:text-primary-600 transition-colors font-medium">
                                                    {(proj.team_members || proj.allocatedEmployees)?.length || 0}
                                                </span>
                                            </button>
                                        </td>
                                        <td>
                                            <p className="text-xs text-slate-500">
                                                {proj.startDate ? format(new Date(proj.startDate), 'MMM d, yyyy') : '—'}
                                            </p>
                                            {proj.endDate && isValid(new Date(proj.endDate)) && (
                                                <p className="text-[10px] text-slate-400">→ {format(new Date(proj.endDate), 'MMM d, yyyy')}</p>
                                            )}
                                        </td>
                                        <td><StatusBadge status={proj.status} /></td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => setViewProject(proj)} title="View Details"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                                                    <Eye size={16} />
                                                </button>
                                                <button onClick={() => setEditProject(proj)} title="Edit Project"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                                    <Pencil size={16} />
                                                </button>
                                                <button onClick={() => setDeleteProject(proj)} title="Delete Project"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {projects.length === 0 && (
                            <div className="py-20 text-center">
                                <FolderOpen size={40} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-slate-400 uppercase text-xs tracking-widest font-semibold">No projects found</p>
                            </div>
                        )}
                    </div>
                )}
                {!isLoading && projects.length > 0 && (
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

            {/* ══ ADD MODAL ══ */}
            {addOpen && <ProjectFormModal onClose={() => setAddOpen(false)} />}

            {/* ══ TEAM MEMBERS MODAL ══ */}
            <Modal open={!!teamProject} onClose={() => setTeamProject(null)} maxWidth="max-w-md">
                <ModalHeader
                    icon={<Users size={20} />}
                    title="Team Members"
                    subtitle={teamProject ? `${teamProject.name} • ${(teamProject.team_members || teamProject.allocatedEmployees)?.length || 0} members` : ''}
                    onClose={() => setTeamProject(null)}
                />
                <div className="px-6 py-5 overflow-y-auto flex-1" style={{ maxHeight: '60vh' }}>
                    {(teamProject?.team_members || teamProject?.allocatedEmployees)?.length > 0 ? (
                        <div className="space-y-3">
                            {(teamProject.team_members || teamProject.allocatedEmployees).map((a, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                                            {(a.user?.name || a.userId?.name || 'M').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                                {a.user?.name || a.userId?.name || '—'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-mono">
                                                {a.user?.employeeId || a.userId?.employeeId || a.user?.email || a.userId?.email || ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-right mr-3">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Allocated</p>
                                            <p className="text-xs font-black text-primary-600 dark:text-primary-400">{a.budgetHours || 0}h</p>
                                        </div>
                                        <span className="text-xs text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-lg font-medium">
                                            {a.role}
                                        </span>
                                        <span className="text-xs font-bold bg-primary-50 dark:bg-primary-900/20 text-primary-600 px-2.5 py-1 rounded-lg">
                                            {a.allocationPercent}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center">
                            <Users size={36} className="mx-auto text-slate-200 mb-3" />
                            <p className="text-slate-400 text-sm font-medium">No team members assigned yet</p>
                            <button
                                onClick={() => { setTeamProject(null); setEditProject(teamProject) }}
                                className="mt-3 text-xs text-primary-600 hover:underline font-semibold"
                            >
                                + Add Members
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <button
                        onClick={() => { setTeamProject(null); setEditProject(teamProject) }}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Pencil size={14} /> Edit Team
                    </button>
                    <button onClick={() => setTeamProject(null)} className="btn-primary">Close</button>
                </div>
            </Modal>

            {/* ══ EDIT MODAL ══ */}
            {editProject && <ProjectFormModal project={editProject} onClose={() => setEditProject(null)} />}

            {/* ══ VIEW MODAL ══ */}
            {viewProject && (
                <ProjectViewModal
                    project={viewProject}
                    onClose={() => setViewProject(null)}
                    onEdit={(p) => setEditProject(p)}
                />
            )}

            {/* ══ DELETE CONFIRM MODAL ══ */}
            <TwoStepConfirmModal
                isOpen={!!deleteProject}
                onClose={() => setDeleteProject(null)}
                onConfirm={() => deleteMut.mutate(deleteProject._id)}
                title="Are you sure you want to delete this?"
                message={(
                    <span>
                        Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{deleteProject?.name}</strong>? 
                        You won't be able to see this data again and this action <strong>cannot be undone</strong>.
                    </span>
                )}
                confirmText="Yes, Delete Project"
                isLoading={deleteMut.isPending}
                danger
            />
        </div>
    )
}
