import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userAPI, roleAPI } from '@/services/endpoints'
import { ArrowLeft, Save, UserPlus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'


export default function EmployeeFormPage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    
    // Fetch dynamic roles
    const { data: rolesData, isLoading: rolesLoading } = useQuery({
        queryKey: ['roles'],
        queryFn: () => roleAPI.getAll()
    })
    const roles = rolesData?.data?.data || []

    const [formData, setFormData] = React.useState({

        name: '',
        email: '',
        password: '',
        role: 'employee',
        department: '',
        designation: '',
        phone: '',
        employeeId: '',
        joinDate: new Date().toISOString().split('T')[0],
        bankName: '',
        accountNumber: '',
        branchName: '',
        ifscCode: '',
        uan: '',
        pan: '',
        aadhaar: '',
        roleId: ''
    })

    const [errors, setErrors] = React.useState({})

    const mutation = useMutation({
        mutationFn: (data) => userAPI.create(data),
        onSuccess: () => {
            toast.success('Employee created successfully')
            queryClient.invalidateQueries(['users'])
            navigate('/employees')
        },
        onError: (error) => {
            const serverErrors = error.response?.data?.errors
            if (serverErrors) {
                setErrors(serverErrors)
            }
            const message = error.response?.data?.message || 'Failed to create employee'
            toast.error(message)
        }
    })

    const validate = () => {
        const newErrors = {}
        if (!formData.name?.trim()) newErrors.name = true
        if (!formData.email?.trim() || !/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = true
        if (!formData.password || formData.password.length < 8) newErrors.password = true
        if (!formData.department?.trim() || formData.department.length > 50) newErrors.department = true
        if (!formData.designation?.trim() || formData.designation.length > 50) newErrors.designation = true
        if (!formData.phone?.trim() || formData.phone.replace(/\D/g, '').length !== 10) newErrors.phone = true
        if (!formData.joinDate) newErrors.joinDate = true
        if (!formData.employeeId?.trim()) newErrors.employeeId = true

        // Bank Details Validation
        if (!formData.bankName?.trim()) newErrors.bankName = true
        if (!formData.accountNumber?.trim() || !/^\d+$/.test(formData.accountNumber)) newErrors.accountNumber = true
        if (!formData.branchName?.trim()) newErrors.branchName = true
        if (!formData.ifscCode?.trim() || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) newErrors.ifscCode = true
        if (!formData.uan?.trim() || !/^\d{12}$/.test(formData.uan)) newErrors.uan = true

        // Personal Details Validation
        if (!formData.pan?.trim() || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)) newErrors.pan = true
        if (!formData.aadhaar?.trim() || !/^\d{12}$/.test(formData.aadhaar)) newErrors.aadhaar = true

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!validate()) {
            toast.error('Please fill all fields correctly')
            return
        }
        if (formData.joinDate && !/^\d{4}-/.test(formData.joinDate)) return toast.error('Joining year must be exactly 4 digits')
        mutation.mutate(formData)
    }

    const handleChange = (e) => {
        let { name, value } = e.target
        
        if (['phone', 'accountNumber', 'uan', 'aadhaar'].includes(name)) {
            value = value.replace(/[^0-9]/g, '')
        }
        
        if (name === 'role') {
            const selectedRole = roles.find(r => r.name.toLowerCase() === value.toLowerCase())
            setFormData(prev => ({ 
                ...prev, 
                role: value,
                roleId: selectedRole?.id || ''
            }))
        } else {
            let finalValue = value;
            if (name === 'joinDate') {
                const parts = value.split('-');
                if (parts[0] && parts[0].length > 4) {
                    parts[0] = parts[0].slice(0, 4);
                    finalValue = parts.join('-');
                }
            }
            setFormData(prev => ({ ...prev, [name]: finalValue }))
        }

        if (errors[name]) {
            setErrors(prev => {
                const updated = { ...prev }
                delete updated[name]
                return updated
            })
        }
    }


    const getInputClass = (name) => {
        return `input ${errors[name] ? 'bg-red-50 border-red-300 ring-red-200' : ''}`
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
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Employee ID *</label>
                        <input name="employeeId" className={getInputClass('employeeId')} placeholder="e.g. EMP001"
                            value={formData.employeeId} onChange={handleChange} />
                        {errors.employeeId && <p className="text-[10px] text-red-500 font-medium">{typeof errors.employeeId === 'string' ? errors.employeeId : ''}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Full Name *</label>
                        <input name="name" className={getInputClass('name')} placeholder="John Doe"
                            value={formData.name} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Email Address *</label>
                        <input name="email" type="email" className={getInputClass('email')} placeholder="john@example.com"
                            value={formData.email} onChange={handleChange} />
                        {errors.email && <p className="text-[10px] text-red-500 font-medium">{typeof errors.email === 'string' ? errors.email : 'Invalid email'}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Password *</label>
                        <input name="password" type="password" className={getInputClass('password')} placeholder="Min 8 characters"
                            value={formData.password} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Role *</label>
                        <div className="relative">
                            <select 
                                name="role" 
                                className={getInputClass('role')} 
                                value={formData.role} 
                                onChange={handleChange}
                                disabled={rolesLoading}
                            >
                                <option value="">Select Role</option>
                                {roles
                                    .filter(r => r.name.toLowerCase() !== 'super_admin' && r.name.toLowerCase() !== 'super admin')
                                    .map(r => (
                                        <option key={r.id} value={r.name.toLowerCase()}>{r.name}</option>
                                    ))
                                }
                            </select>
                            {rolesLoading && (
                                <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                            )}
                        </div>
                    </div>


                    {/* Workplace Info */}
                    <div className="space-y-4 md:col-span-2 pt-2 pb-2 border-b border-slate-50 dark:border-white">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Workplace Details</h3>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Department *</label>
                        <input name="department" className={getInputClass('department')} placeholder="Engineering, Design, etc."
                            value={formData.department} onChange={handleChange} maxLength={50} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Designation *</label>
                        <input name="designation" className={getInputClass('designation')} placeholder="Software Engineer"
                            value={formData.designation} onChange={handleChange} maxLength={50} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Phone Number *</label>
                        <input name="phone" className={getInputClass('phone')} placeholder="1234567890"
                            value={formData.phone} onChange={handleChange} maxLength={10} 
                            onInput={(e) => {
                                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                            }}
                        />
                        {errors.phone && <p className="text-[10px] text-red-500 font-medium">{typeof errors.phone === 'string' ? errors.phone : 'Invalid phone number'}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Joining Date *</label>
                        <input name="joinDate" type="date" max="9999-12-31" className={getInputClass('joinDate')}
                            value={formData.joinDate} onChange={handleChange} />
                    </div>

                    {/* Bank Details */}
                    <div className="space-y-4 md:col-span-2 pt-2 pb-2 border-b border-slate-50 dark:border-white">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Bank Details</h3>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Bank Name *</label>
                        <input name="bankName" className={getInputClass('bankName')} placeholder="e.g. HDFC Bank"
                            value={formData.bankName} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Account Number *</label>
                        <input name="accountNumber" className={getInputClass('accountNumber')} placeholder="Numeric only"
                            value={formData.accountNumber} onChange={handleChange} maxLength={18} 
                            onInput={(e) => {
                                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                            }}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Branch Name *</label>
                        <input name="branchName" className={getInputClass('branchName')} placeholder="e.g. Mumbai"
                            value={formData.branchName} onChange={handleChange} />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">IFSC Code *</label>
                        <input name="ifscCode" className={getInputClass('ifscCode')} placeholder="e.g. HDFC0001234"
                            value={formData.ifscCode} onChange={handleChange} maxLength={11} />
                        {errors.ifscCode && <p className="text-[10px] text-red-500 font-medium">{typeof errors.ifscCode === 'string' ? errors.ifscCode : 'Invalid IFSC Code'}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">UAN Number *</label>
                        <input name="uan" className={getInputClass('uan')} placeholder="e.g. 123456789012"
                            value={formData.uan} onChange={handleChange} maxLength={12} 
                            onInput={(e) => {
                                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                            }}
                        />
                        {errors.uan && <p className="text-[10px] text-red-500 font-medium">{typeof errors.uan === 'string' ? errors.uan : 'Invalid UAN Number'}</p>}
                    </div>

                    {/* Personal Details */}
                    <div className="space-y-4 md:col-span-2 pt-2 pb-2 border-b border-slate-50 dark:border-white">
                        <h3 className="font-semibold text-slate-800 dark:text-white">Personal Details</h3>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">PAN Number *</label>
                        <input name="pan" className={getInputClass('pan')} placeholder="e.g. ABCDE1234F"
                            value={formData.pan} onChange={handleChange} maxLength={10} />
                        {errors.pan && <p className="text-[10px] text-red-500 font-medium">{typeof errors.pan === 'string' ? errors.pan : 'Invalid PAN Number'}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-white">Aadhaar Number *</label>
                        <input name="aadhaar" className={getInputClass('aadhaar')} placeholder="12 digit number"
                            value={formData.aadhaar} onChange={handleChange} maxLength={12} 
                            onInput={(e) => {
                                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                            }}
                        />
                        {errors.aadhaar && <p className="text-[10px] text-red-500 font-medium">{typeof errors.aadhaar === 'string' ? errors.aadhaar : 'Invalid Aadhaar Number'}</p>}
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                    <Link to="/employees" className="btn-secondary">Cancel</Link>
                    <button type="submit" disabled={mutation.isPending} className="btn-primary min-w-[120px]">
                        {mutation.isPending ? 'Saving...' : (
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
