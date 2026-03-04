import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskAPI, projectAPI } from '@/services/endpoints'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import {
    Search, Plus, SlidersHorizontal, Download, Eye,
    X, Save, ChevronDown, Pencil, Trash2, ListTodo,
    FolderOpen, Type, AlignLeft, Info, BarChart
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const INITIAL_FORM = {
    name: '',
    description: '',
    projectId: '',
    status: 'pending',
    priority: 'medium',
    isActive: true,
    onlyProjectTasks: false
}

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

/* ─── Task Form ─────────────────────────────────────────────── */
function TaskForm({ formId, formData, onChange, onSubmit, projects = [] }) {
    return (
        <form id={formId} onSubmit={onSubmit} className="space-y-6 px-6 py-5 overflow-y-auto flex-1">
            <div className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Type size={14} className="text-slate-400" /> Task Name *
                    </label>
                    <input
                        name="name"
                        required
                        className="input"
                        placeholder="e.g. Design System Implementation"
                        value={formData.name}
                        onChange={onChange}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <FolderOpen size={14} className="text-slate-400" /> Project *
                    </label>
                    <select
                        name="projectId"
                        required
                        className="input"
                        value={formData.projectId}
                        onChange={onChange}
                    >
                        <option value="">Select Project</option>
                        {projects.map(p => (
                            <option key={p._id} value={p._id}>{p.name} ({p.code})</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <BarChart size={14} className="text-slate-400" /> Status
                        </label>
                        <select
                            name="status"
                            className="input"
                            value={formData.status}
                            onChange={onChange}
                        >
                            <option value="pending">Pending</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="on-hold">On Hold</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Info size={14} className="text-slate-400" /> Priority
                        </label>
                        <select
                            name="priority"
                            className="input"
                            value={formData.priority}
                            onChange={onChange}
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <AlignLeft size={14} className="text-slate-400" /> Description
                    </label>
                    <textarea
                        name="description"
                        className="input min-h-[100px] py-2"
                        placeholder="Detailed task description..."
                        value={formData.description}
                        onChange={onChange}
                    />
                </div>

                <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            name="onlyProjectTasks"
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                            checked={formData.onlyProjectTasks}
                            onChange={(e) => onChange({ target: { name: 'onlyProjectTasks', value: e.target.checked } })}
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">Only show project-specific tasks</span>
                            <span className="text-[10px] text-slate-400 font-normal leading-tight italic">Combined global categories will be hidden.</span>
                        </div>
                    </label>
                </div>
            </div>
        </form>
    )
}

/* ─── Main Page ──────────────────────────────────────────────── */
import PageHeader from '@/components/ui/PageHeader'

export default function TasksPage() {
    const [search, setSearch] = React.useState('')
    const [projectId, setProjectId] = React.useState('')
    const [status, setStatus] = React.useState('')
    const [showFilters, setShowFilters] = React.useState(false)

    // Modal states
    const [addOpen, setAddOpen] = React.useState(false)
    const [bulkAddOpen, setBulkAddOpen] = React.useState(false)
    const [editTask, setEditTask] = React.useState(null)
    const [viewTask, setViewTask] = React.useState(null)
    const [deleteTask, setDeleteTask] = React.useState(null)

    const [addForm, setAddForm] = React.useState(INITIAL_FORM)
    const [editForm, setEditForm] = React.useState(INITIAL_FORM)
    const [bulkNames, setBulkNames] = React.useState('')
    const [bulkProjectId, setBulkProjectId] = React.useState('')
    const [bulkIsolate, setBulkIsolate] = React.useState(false)

    const queryClient = useQueryClient()
    const invalidate = () => queryClient.invalidateQueries(['tasks'])

    const { data: projectsData } = useQuery({
        queryKey: ['projects', { limit: 1000 }],
        queryFn: () => projectAPI.getAll({ limit: 1000 }).then(r => r.data.data),
    })

    const { data, isLoading } = useQuery({
        queryKey: ['tasks', { search, projectId, status }],
        queryFn: () => taskAPI.getAll({ search, projectId, status }).then(r => r.data),
    })

    const activeFilterCount = [projectId, status].filter(Boolean).length

    /* ── Mutations ── */
    const createMut = useMutation({
        mutationFn: async (d) => {
            const res = await taskAPI.create(d);
            // Update project isolation if checked
            if (d.onlyProjectTasks && d.projectId) {
                await projectAPI.update(d.projectId, { onlyProjectTasks: true });
                queryClient.invalidateQueries(['projects']);
            }
            return res;
        },
        onSuccess: () => { toast.success('Task created'); invalidate(); setAddOpen(false); setAddForm(INITIAL_FORM) },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to create')
    })

    const bulkCreateMut = useMutation({
        mutationFn: (tasks) => taskAPI.bulkCreate({ tasks }),
        onSuccess: () => {
            toast.success('Tasks created successfully');
            invalidate();
            setBulkAddOpen(false);
            setBulkNames('');
            setBulkProjectId('');
            setBulkIsolate(false);
        },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to bulk create')
    })

    const editMut = useMutation({
        mutationFn: async ({ id, data }) => {
            const res = await taskAPI.update(id, data);
            // Update project isolation if checked
            if (data.onlyProjectTasks && data.projectId) {
                await projectAPI.update(data.projectId, { onlyProjectTasks: true });
                queryClient.invalidateQueries(['projects']);
            }
            return res;
        },
        onSuccess: () => { toast.success('Task updated'); invalidate(); setEditTask(null) },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to update')
    })

    const deleteMut = useMutation({
        mutationFn: (id) => taskAPI.delete(id),
        onSuccess: () => { toast.success('Task deleted'); invalidate(); setDeleteTask(null) },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete')
    })

    /* ── Form handlers ── */
    const handleAddChange = (e) => setAddForm(p => ({ ...p, [e.target.name]: e.target.value }))
    const handleAddSubmit = (e) => { e.preventDefault(); createMut.mutate(addForm) }

    const handleBulkSubmit = (e) => {
        e.preventDefault()
        if (!bulkProjectId) return toast.error('Please select a project')
        const names = bulkNames.split('\n').map(n => n.trim()).filter(n => !!n)
        if (names.length === 0) return toast.error('Please enter at least one task name')

        const tasks = names.map(name => ({
            name,
            projectId: bulkProjectId,
            status: 'pending',
            priority: 'medium'
        }))

        // Also update the project's isolation setting if requested
        if (bulkIsolate) {
            projectAPI.update(bulkProjectId, { onlyProjectTasks: true })
                .then(() => queryClient.invalidateQueries(['projects']))
                .catch(err => console.error('Failed to update project isolation:', err))
        }

        bulkCreateMut.mutate(tasks)
    }

    const handleEditChange = (e) => setEditForm(p => ({ ...p, [e.target.name]: e.target.value }))
    const handleEditSubmit = (e) => {
        e.preventDefault()
        editMut.mutate({ id: editTask._id, data: editForm })
    }

    const openEdit = (task) => {
        setEditTask(task)
        setEditForm({
            name: task.name || '',
            description: task.description || '',
            projectId: task.projectId?._id || task.projectId || '',
            status: task.status || 'pending',
            priority: task.priority || 'medium',
            isActive: task.isActive !== undefined ? task.isActive : true,
            onlyProjectTasks: task.projectId?.onlyProjectTasks || false
        })
    }

    const handleExportCSV = () => {
        const tasks = data?.data || []
        if (!tasks.length) { toast.error('No data to export'); return }
        const headers = ['Task Name', 'Project', 'Project Code', 'Status', 'Priority', 'Description', 'Created At']
        const rows = tasks.map(t => [
            t.name, t.projectId?.name || '—', t.projectId?.code || '—',
            t.status, t.priority, t.description || '—',
            format(new Date(t.createdAt), 'yyyy-MM-dd HH:mm')
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'tasks.csv'; a.click()
        URL.revokeObjectURL(url)
        toast.success('Exported successfully')
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader title="Tasks" />

            {/* Toolbar */}
            <div className="card p-3">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            className="input pl-9 h-9 text-sm w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Filters */}
                        <div className="relative">
                            <button
                                onClick={() => setShowFilters(p => !p)}
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

                            {showFilters && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowFilters(false)} />
                                    <div className="absolute right-0 top-11 z-30 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 space-y-5 animate-in fade-in zoom-in duration-200">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">Filter By</span>
                                            {activeFilterCount > 0 && (
                                                <button
                                                    onClick={() => { setProjectId(''); setStatus(''); setShowFilters(false) }}
                                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                                                >
                                                    Reset All
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Project</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer font-medium"
                                                    value={projectId}
                                                    onChange={(e) => setProjectId(e.target.value)}
                                                >
                                                    <option value="">All Projects</option>
                                                    {projectsData?.map(p => (
                                                        <option key={p._id} value={p._id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer font-medium"
                                                    value={status}
                                                    onChange={(e) => setStatus(e.target.value)}
                                                >
                                                    <option value="">All Statuses</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="in-progress">In Progress</option>
                                                    <option value="completed">Completed</option>
                                                    <option value="on-hold">On Hold</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => { setProjectId(''); setStatus(''); setShowFilters(false) }}
                                                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                                            >
                                                Clear
                                            </button>
                                            <button
                                                onClick={() => setShowFilters(false)}
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

                        {/* Bulk Add */}
                        <button
                            onClick={() => { setBulkNames(''); setBulkProjectId(''); setBulkAddOpen(true) }}
                            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400 text-sm font-medium transition-colors"
                        >
                            <Plus size={15} /> Bulk Add
                        </button>

                        {/* Add */}
                        <button onClick={() => { setAddForm(INITIAL_FORM); setAddOpen(true) }} className="btn-primary h-9 text-sm px-4">
                            <Plus size={15} /> Add Task
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                {isLoading ? (
                    <div className="py-20 flex justify-center"><Spinner size="lg" /></div>
                ) : (
                    <div className="table-wrapper rounded-none border-0 shadow-none">
                        <table className="w-full">
                            <thead>
                                <tr>
                                    <th>Task Name</th>
                                    <th>Project</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.data?.map((task) => (
                                    <tr key={task._id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white shrink-0">
                                                    <ListTodo size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-800 dark:text-white truncate">{task.name}</p>
                                                    <p className="text-xs text-slate-400 truncate max-w-xs">{task.description || 'No description'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{task.projectId?.name || '—'}</p>
                                            <p className="text-[10px] text-slate-400 font-mono tracking-wider">{task.projectId?.code || '—'}</p>
                                        </td>
                                        <td><StatusBadge status={task.priority} /></td>
                                        <td><StatusBadge status={task.status} /></td>
                                        <td className="text-sm text-slate-500">
                                            {task.createdAt ? format(new Date(task.createdAt), 'MMM d, yyyy') : '—'}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => setViewTask(task)}
                                                    title="View Details"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openEdit(task)}
                                                    title="Edit Task"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTask(task)}
                                                    title="Delete Task"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {data?.data?.length === 0 && (
                            <div className="py-20 text-center">
                                <Search size={40} className="mx-auto text-slate-200 mb-3" />
                                <p className="text-slate-400 uppercase text-xs tracking-widest font-semibold">No tasks found</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ══════════════ ADD MODAL ══════════════ */}
            <Modal open={addOpen} onClose={() => !createMut.isLoading && setAddOpen(false)}>
                <ModalHeader icon={<Plus size={20} />} title="Add New Task" subtitle="Define a new project-specific task" onClose={() => !createMut.isLoading && setAddOpen(false)} />
                <TaskForm formId="add-task-form" formData={addForm} onChange={handleAddChange} onSubmit={handleAddSubmit} projects={projectsData} />
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <button onClick={() => setAddOpen(false)} disabled={createMut.isLoading} className="btn-secondary">Cancel</button>
                    <button type="submit" form="add-task-form" disabled={createMut.isLoading} className="btn-primary min-w-[140px]">
                        {createMut.isLoading ? 'Saving...' : <><Save size={15} /> Save Task</>}
                    </button>
                </div>
            </Modal>

            {/* ══════════════ EDIT MODAL ══════════════ */}
            <Modal open={!!editTask} onClose={() => !editMut.isLoading && setEditTask(null)}>
                <ModalHeader icon={<Pencil size={20} />} title="Edit Task" subtitle={editTask?.name} onClose={() => !editMut.isLoading && setEditTask(null)} />
                <TaskForm formId="edit-task-form" formData={editForm} onChange={handleEditChange} onSubmit={handleEditSubmit} projects={projectsData} />
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <button onClick={() => setEditTask(null)} disabled={editMut.isLoading} className="btn-secondary">Cancel</button>
                    <button type="submit" form="edit-task-form" disabled={editMut.isLoading} className="btn-primary min-w-[140px]">
                        {editMut.isLoading ? 'Saving...' : <><Save size={15} /> Update Task</>}
                    </button>
                </div>
            </Modal>

            {/* ══════════════ VIEW MODAL ══════════════ */}
            <Modal open={!!viewTask} onClose={() => setViewTask(null)} maxWidth="max-w-lg">
                <ModalHeader icon={<Eye size={20} />} title="Task Details" subtitle={viewTask?.projectId?.name} onClose={() => setViewTask(null)} />
                {viewTask && (
                    <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white shrink-0">
                                <ListTodo size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{viewTask.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <StatusBadge status={viewTask.priority} />
                                    <StatusBadge status={viewTask.status} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Project</p>
                                <p className="text-sm font-medium text-slate-700 dark:text-white">{viewTask.projectId?.name} ({viewTask.projectId?.code})</p>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Description</p>
                                <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{viewTask.description || 'No description provided.'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Created At</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-white">{format(new Date(viewTask.createdAt), 'MMM d, yyyy HH:mm')}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Last Updated</p>
                                    <p className="text-sm font-medium text-slate-700 dark:text-white">{format(new Date(viewTask.updatedAt), 'MMM d, yyyy HH:mm')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <button onClick={() => { setViewTask(null); openEdit(viewTask) }} className="btn-secondary flex items-center gap-2">
                        <Pencil size={14} /> Edit
                    </button>
                    <button onClick={() => setViewTask(null)} className="btn-primary">Close</button>
                </div>
            </Modal>

            {/* ══════════════ DELETE CONFIRM MODAL ══════════════ */}
            <Modal open={!!deleteTask} onClose={() => !deleteMut.isLoading && setDeleteTask(null)} maxWidth="max-w-md">
                <div className="px-6 pt-6 pb-2 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                        <Trash2 size={24} className="text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Delete Task?</h2>
                    <p className="text-sm text-slate-500">
                        Are you sure you want to permanently delete <strong className="text-slate-700 dark:text-white">{deleteTask?.name}</strong>?
                    </p>
                </div>
                <div className="flex items-center justify-center gap-3 px-6 py-5">
                    <button onClick={() => setDeleteTask(null)} disabled={deleteMut.isLoading} className="btn-secondary min-w-[120px]">Cancel</button>
                    <button
                        onClick={() => deleteMut.mutate(deleteTask._id)}
                        disabled={deleteMut.isLoading}
                        className="min-w-[120px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                    >
                        {deleteMut.isLoading ? 'Deleting...' : <><Trash2 size={14} /> Delete</>}
                    </button>
                </div>
            </Modal>

            {/* ══ BULK ADD MODAL ══ */}
            <Modal open={bulkAddOpen} onClose={() => !bulkCreateMut.isPending && setBulkAddOpen(false)} maxWidth="max-w-md">
                <ModalHeader icon={<Plus size={20} />} title="Bulk Add Tasks" subtitle="Add multiple tasks at once" onClose={() => setBulkAddOpen(false)} />
                <form onSubmit={handleBulkSubmit} className="p-6 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Project *</label>
                        <select
                            className="input h-10"
                            required
                            value={bulkProjectId}
                            onChange={(e) => setBulkProjectId(e.target.value)}
                        >
                            <option value="">Select Project</option>
                            {projectsData?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Task Names (one per line) *</label>
                        <textarea
                            className="input min-h-[150px] py-3 resize-none"
                            required
                            placeholder="Requirement Analysis&#10;System Design&#10;Frontend Coding&#10;API Integration"
                            value={bulkNames}
                            onChange={(e) => setBulkNames(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400 italic">Enter each task name on a new line.</p>
                    </div>
                    <div className="pt-2">
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                checked={bulkIsolate}
                                onChange={(e) => setBulkIsolate(e.target.checked)}
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">Only show these tasks for this project</span>
                                <span className="text-[10px] text-slate-400 font-normal leading-tight italic">Combined global categories will be hidden.</span>
                            </div>
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 -mx-6 -mb-6 px-6 py-4">
                        <button type="button" onClick={() => setBulkAddOpen(false)} disabled={bulkCreateMut.isPending} className="btn-secondary h-10">Cancel</button>
                        <button type="submit" disabled={bulkCreateMut.isPending} className="btn-primary h-10 min-w-[120px]">
                            {bulkCreateMut.isPending ? 'Adding...' : 'Add Tasks'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}
