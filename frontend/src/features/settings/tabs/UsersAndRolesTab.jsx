import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { 
    Shield, Users, Save, Plus, Trash2, Search, 
    ChevronRight, ChevronDown, Check, X, 
    AlertCircle, LayoutDashboard, Database, 
    FileText, Download, UserCheck, Clock, Settings 
} from 'lucide-react'

const MODULE_ICONS = {
    'Payroll': Database,
    'Employees': UserCheck,
    'Timesheets': Clock,
    'Settings': Settings
}

// --- HELPER COMPONENTS ---

const TriStateCheckbox = ({ state, onChange, disabled }) => {
    const inputRef = React.useRef(null)

    React.useEffect(() => {
        if (inputRef.current) {
            inputRef.current.indeterminate = state === 'indeterminate'
        }
    }, [state])

    return (
        <label className={`relative flex items-center justify-center w-5 h-5 rounded-md border-2 transition-all cursor-pointer ${
            state === 'checked' ? 'bg-indigo-600 border-indigo-600' :
            state === 'indeterminate' ? 'bg-indigo-100 border-indigo-300' :
            'bg-white dark:bg-white/5 border-slate-300 dark:border-white/10'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-400'}`}>
            <input
                ref={inputRef}
                type="checkbox"
                className="hidden"
                checked={state === 'checked'}
                onChange={onChange}
                disabled={disabled}
            />
            {state === 'checked' && <Check size={12} className="text-white" strokeWidth={4} />}
            {state === 'indeterminate' && <div className="w-2.5 h-0.5 bg-indigo-600 rounded-full" />}
        </label>
    )
}

const PermissionTreeNode = ({ 
    label, 
    level, 
    children, 
    permissions, 
    path, 
    onToggle, 
    searchQuery,
    isAdmin 
}) => {
    const [isExpanded, setIsExpanded] = useState(true)
    
    // Determine state
    const getLeafNodes = (nodes, currentPath = []) => {
        let leaves = []
        if (Array.isArray(nodes)) {
            nodes.forEach(action => leaves.push([...currentPath, action]))
        } else {
            Object.entries(nodes).forEach(([key, val]) => {
                leaves.push(...getLeafNodes(val, [...currentPath, key]))
            })
        }
        return leaves
    }

    const getAllLeaves = React.useMemo(() => getLeafNodes(children, path), [children, path])
    
    const selectedLeaves = getAllLeaves.filter(p => {
        const [mod, sub, act] = p
        return permissions?.[mod]?.[sub]?.includes(act)
    })

    const state = selectedLeaves.length === 0 ? 'unchecked' :
                  selectedLeaves.length === getAllLeaves.length ? 'checked' : 'indeterminate'

    const handleToggle = () => {
        if (isAdmin) return
        const targetState = state === 'checked' ? false : true
        onToggle(getAllLeaves, targetState)
    }

    // Filter logic
    const matchesSearch = (text) => text.toLowerCase().includes((searchQuery || '').toLowerCase())
    
    const hasVisibleChild = React.useMemo(() => {
        if (!searchQuery) return true
        if (matchesSearch(label)) return true
        
        const checkChildren = (nodes) => {
            if (Array.isArray(nodes)) return nodes.some(a => matchesSearch(a))
            return Object.entries(nodes).some(([k, v]) => matchesSearch(k) || checkChildren(v))
        }
        return checkChildren(children)
    }, [label, children, searchQuery])

    if (!hasVisibleChild) return null

    const isLeaf = Array.isArray(children)
    const Icon = level === 0 ? MODULE_ICONS[label] : null

    // Auto-expand on search
    useEffect(() => {
        if (searchQuery) setIsExpanded(true)
    }, [searchQuery])

    return (
        <div className="select-none">
            <div 
                className={`flex items-center gap-3 py-2 px-3 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-white/5 group ${level === 0 ? 'bg-slate-50 dark:bg-white/5 mb-1' : ''}`}
                style={{ paddingLeft: `${(level * 24) + 12}px` }}
            >
                {!isLeaf ? (
                    <button 
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-all"
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : <div className="w-6" />}
                
                <TriStateCheckbox state={state} onChange={handleToggle} disabled={isAdmin} />
                
                {Icon && <Icon size={16} className="text-indigo-500" strokeWidth={3} />}
                
                <span className={`text-sm font-bold ${level === 0 ? 'text-slate-800 dark:text-slate-100 uppercase tracking-wide' : 'text-slate-600 dark:text-slate-300'}`}>
                    {label}
                </span>
                
                {isLeaf && (
                    <div className="flex flex-wrap gap-2 ml-4">
                        {children.map(action => {
                            const isActive = permissions?.[path[0]]?.[path[1]]?.includes(action)
                            return (
                                <button
                                    key={action}
                                    disabled={isAdmin}
                                    onClick={() => onToggle([[...path, action]], !isActive)}
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase transition-all border ${
                                        isActive
                                        ? 'bg-emerald-500 border-emerald-500 text-white'
                                        : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 hover:border-emerald-300'
                                    } ${isAdmin ? 'opacity-80 grayscale cursor-not-allowed' : ''}`}
                                >
                                    {isActive && <Check size={8} className="inline mr-1" />}
                                    {action}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {!isLeaf && isExpanded && (
                <div className="mt-0.5">
                    {Object.entries(children).map(([key, val]) => (
                        <PermissionTreeNode
                            key={key}
                            label={key}
                            level={level + 1}
                            children={val}
                            permissions={permissions}
                            path={[...path, key]}
                            onToggle={onToggle}
                            searchQuery={searchQuery}
                            isAdmin={isAdmin}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

const RoleTimeline = ({ roleName }) => {
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ['settings', 'permission-audit-logs', { roleName }],
        queryFn: () => settingsAPI.getPermissionAuditLogs({ roleName }).then(r => r.data.data),
        enabled: !!roleName
    })

    if (isLoading) return <div className="flex justify-center py-4"><Spinner size="sm" /></div>
    if (logs.length === 0) return (
        <div className="text-center py-10 border border-dashed border-slate-100 dark:border-white/5 rounded-2xl">
            <Clock size={20} className="mx-auto text-slate-200 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No History Yet</p>
        </div>
    )

    return (
        <div className="space-y-4">
            {logs.slice(0, 5).map((log, i) => (
                <div key={log._id} className="relative pl-6 border-l border-slate-100 dark:border-white/5 pb-4 last:pb-0">
                    <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary ring-4 ring-white dark:ring-slate-900 shadow-sm" />
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase truncate max-w-[80px]">{log.changedByName}</p>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{new Date(log.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                        </div>
                        <p className="text-[10px] font-medium text-slate-500 leading-snug">
                            {log.action === 'CREATE_ROLE' ? 'Created this role' : 
                             log.action === 'DELETE_ROLE' ? 'Deleted this role' :
                             `Updated ${log.changes.length} permission(s)`}
                        </p>
                        {log.changes.length > 0 && log.action === 'UPDATE_PERMISSION' && (
                            <div className="mt-2 space-y-1">
                                {log.changes.slice(0, 2).map((c, j) => (
                                    <div key={j} className="flex items-center gap-1">
                                        <div className={`w-1 h-1 rounded-full ${c.current ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        <p className="text-[8px] font-bold text-slate-400 truncate">
                                            {c.submodule}: {c.action} {c.current ? 'ON' : 'OFF'}
                                        </p>
                                    </div>
                                ))}
                                {log.changes.length > 2 && <p className="text-[8px] font-black text-primary uppercase ml-2">+{log.changes.length - 2} more</p>}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}

const PERMISSION_STRUCTURE = {
    "Payroll": {
        "Dashboard": ["view"],
        "Payroll Engine": ["view", "run", "submit", "approve", "disburse"],
        "Execution Ledger": ["view"],
        "Payslip Generation": ["view", "generate"],
        "Bank Export": ["view", "export"],
        "Payroll Reports": ["view"]
    },
    "Employees": {
        "Employee List": ["view", "create", "edit", "delete"],
        "Management": ["view", "edit"]
    },
    "Timesheets": {
        "Dashboard": ["view"],
        "Entry": ["view", "create", "edit"],
        "History": ["view"],
        "Management": ["view", "approve", "reject", "lock"]
    },
    "Leave Management": {
        "Leave Tracker": ["view"],
        "Leave Requests": ["view", "create", "approve", "reject"],
        "Leave Policies": ["view", "edit"]
    },
    "My Payslip": {
        "Payslip View": ["view", "download"]
    },
    "Projects": {
        "Project List": ["view", "create", "edit", "delete"]
    },
    "Tasks": {
        "Task Management": ["view", "create", "edit", "delete"]
    },
    "Reports": {
        "Reports Dashboard": ["view", "export"]
    },
    "Announcements": {
        "Announcements": ["view", "create", "edit"]
    },
    "Support": {
        "Help & Support": ["view"]
    },
    "Settings": {
        "General": ["view", "edit"],
        "Users & Roles": ["view", "create", "edit", "delete"],
        "Audit Logs": ["view"]
    }
}

const ROLE_TEMPLATES = {
    'Admin': {
        name: 'Full Administrator',
        description: 'Complete system-wide control (Unrestricted)',
        fullAccess: true
    },
    'HR': {
        name: 'Human Resources',
        description: 'Employee lifecycle, leave, and payroll execution',
        permissions: {
            "Payroll": { "Dashboard": ["view"], "Payroll Engine": ["view", "run", "submit"], "Payslip Generation": ["view", "generate"], "Payroll Reports": ["view"] },
            "Employees": { "Employee List": ["view", "create", "edit"], "Management": ["view", "edit"] },
            "Leave Management": { "Leave Tracker": ["view"], "Leave Requests": ["view", "approve", "reject"] },
            "Timesheets": { "Dashboard": ["view"], "Management": ["view", "approve", "reject"] }
        }
    },
    'Finance': {
        name: 'Finance Controller',
        description: 'Payroll approvals, bank exports, and financial reporting',
        permissions: {
            "Payroll": { "Dashboard": ["view"], "Payroll Engine": ["view", "approve", "disburse"], "Bank Export": ["view", "export"], "Payroll Reports": ["view", "export"] },
            "Reports": { "Reports Dashboard": ["view", "export"] }
        }
    },
    'Employee': {
        name: 'Standard Employee',
        description: 'Self-service: payslips, leave requests, and timesheets',
        permissions: {
            "My Payslip": { "Payslip View": ["view", "download"] },
            "Timesheets": { "Entry": ["view", "create", "edit"], "History": ["view"] },
            "Leave Management": { "Leave Tracker": ["view"], "Leave Requests": ["view", "create"] }
        }
    },
    'Custom': {
        name: 'Custom Profile',
        description: 'Start from scratch with empty permissions',
        permissions: {}
    }
}

export default function UsersAndRolesTab() {
    const qc = useQueryClient()
    const [roles, setRoles] = React.useState([])
    const [activeRoleIdx, setActiveRoleIdx] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(r => r.data.data),
    })

    React.useEffect(() => {
        if (data?.roles?.length > 0) {
            setRoles(data.roles)
        }
    }, [data])

    const saveMutation = useMutation({
        mutationFn: () => settingsAPI.updateSettings({ roles }),
        onSuccess: () => {
            toast.success('Roles & Permissions synced successfully!')
            qc.invalidateQueries(['settings'])
        },
        onError: e => toast.error(e.response?.data?.message || 'Save failed'),
    })

    const handleAddRole = () => {
        const newRole = {
            name: 'New Custom Role',
            isSystem: false,
            templateType: 'Custom',
            permissions: {}
        }
        setRoles([...roles, newRole])
        setActiveRoleIdx(roles.length)
        toast.success('New custom role added!')
    }

    const handleUpdateRoleName = (index, newName) => {
        const newRoles = [...roles]
        newRoles[index].name = newName
        setRoles(newRoles)
    }

    const handleTogglePermissions = (leaves, status) => {
        const newRoles = [...roles]
        const role = { ...newRoles[activeRoleIdx] }
        const permissions = { ...role.permissions }

        leaves.forEach(([mod, sub, act]) => {
            if (!permissions[mod]) permissions[mod] = {}
            if (!permissions[mod][sub]) permissions[mod][sub] = []
            
            const actions = [...permissions[mod][sub]]
            const idx = actions.indexOf(act)
            
            if (status && idx === -1) {
                actions.push(act)
            } else if (!status && idx > -1) {
                actions.splice(idx, 1)
            }
            
            permissions[mod][sub] = actions

            // Cleanup
            if (permissions[mod][sub].length === 0) delete permissions[mod][sub]
            if (Object.keys(permissions[mod]).length === 0) delete permissions[mod]
        })

        role.permissions = permissions
        role.templateType = 'Custom' // Any manual toggle turns it into custom
        newRoles[activeRoleIdx] = role
        setRoles(newRoles)
    }

    const applyTemplate = (type) => {
        const newRoles = [...roles]
        const role = { ...newRoles[activeRoleIdx] }
        const template = ROLE_TEMPLATES[type]

        if (template.fullAccess) {
            // Fill all
            const allPerms = {}
            Object.entries(PERMISSION_STRUCTURE).forEach(([mod, submodules]) => {
                allPerms[mod] = {}
                Object.entries(submodules).forEach(([sub, actions]) => {
                    allPerms[mod][sub] = [...actions]
                })
            })
            role.permissions = allPerms
        } else {
            role.permissions = JSON.parse(JSON.stringify(template.permissions))
        }

        role.templateType = type
        newRoles[activeRoleIdx] = role
        setRoles(newRoles)
        toast.success(`${type} template applied to ${role.name}`)
    }

    const handleDeleteRole = (index) => {
        if (roles[index].isSystem) {
            toast.error('System roles cannot be deleted')
            return
        }
        const newRoles = roles.filter((_, i) => i !== index)
        setRoles(newRoles)
        setActiveRoleIdx(Math.max(0, index - 1))
    }

    if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>

    const currentRole = roles[activeRoleIdx]

    return (
        <div className="space-y-8 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Access Control</h2>
                    <p className="text-sm text-slate-500 font-medium">Enterprise RBAC with hierarchical module trees</p>
                </div>
                <button
                    onClick={handleAddRole}
                    className="group flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200 transition-all active:scale-95"
                >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Create Custom Role</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                {/* 1. ROLE LIST */}
                <div className="lg:col-span-1 space-y-3 sticky top-24">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 flex items-center gap-2">
                        <Users size={12} />
                        Identity Roles
                    </label>
                    <div className="space-y-1">
                        {roles.map((role, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveRoleIdx(idx)}
                                className={`w-full text-left px-4 py-3 rounded-2xl transition-all ${
                                    activeRoleIdx === idx 
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-[1.02]' 
                                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold truncate">{role.name}</span>
                                    {role.isSystem && <Shield size={12} className={activeRoleIdx === idx ? 'text-indigo-200' : 'text-slate-300'} />}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. PERMISSION TREE */}
                <div className="lg:col-span-3 space-y-6">
                    {currentRole && (
                        <div className="bg-white dark:bg-[#080d14] rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col min-h-[700px]">
                            {/* Header */}
                            <div className="p-6 border-b border-slate-100 dark:border-white/5 space-y-4 bg-slate-50/30 dark:bg-white/[0.02]">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Edit Role Definition</span>
                                                {currentRole.isSystem && <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase">Core System Role</span>}
                                            </div>
                                            <input
                                                value={currentRole.name}
                                                onChange={(e) => handleUpdateRoleName(activeRoleIdx, e.target.value)}
                                                disabled={currentRole.isSystem}
                                                className="w-full text-xl font-black text-slate-800 dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder:text-slate-300"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!currentRole.isSystem && (
                                                <button 
                                                    onClick={() => handleDeleteRole(activeRoleIdx)}
                                                    className="p-3 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-all"
                                                    title="Delete Role"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => saveMutation.mutate()}
                                                disabled={saveMutation.isPending}
                                                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all disabled:opacity-50"
                                            >
                                                {saveMutation.isPending ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" /> : <Save size={16} />}
                                                Sync Updates
                                            </button>
                                        </div>
                                    </div>

                                    {/* Critical Change Alert */}
                                    {Object.values(currentRole.permissions || {}).some(mod => 
                                        Object.values(mod).some(acts => acts.some(a => ['approve', 'run', 'disburse', 'delete'].includes(a)))
                                    ) && !currentRole.isSystem && (
                                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-700/30 flex items-start gap-3 animate-pulse">
                                            <AlertCircle className="text-rose-500 mt-1" size={16} />
                                            <div>
                                                <p className="text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-tight">Critical Permissions Granted</p>
                                                <p className="text-[10px] text-rose-600 dark:text-rose-500 font-medium">This role now has financial or deletion authority. Ensure this is intentional and logged.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Role Templates Selector */}
                                    <div className="pt-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 block">Apply Role Template</label>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            {Object.entries(ROLE_TEMPLATES).map(([type, meta]) => (
                                                <button
                                                    key={type}
                                                    onClick={() => applyTemplate(type)}
                                                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                                                        currentRole.templateType === type
                                                        ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/50 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#080d14]'
                                                        : 'bg-white dark:bg-white/5 border-slate-100 dark:border-white/10 hover:border-indigo-200 dark:hover:border-white/20'
                                                    }`}
                                                >
                                                    <span className={`text-[10px] font-black uppercase ${currentRole.templateType === type ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                                        {type}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 leading-tight mt-1 line-clamp-1">
                                                        {meta.description}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="relative pt-2">
                                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 mt-1" />
                                        <input
                                            type="text"
                                            placeholder="Search permissions (e.g., 'Payroll', 'Approve')..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 focus:border-indigo-300 dark:focus:border-indigo-500/50 rounded-2xl text-sm transition-all focus:ring-0 shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Tree View */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white dark:bg-[#080d14]">
                                <div className="max-w-4xl mx-auto space-y-2">
                                    {Object.entries(PERMISSION_STRUCTURE).map(([moduleName, submodules]) => (
                                        <PermissionTreeNode
                                            key={moduleName}
                                            label={moduleName}
                                            level={0}
                                            children={submodules}
                                            permissions={currentRole.permissions}
                                            path={[moduleName]}
                                            onToggle={handleTogglePermissions}
                                            searchQuery={searchQuery}
                                            isAdmin={currentRole.name === 'Admin'}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. PREVIEW & HISTORY PANEL */}
                <div className="lg:col-span-1 space-y-6 sticky top-24">
                    <div className="bg-white dark:bg-white/5 rounded-[2.5rem] p-6 border border-slate-100 dark:border-white/10 space-y-8 shadow-sm">
                        
                        {/* Access Preview */}
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Access Preview</h3>
                                <p className="text-[10px] text-slate-500">Real-time summary for <b>{currentRole?.name}</b></p>
                            </div>

                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {Object.keys(PERMISSION_STRUCTURE).map(mod => {
                                    const modPerms = currentRole?.permissions?.[mod]
                                    const submodules = Object.keys(modPerms || {})
                                    const hasAccess = submodules.length > 0

                                    return (
                                        <div key={mod} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {hasAccess ? (
                                                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                                                            <Check size={10} className="text-white" strokeWidth={4} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                                                            <X size={10} className="text-slate-400" strokeWidth={4} />
                                                        </div>
                                                    )}
                                                    <span className={`text-[11px] font-bold ${hasAccess ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                                        {mod}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {hasAccess && (
                                                <div className="pl-7 space-y-1.5 border-l-2 border-emerald-100 dark:border-emerald-500/10 ml-2.5">
                                                    {submodules.map(sub => (
                                                        <div key={sub} className="flex items-center gap-1.5">
                                                            <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                                            <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400 truncate">{sub}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {currentRole?.name === 'Admin' && (
                                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                                        <AlertCircle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Master Key</span>
                                    </div>
                                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 leading-relaxed font-medium">
                                        This role bypasses all permission checks with system-wide superuser authority.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Recent History Timeline */}
                        <div className="pt-6 border-t border-slate-100 dark:border-white/5 space-y-6">
                            <div className="space-y-1">
                                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Recent Activity</h3>
                                <p className="text-[10px] text-slate-500">Timeline of changes for this role</p>
                            </div>
                            
                            <RoleTimeline roleName={currentRole?.name} />
                        </div>

                    </div>
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
            `}</style>
        </div>
    )
}

