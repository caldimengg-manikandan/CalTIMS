import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const schema = z.object({ email: z.string().email('Enter a valid email') })

export default function ForgotPasswordPage() {
    const [sent, setSent] = React.useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

    const { mutate, isPending } = useMutation({
        mutationFn: (data) => authAPI.forgotPassword(data),
        onSuccess: () => {
            setSent(true)
            toast.success('Reset link sent to your email')
        },
    })

    if (sent) return (
        <div className="text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Mail size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Check your email</h2>
                <p className="text-slate-500 dark:text-slate-400 px-6">
                    A password recovery link has been dispatched to your corporate email address.
                </p>
            </div>
            <Link to="/login" className="btn-primary w-full justify-center py-3.5 shadow-lg shadow-indigo-600/10">
                Return to Login
            </Link>
        </div>
    )

    return (
        <div className="space-y-10">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Recovery</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">
                    Lost access? Enter your email to begin restoration.
                </p>
            </div>

            <form onSubmit={handleSubmit(mutate)} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="label">Work Email</label>
                    <div className="relative">
                        <input
                            {...register('email')}
                            type="email"
                            className={`input pl-11 ${errors.email ? 'input-error' : ''}`}
                            placeholder="name@company.com"
                        />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    </div>
                    {errors.email && <p className="error-msg">{errors.email.message}</p>}
                </div>

                <button type="submit" disabled={isPending} className="btn-primary w-full justify-center py-3.5 shadow-lg shadow-indigo-600/20">
                    {isPending ? <Spinner size="sm" /> : null}
                    <span className="font-bold tracking-wide">{isPending ? 'Sending...' : 'Send'}</span>
                </button>
            </form>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-900">
                <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-indigo-600 font-bold hover:text-indigo-700 transition-colors">
                    <ArrowLeft size={18} /> Back to login
                </Link>
            </div>
        </div>
    )
}
