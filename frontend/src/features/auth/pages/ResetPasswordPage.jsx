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
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-8"
        >
            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Security</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Reset your credentials. Choose a secure phrase.
                </p>
            </div>

            <form onSubmit={handleSubmit(mutate)} className="space-y-6">
                <div className="space-y-4">
                    <div className="space-y-1.5 group">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">New password</label>
                        <div className="relative">
                            <input 
                                {...register('password')} 
                                type={show ? 'text' : 'password'}
                                className={`w-full h-11 pl-4 pr-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.password ? 'border-red-500' : ''}`}
                                placeholder="••••••••" 
                            />
                            <button 
                                type="button" 
                                onClick={() => setShow(!show)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                {show ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {errors.password && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-1.5 group">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Confirm password</label>
                        <input 
                            {...register('confirm')} 
                            type={show ? 'text' : 'password'}
                            className={`w-full h-11 px-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.confirm ? 'border-red-500' : ''}`}
                            placeholder="••••••••" 
                        />
                        {errors.confirm && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.confirm.message}</p>}
                    </div>
                </div>

                <button type="submit" disabled={isPending} className="btn-primary w-full justify-center py-3 shadow-lg shadow-[var(--color-primary)]/20">
                    {isPending ? <Spinner size="sm" /> : null}
                    <span className="font-bold tracking-wide">{isPending ? 'Finalizing...' : 'Revise Credentials'}</span>
                </button>
            </form>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-[var(--color-primary)] font-bold hover:text-[var(--color-primary-hover)] transition-colors">
                    <ArrowLeft size={18} /> Abort and return to login
                </Link>
            </div>
        </motion.div>
    )
}
