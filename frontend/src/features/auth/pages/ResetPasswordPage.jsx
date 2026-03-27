import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const schema = z.object({
    password: z.string().min(8, 'Minimum 8 characters'),
    confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords don't match", path: ['confirm'] })

export default function ResetPasswordPage() {
    const { token } = useParams()
    const navigate = useNavigate()
    const [show, setShow] = React.useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

    const { mutate, isPending } = useMutation({
        mutationFn: (data) => authAPI.resetPassword(token, { password: data.password, confirmPassword: data.confirm }),
        onSuccess: () => {
            toast.success('Password reset successfully!')
            navigate('/login')
        },
    })

    return (
        <div className="space-y-10">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Security</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                    Reset your credentials. Choose a secure phrase.
                </p>
            </div>

            <form onSubmit={handleSubmit(mutate)} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="label">New password</label>
                        <div className="relative">
                            <input 
                                {...register('password')} 
                                type={show ? 'text' : 'password'}
                                className={`input pr-12 ${errors.password ? 'input-error' : ''}`} 
                                placeholder="••••••••" 
                            />
                            <button 
                                type="button" 
                                onClick={() => setShow(!show)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {show ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {errors.password && <p className="error-msg">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <label className="label">Confirm password</label>
                        <input 
                            {...register('confirm')} 
                            type={show ? 'text' : 'password'}
                            className={`input ${errors.confirm ? 'input-error' : ''}`} 
                            placeholder="••••••••" 
                        />
                        {errors.confirm && <p className="error-msg">{errors.confirm.message}</p>}
                    </div>
                </div>

                <button type="submit" disabled={isPending} className="btn-primary w-full justify-center py-3.5 shadow-lg shadow-primary/20">
                    {isPending ? <Spinner size="sm" /> : null}
                    <span className="font-bold tracking-wide">{isPending ? 'Finalizing...' : 'Revise Credentials'}</span>
                </button>
            </form>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-900">
                <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-primary font-bold hover:text-primary-700 transition-colors">
                    <ArrowLeft size={18} /> Abort and return to login
                </Link>
            </div>
        </div>
    )
}
