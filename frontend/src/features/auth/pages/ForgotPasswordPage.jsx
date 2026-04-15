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
import { motion } from 'framer-motion'

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
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center space-y-6"
        >
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
                <Mail size={32} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Check your email</h2>
                <p className="text-slate-500 dark:text-slate-400 px-6">
                    A password recovery link has been dispatched to your corporate email address.
                </p>
            </div>
            <Link to="/login" className="btn-primary w-full justify-center py-3.5 shadow-lg shadow-[var(--color-primary)]/10">
                Return to Login
            </Link>
        </motion.div>
    )

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-8"
        >
            <div className="space-y-2 text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Recovery</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                    Lost access? Enter your email to begin restoration.
                </p>
            </div>

            <form onSubmit={handleSubmit(mutate)} className="space-y-6">
                <div className="space-y-1.5 group">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Work Email</label>
                    <div className="relative">
                        <input
                            {...register('email')}
                            type="email"
                            className={`w-full h-11 pl-11 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.email ? 'border-red-500' : ''}`}
                            placeholder="name@company.com"
                        />
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                    </div>
                    {errors.email && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.email.message}</p>}
                </div>

                <button type="submit" disabled={isPending} className="btn-primary w-full justify-center py-3 shadow-lg shadow-[var(--color-primary)]/20">
                    {isPending ? <Spinner size="sm" /> : null}
                    <span className="font-bold tracking-wide">{isPending ? 'Sending...' : 'Send reset link'}</span>
                </button>
            </form>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-[var(--color-primary)] font-bold hover:text-[var(--color-primary-hover)] transition-colors">
                    <ArrowLeft size={18} /> Back to login
                </Link>
            </div>
        </motion.div>
    )
}
