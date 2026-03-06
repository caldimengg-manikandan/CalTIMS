import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Users, Save, Plus } from 'lucide-react'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { SectionCard, Chip, AddChipInput } from '../components/SharedUI'

const DEFAULT_PERMISSIONS = [
    'Approve Timesheets',
    'View Reports',
    'Manage Projects',
    'Manage Employees',
    'Manage Settings',
    'View Audit Logs',
    'Manage Leaves'
]

export default function UsersAndRolesTab() {
    const qc = useQueryClient()
    const [roles, setRoles] = useState([])
    const [defaultRole, setDefaultRole] = useState('Employee')

    const { data, isLoading } = useQuery({
        queryKey: ['settings', 'overall'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    useEffect(() => {
        if (data?.roles) {
            // If DB has custom roles, load them. Else load default placeholder.
            if (data.roles.customRoles && data.roles.customRoles.length > 0) {
                setRoles(data.roles.customRoles)
            } else {
                setRoles([
                    { name: 'Admin', permissions: [...DEFAULT_PERMISSIONS] },
                    { name: 'Manager', permissions: ['Approve Timesheets', 'View Reports', 'Manage Projects'] },
                    { name: 'Employee', permissions: [] }
                ])
            }
            setDefaultRole(data.roles.defaultRole || 'Employee')
        } else if (data && !data.roles) {
            setRoles([
                { name: 'Admin', permissions: [...DEFAULT_PERMISSIONS] },
                { name: 'Manager', permissions: ['Approve Timesheets', 'View Reports', 'Manage Projects'] },
                { name: 'Employee', permissions: [] }
            ])
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({
            roles: {
                customRoles: roles,
                defaultRole: defaultRole
            }
        }),
        onSuccess: () => {
            toast.success('Roles & Permissions saved!')
            qc.invalidateQueries(['settings', 'overall'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const handleAddRole = () => {
        setRoles([...roles, { name: 'New Role', permissions: [] }])
    }

    const handleUpdateRoleName = (index, newName) => {
        const newRoles = [...roles]
        newRoles[index].name = newName
        setRoles(newRoles)
    }

    const handleTogglePermission = (roleIndex, permission) => {
        const newRoles = [...roles]
        const role = newRoles[roleIndex]
        if (role.permissions.includes(permission)) {
            role.permissions = role.permissions.filter(p => p !== permission)
        } else {
            role.permissions.push(permission)
        }
        setRoles(newRoles)
    }

    const handleDeleteRole = (index) => {
        const roleToDelete = roles[index]
        if (roleToDelete.name === 'Admin' || roleToDelete.name === 'Employee') {
            toast.error('Cannot delete system default roles (Admin/Employee)')
            return
        }
        const newRoles = roles.filter((_, i) => i !== index)
        setRoles(newRoles)
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Users & Roles</h2>
                    <p className="text-sm text-slate-400">Manage permission profiles for your organization users</p>
                </div>
                <button
                    onClick={handleAddRole}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white text-sm font-bold transition-all"
                >
                    <Plus size={15} /> Add Custom Role
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <SectionCard title="Role Configurations" subtitle="Define what each role can access and perform" icon={Shield}>
                    <div className="space-y-6">
                        {roles.map((role, idx) => (
                            <div key={idx} className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 relative">
                                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                    <div className="w-full sm:w-1/3">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">Role Name</label>
                                        <input
                                            value={role.name}
                                            onChange={(e) => handleUpdateRoleName(idx, e.target.value)}
                                            disabled={role.name === 'Admin' || role.name === 'Employee'}
                                            className="input w-full font-bold"
                                        />
                                        {(role.name === 'Admin' || role.name === 'Employee') &&
                                            <p className="text-[10px] text-slate-400 mt-1">System default</p>
                                        }
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Permissions</label>
                                        <div className="flex flex-wrap gap-2">
                                            {DEFAULT_PERMISSIONS.map(perm => {
                                                const isChecked = role.permissions.includes(perm)
                                                const isSystemDefault = role.name === 'Admin' || role.name === 'Employee'
                                                return (
                                                    <button
                                                        key={perm}
                                                        disabled={isSystemDefault}
                                                        onClick={() => handleTogglePermission(idx, perm)}
                                                        className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all flex items-center gap-1.5 ${isChecked
                                                                ? 'bg-primary text-white border-primary'
                                                                : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-white/10 hover:border-primary/40'
                                                            } ${isSystemDefault ? 'opacity-70 cursor-not-allowed' : ''}`}
                                                    >
                                                        {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                                                        {perm}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                                {!(role.name === 'Admin' || role.name === 'Employee') && (
                                    <button
                                        onClick={() => handleDeleteRole(idx)}
                                        className="absolute top-4 right-4 text-xs font-semibold text-rose-500 hover:text-rose-600 border border-rose-200 bg-rose-50 px-2 py-1 rounded-md"
                                    >
                                        Delete
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Default Assignment" subtitle="Role assigned to newly invited or registered users" icon={Users}>
                    <div className="max-w-md">
                        <label className="label">Default Role</label>
                        <select
                            className="input w-full"
                            value={defaultRole}
                            onChange={(e) => setDefaultRole(e.target.value)}
                        >
                            {roles.map(r => (
                                <option key={r.name} value={r.name}>{r.name}</option>
                            ))}
                        </select>
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
