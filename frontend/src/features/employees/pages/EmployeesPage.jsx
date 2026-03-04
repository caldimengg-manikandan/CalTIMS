import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userAPI } from '@/services/endpoints'
import StatusBadge from '@/components/ui/StatusBadge'
import Spinner from '@/components/ui/Spinner'
import PageHeader from '@/components/ui/PageHeader'
import {
    Search, UserPlus, SlidersHorizontal, Download, Eye, UserX, UserCheck,
    X, Save, ChevronDown, Pencil, Trash2, Mail, Phone, Building2,
    Briefcase, CalendarDays, ShieldCheck
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const INITIAL_FORM = {
    name: '', email: '', password: '', role: 'employee',
    department: '', designation: '', phone: '',
    joinDate: new Date().toISOString().split('T')[0]
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

/* ─── Employee Form (shared by Add & Edit) ───────────────────── */
function EmployeeForm({ formId, formData, onChange, onSubmit, isEdit = false }) {
    return (
        <form id={formId} onSubmit={onSubmit} className="space-y-6 px-6 py-5 overflow-y-auto flex-1">
            <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                    Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name *</label>
                        <input name="name" required className="input" placeholder="John Doe" value={formData.name} onChange={onChange} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address *</label>
                        <input name="email" type="email" required className="input" placeholder="john@example.com" value={formData.email} onChange={onChange} />
                    </div>
                    {!isEdit && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password *</label>
                            <input name="password" type="password" required className="input" placeholder="Min 8 characters" value={formData.password} onChange={onChange} />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Role *</label>
                        <select name="role" className="input" value={formData.role} onChange={onChange}>
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-slate-700">
                    Workplace Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                        <input name="department" className="input" placeholder="Engineering, Design, etc." value={formData.department} onChange={onChange} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Designation</label>
                        <input name="designation" className="input" placeholder="Software Engineer" value={formData.designation} onChange={onChange} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                        <input name="phone" className="input" placeholder="+1 234 567 890" value={formData.phone} onChange={onChange} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Joining Date</label>
                        <input name="joinDate" type="date" className="input" value={formData.joinDate} onChange={onChange} />
                    </div>
                </div>
            </div>
        </form>
    )
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function EmployeesPage() {
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')
    const [status, setStatus] = useState('')
    const [department, setDepartment] = useState('')
    const [selectedEmpId, setSelectedEmpId] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    // Modal states
    const [addOpen, setAddOpen] = useState(false)
    const [editEmp, setEditEmp] = useState(null)      // employee object for edit
    const [viewEmp, setViewEmp] = useState(null)      // employee object for view
    const [deleteEmp, setDeleteEmp] = useState(null)  // employee object for delete confirm

    const [addForm, setAddForm] = useState(INITIAL_FORM)
    const [editForm, setEditForm] = useState(INITIAL_FORM)

    const queryClient = useQueryClient()
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] })

    const { data: depts } = useQuery({
        queryKey: ['departments'],
        queryFn: () => userAPI.getDepartments().then(r => r.data.data),
    })

    const { data: allEmployees } = useQuery({
        queryKey: ['all-employees-list'],
        queryFn: () => userAPI.getAll({ limit: 1000 }).then(r => r.data.data),
    })

    const { data, isLoading } = useQuery({
        queryKey: ['users', { search, role, status, department, employeeId: selectedEmpId }],
        queryFn: () => userAPI.getAll({ search, role, status, department, employeeId: selectedEmpId }).then(r => r.data),
    })

    const activeFilterCount = [role, status, department, selectedEmpId].filter(Boolean).length

    /* ── Mutations ── */
    const createMut = useMutation({
        mutationFn: (d) => userAPI.create(d),
        onSuccess: () => { toast.success('Employee created'); invalidate(); setAddOpen(false); setAddForm(INITIAL_FORM) },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to create')
    })

    const editMut = useMutation({
        mutationFn: ({ id, data }) => userAPI.update(id, data),
        onSuccess: () => { toast.success('Employee updated'); invalidate(); setEditEmp(null) },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to update')
    })

    const deleteMut = useMutation({
        mutationFn: (id) => userAPI.delete(id),
        onSuccess: () => { toast.success('Employee deleted'); invalidate(); setDeleteEmp(null) },
        onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete')
    })

    const toggleStatusMut = useMutation({
        mutationFn: ({ id, isActive }) => isActive ? userAPI.deactivate(id) : userAPI.activate(id),
        onSuccess: (_, vars) => {
            toast.success(!vars.isActive ? 'Employee activated' : 'Employee deactivated')
            invalidate()
        },
        onError: (e) => toast.error(e.response?.data?.message || 'Action failed')
    })

    /* ── Form handlers ── */
    const handleAddChange = (e) => setAddForm(p => ({ ...p, [e.target.name]: e.target.value }))
    const handleAddSubmit = (e) => { e.preventDefault(); createMut.mutate(addForm) }

    const handleEditChange = (e) => setEditForm(p => ({ ...p, [e.target.name]: e.target.value }))
    const handleEditSubmit = (e) => {
        e.preventDefault()
        editMut.mutate({ id: editEmp._id, data: editForm })
    }

    const openEdit = (emp) => {
        setEditEmp(emp)
        setEditForm({
            name: emp.name || '',
            email: emp.email || '',
            password: '',
            role: emp.role || 'employee',
            department: emp.department || '',
            designation: emp.designation || '',
            phone: emp.phone || '',
            joinDate: emp.joinDate ? emp.joinDate.split('T')[0] : new Date().toISOString().split('T')[0]
        })
    }

    /* ── CSV Export ── */
    const handleExportCSV = () => {
        const employees = data?.data || []
        if (!employees.length) { toast.error('No data to export'); return }
        const headers = ['Name', 'Email', 'Employee ID', 'Department', 'Designation', 'Role', 'Phone', 'Joining Date', 'Status']
        const rows = employees.map(e => [
            e.name, e.email, e.employeeId, e.department || '', e.designation || '',
            e.role, e.phone || '',
            e.joinDate ? format(new Date(e.joinDate), 'yyyy-MM-dd') : '',
            e.isActive ? 'Active' : 'Inactive'
        ])
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'employees.csv'; a.click()
        URL.revokeObjectURL(url)
        toast.success('Exported successfully')
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <PageHeader title="Employees" />

            {/* Toolbar */}
            <div className="card p-3">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search name, email, phone, department..."
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

                            {/* Quick Clear in Toolbar */}
                            {activeFilterCount > 0 && !showFilters && (
                                <button
                                    onClick={() => { setRole(''); setStatus(''); setDepartment(''); setSelectedEmpId('') }}
                                    className="px-2 h-9 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1"
                                    title="Clear all filters"
                                >
                                    <X size={14} /> Clear
                                </button>
                            )}

                            {showFilters && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowFilters(false)} />
                                    <div className="absolute right-0 top-11 z-30 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 space-y-5 animate-in fade-in zoom-in duration-200">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">Filter By</span>
                                            {activeFilterCount > 0 && (
                                                <button
                                                    onClick={() => { setRole(''); setStatus(''); setDepartment(''); setSelectedEmpId(''); setShowFilters(false) }}
                                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
                                                >
                                                    Reset All
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Employee ID</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer font-medium"
                                                    value={selectedEmpId}
                                                    onChange={(e) => setSelectedEmpId(e.target.value)}
                                                >
                                                    <option value="">Select Employee ID</option>
                                                    {allEmployees?.map(emp => (
                                                        <option key={emp.employeeId} value={emp.employeeId}>
                                                            {emp.employeeId} - {emp.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Department</label>
                                                <select
                                                    className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer font-medium"
                                                    value={department}
                                                    onChange={(e) => setDepartment(e.target.value)}
                                                >
                                                    <option value="">All Departments</option>
                                                    {depts?.map(d => (
                                                        <option key={d} value={d}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Role</label>
                                                    <select
                                                        className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer font-medium"
                                                        value={role}
                                                        onChange={(e) => setRole(e.target.value)}
                                                    >
                                                        <option value="">All Roles</option>
                                                        <option value="admin">Admin</option>
                                                        <option value="manager">Manager</option>
                                                        <option value="employee">Employee</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</label>
                                                    <select
                                                        className="input text-sm h-11 bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer font-medium"
                                                        value={status}
                                                        onChange={(e) => setStatus(e.target.value)}
                                                    >
                                                        <option value="">All Status</option>
                                                        <option value="active">Active</option>
                                                        <option value="inactive">Inactive</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                onClick={() => { setRole(''); setStatus(''); setDepartment(''); setSelectedEmpId(''); setShowFilters(false) }}
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

                        {/* Add */}
                        <button onClick={() => { setAddForm(INITIAL_FORM); setAddOpen(true) }} className="btn-primary h-9 text-sm px-4">
                            <UserPlus size={15} /> Add Employee
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
                                    <th>Employee</th>
                                    <th>Department</th>
                                    <th>Role</th>
                                    <th>Joined</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data?.data?.map((emp) => (
                                    <tr key={emp._id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-800 dark:text-white">{emp.name}</p>
                                                    <p className="text-xs text-slate-400 font-mono">{emp.employeeId}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <p className="text-sm text-slate-600 dark:text-white">{emp.department || '—'}</p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{emp.designation || '—'}</p>
                                        </td>
                                        <td><StatusBadge status={emp.role} /></td>
                                        <td className="text-sm text-slate-500">
                                            {emp.joinDate ? format(new Date(emp.joinDate), 'MMM d, yyyy') : '—'}
                                        </td>
                                        <td><StatusBadge status={emp.isActive ? 'active' : 'draft'} /></td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => setViewEmp(emp)}
                                                    title="View Details"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => openEdit(emp)}
                                                    title="Edit Employee"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={() => toggleStatusMut.mutate({ id: emp._id, isActive: emp.isActive })}
                                                    title={emp.isActive ? 'Deactivate' : 'Activate'}
                                                    disabled={toggleStatusMut.isPending}
                                                    className={`p-1.5 rounded-lg transition-colors ${emp.isActive
                                                        ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                                        : 'text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                                        }`}
                                                >
                                                    {emp.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                                                </button>
                                                <button
                                                    onClick={() => setDeleteEmp(emp)}
                                                    title="Delete Employee"
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
                                <p className="text-slate-400 uppercase text-xs tracking-widest font-semibold">No employees found</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <Modal open={addOpen} onClose={() => !createMut.isPending && setAddOpen(false)}>
                <ModalHeader icon={<UserPlus size={20} />} title="Add New Employee" subtitle="Create a new user account" onClose={() => setAddOpen(false)} />
                <EmployeeForm formId="add-form" formData={addForm} onChange={handleAddChange} onSubmit={handleAddSubmit} />
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button onClick={() => setAddOpen(false)} className="btn-secondary">Cancel</button>
                    <button type="submit" form="add-form" disabled={createMut.isPending} className="btn-primary min-w-[140px]">
                        {createMut.isPending ? 'Saving...' : <><Save size={15} /> Save Employee</>}
                    </button>
                </div>
            </Modal>

            <Modal open={!!editEmp} onClose={() => !editMut.isPending && setEditEmp(null)}>
                <ModalHeader icon={<Pencil size={20} />} title="Edit Employee" subtitle={editEmp?.name} onClose={() => setEditEmp(null)} />
                <EmployeeForm formId="edit-form" formData={editForm} onChange={handleEditChange} onSubmit={handleEditSubmit} isEdit />
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button onClick={() => setEditEmp(null)} className="btn-secondary">Cancel</button>
                    <button type="submit" form="edit-form" disabled={editMut.isPending} className="btn-primary min-w-[140px]">
                        {editMut.isPending ? 'Saving...' : <><Save size={15} /> Update Employee</>}
                    </button>
                </div>
            </Modal>

            <Modal open={!!viewEmp} onClose={() => setViewEmp(null)} maxWidth="max-w-lg">
                <ModalHeader icon={<Eye size={20} />} title="Employee Details" subtitle={viewEmp?.employeeId} onClose={() => setViewEmp(null)} />
                {viewEmp && (
                    <div className="px-6 py-5 space-y-5">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white text-2xl font-bold shrink-0">
                                {viewEmp.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">{viewEmp.name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <StatusBadge status={viewEmp.role} />
                                    <StatusBadge status={viewEmp.isActive ? 'active' : 'draft'} />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { icon: <Mail size={15} />, label: 'Email', value: viewEmp.email },
                                { icon: <Phone size={15} />, label: 'Phone', value: viewEmp.phone || '—' },
                                { icon: <Building2 size={15} />, label: 'Department', value: viewEmp.department || '—' },
                                { icon: <Briefcase size={15} />, label: 'Designation', value: viewEmp.designation || '—' },
                                { icon: <CalendarDays size={15} />, label: 'Joining Date', value: viewEmp.joinDate ? format(new Date(viewEmp.joinDate), 'MMM d, yyyy') : '—' },
                                { icon: <ShieldCheck size={15} />, label: 'Employee ID', value: viewEmp.employeeId },
                            ].map(({ icon, label, value }) => (
                                <div key={label} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <span className="text-slate-400 shrink-0">{icon}</span>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
                                        <p className="text-sm font-medium text-slate-700 dark:text-white truncate">{value}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <button onClick={() => { setViewEmp(null); openEdit(viewEmp) }} className="btn-secondary flex items-center gap-2">
                        <Pencil size={14} /> Edit
                    </button>
                    <button onClick={() => setViewEmp(null)} className="btn-primary">Close</button>
                </div>
            </Modal>

            <Modal open={!!deleteEmp} onClose={() => !deleteMut.isPending && setDeleteEmp(null)} maxWidth="max-w-md">
                <div className="px-6 pt-6 pb-2 text-center space-y-3">
                    <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                        <Trash2 size={24} className="text-red-500" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Delete Employee?</h2>
                    <p className="text-sm text-slate-500">
                        Are you sure you want to permanently delete <strong className="text-slate-700 dark:text-white">{deleteEmp?.name}</strong>?
                        This action <span className="text-red-500 font-semibold">cannot be undone</span>.
                    </p>
                </div>
                <div className="flex items-center justify-center gap-3 px-6 py-5">
                    <button onClick={() => setDeleteEmp(null)} disabled={deleteMut.isPending} className="btn-secondary min-w-[120px]">Cancel</button>
                    <button
                        onClick={() => deleteMut.mutate(deleteEmp._id)}
                        disabled={deleteMut.isPending}
                        className="min-w-[120px] bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl font-bold transition-all"
                    >
                        {deleteMut.isPending ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}
