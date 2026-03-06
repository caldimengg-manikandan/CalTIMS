import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Timer } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const schema = z.object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

export default function LoginPage() {
    const navigate = useNavigate()
    const { setAuth } = useAuthStore()
    const [showPassword, setShowPassword] = React.useState(false)

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
    })

    const { mutate: login, isPending } = useMutation({
        mutationFn: (data) => authAPI.login(data),
        onSuccess: (res) => {
            const { accessToken, refreshToken, user } = res.data.data
            setAuth(user, accessToken, refreshToken)
            toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
            navigate('/dashboard')
        },
    })

    return (
        <div className="space-y-10">
            <div className="space-y-3">
                <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">Login</h2>
                <div className="h-1.5 w-12 bg-primary-500 rounded-full" />
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                    Enter your professional credentials to access your workspace.
                </p>
            </div>

            <div className="space-y-6">

                <form onSubmit={handleSubmit(login)} className="space-y-5">
                    <div className="space-y-1.5 group/field">
                        <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 group-focus-within/field:text-primary-500 transition-colors">Work Email</label>
                        <input
                            {...register('email')}
                            type="email"
                            className={`input h-12 rounded-2xl bg-white dark:bg-black border-slate-200 dark:border-white/20 text-slate-900 dark:text-white !font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.email ? 'border-red-500' : ''}`}
                            placeholder="name@company.com"
                        />
                        {errors.email && <p className="text-xs text-red-500 font-bold ml-1 mt-1">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-1.5 group/field">
                        <div className="flex justify-between items-center mb-0.5">
                            <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 group-focus-within/field:text-primary-500 transition-colors">Password</label>
                            <Link to="/forgot-password" id="forgot-password-link" className="text-[11px] text-primary-600 hover:text-primary-700 font-black tracking-wider uppercase transition-colors">
                                Forgot?
                            </Link>
                        </div>
                        <div className="relative">
                            <input
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                className={`input h-12 pr-12 rounded-2xl bg-white dark:bg-black border-slate-200 dark:border-white/20 text-slate-900 dark:text-white !font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.password ? 'border-red-500' : ''}`}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {errors.password && <p className="error-msg">{errors.password.message}</p>}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer" />
                        <label htmlFor="remember" className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer select-none">Keep me signed in</label>
                    </div>

                    <button type="submit" disabled={isPending} id="login-submit-btn" className="btn-primary w-full justify-center py-3.5 shadow-lg shadow-indigo-600/20 active:translate-y-[1px]">
                        {isPending ? <Spinner size="sm" /> : <LogIn size={20} />}
                        <span className="font-bold tracking-wide">{isPending ? 'Authenticating...' : 'Sign In to Portal'}</span>
                    </button>
                </form>
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-900">
                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    Need help? <a href="mailto:it-support@TIMS.com" className="text-indigo-600 font-bold hover:underline">Contact IT Support</a>
                </p>
            </div>
        </div>
    )
}
