import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { userAPI } from '@/services/endpoints'
import { ArrowLeft, Save, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function EmployeeFormPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [formData, setFormData] = React.useState({
        name: '',
        email: '',
        password: '',
        role: 'employee',
        department: '',
        designation: '',
        phone: '',
        joinDate: new Date().toISOString().split('T')[0]
    })

    const mutation = useMutation({
        mutationFn: (data) => userAPI.create(data),
        onSuccess: () => {
            toast.success('Employee created successfully')
            queryClient.invalidateQueries(['users'])
            navigate('/employees')
        },
        onError: (error) => {
            const message = error.response?.data?.message || 'Failed to create employee'
            toast.error(message)
        }
    })

    const handleSubmit = (e) => {
        e.preventDefault()
        mutation.mutate(formData)
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    return (
        <div className="space-y-6 animate-fade-in max-w-2xl">
            <div className="flex items-center justify-between">
                <Link to="/employees" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                    <ArrowLeft size={16} /> Back to Employees
                </Link>
            </div>

            <div className="page-header">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-lg shadow-primary-200">
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Add New Employee</h1>
                        <p className="text-slate-500 text-sm">Create a new user account for the system</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="card space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Basic Info */}
                    <div className="space-y-4 md:col-span-2 pb-2 border-b border-slate-50 dark:border-white">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Basic Information</h3>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Full Name *</label>
                        <input name="name" required className="input" placeholder="John Doe"
                            value={formData.name} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Email Address *</label>
                        <input name="email" type="email" required className="input" placeholder="john@example.com"
                            value={formData.email} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Password *</label>
                        <input name="password" type="password" required className="input" placeholder="Min 8 characters"
                            value={formData.password} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Role *</label>
                        <select name="role" className="input" value={formData.role} onChange={handleChange}>
                            <option value="employee">Employee</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    {/* Workplace Info */}
                    <div className="space-y-4 md:col-span-2 pt-2 pb-2 border-b border-slate-50 dark:border-white">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Workplace Details</h3>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Department</label>
                        <input name="department" className="input" placeholder="Engineering, Design, etc."
                            value={formData.department} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Designation</label>
                        <input name="designation" className="input" placeholder="Software Engineer"
                            value={formData.designation} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Phone Number</label>
                        <input name="phone" className="input" placeholder="+1 234 567 890"
                            value={formData.phone} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Joining Date</label>
                        <input name="joinDate" type="date" className="input"
                            value={formData.joinDate} onChange={handleChange} />
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                    <Link to="/employees" className="btn-secondary">Cancel</Link>
                    <button type="submit" disabled={mutation.isLoading} className="btn-primary min-w-[120px]">
                        {mutation.isLoading ? 'Saving...' : (
                            <>
                                <Save size={18} /> Save Employee
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
