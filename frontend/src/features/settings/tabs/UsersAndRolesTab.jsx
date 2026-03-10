import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Users, Save, Plus, Trash2 } from 'lucide-react'
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

const PERMISSION_KEYS = {
    approveTimesheets: 'Approve Timesheets',
    viewReports: 'View Reports',
    manageProjects: 'Manage Projects',
    manageEmployees: 'Manage Employees',
    manageSettings: 'Manage Settings'
}

export default function UsersAndRolesTab() {
    const qc = useQueryClient()
    const [roles, setRoles] = React.useState([])

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    React.useEffect(() => {
        if (data?.roles?.length > 0) {
            setRoles(data.roles)
        } else {
            // Fallback for demo
            setRoles([
                { name: 'Admin', isSystem: true, permissions: { approveTimesheets: true, viewReports: true, manageProjects: true, manageEmployees: true, manageSettings: true } },
                { name: 'Manager', isSystem: true, permissions: { approveTimesheets: true, viewReports: true, manageProjects: true, manageEmployees: false, manageSettings: false } },
                { name: 'HR', isSystem: true, permissions: { approveTimesheets: false, viewReports: true, manageProjects: false, manageEmployees: true, manageSettings: false } },
                { name: 'Finance', isSystem: true, permissions: { approveTimesheets: false, viewReports: true, manageProjects: false, manageEmployees: false, manageSettings: false } },
                { name: 'Employee', isSystem: true, permissions: { approveTimesheets: false, viewReports: false, manageProjects: false, manageEmployees: false, manageSettings: false } }
            ])
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ roles }),
        onSuccess: () => {
            toast.success('Roles & Permissions saved!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const handleAddRole = () => {
        setRoles([...roles, {
            name: 'New Custom Role',
            isSystem: false,
            permissions: {
                approveTimesheets: false,
                viewReports: false,
                manageProjects: false,
                manageEmployees: false,
                manageSettings: false
            }
        }])
        toast.success('New custom role added! Don\'t forget to sync changes.')
    }

    const handleUpdateRoleName = (index, newName) => {
        const newRoles = [...roles]
        newRoles[index].name = newName
        setRoles(newRoles)
    }

    const handleTogglePermission = (roleIndex, key) => {
        const newRoles = [...roles]
        const role = { ...newRoles[roleIndex] }
        role.permissions = { ...role.permissions, [key]: !role.permissions[key] }
        newRoles[roleIndex] = role
        setRoles(newRoles)
    }

    const handleDeleteRole = (index) => {
        if (roles[index].isSystem) {
            toast.error('System roles cannot be deleted')
            return
        }
        setRoles(roles.filter((_, i) => i !== index))
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    return (
        <div className="space-y-8 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Access Control</h2>
                    <p className="text-sm text-slate-500 font-medium">Define roles and granular permission profiles</p>
                </div>
                <button
                    onClick={handleAddRole}
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-black transition-all border border-indigo-200/50 dark:border-indigo-500/20 shadow-sm"
                >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                    CREATE CUSTOM ROLE
                </button>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <SectionCard title="Permission Profiles" subtitle="Configure system and custom roles" icon={Shield}>
                    <div className="space-y-6">
                        {roles.map((role, idx) => (
                            <div key={idx} className="p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 hover:border-indigo-500/30 transition-colors group">
                                <div className="flex flex-col lg:flex-row gap-8 items-start">
                                    <div className="w-full lg:w-1/4">
                                        <div className="flex items-center gap-3 mb-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role Title</label>
                                            {role.isSystem && (
                                                <span className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 text-[8px] font-black uppercase">Core System</span>
                                            )}
                                        </div>
                                        <input
                                            value={role.name}
                                            onChange={(e) => handleUpdateRoleName(idx, e.target.value)}
                                            disabled={role.isSystem}
                                            className="input w-full font-black text-slate-800 dark:text-white bg-transparent border-none p-0 focus:ring-0 text-lg disabled:opacity-100"
                                            placeholder="Enter role name..."
                                        />
                                        <div className="mt-4 flex gap-2">
                                            {!role.isSystem && (
                                                <button
                                                    onClick={() => handleDeleteRole(idx)}
                                                    className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all border border-transparent hover:border-rose-100 dark:hover:border-rose-500/20"
                                                    title="Delete Role"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Granular Permissions</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                            {Object.entries(PERMISSION_KEYS).map(([key, label]) => {
                                                const isActive = role.permissions[key]
                                                return (
                                                    <button
                                                        key={key}
                                                        disabled={role.name === 'Admin'} // Admin has all fixed
                                                        onClick={() => handleTogglePermission(idx, key)}
                                                        className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left ${isActive
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                                            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:border-indigo-500/50'
                                                            } ${role.name === 'Admin' ? 'opacity-80' : ''}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isActive ? 'bg-white border-white' : 'border-slate-300 dark:border-slate-700'}`}>
                                                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>}
                                                        </div>
                                                        <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>

            <div className="sticky bottom-4 z-20 flex justify-end">
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-70"
                >
                    {saveMutation.isPending ? <Spinner size="sm" color="white" /> : <Save size={18} />}
                    Sync Permissions
                </button>
            </div>
        </div>
    )
}
