import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ChevronRight, Mail, Lock } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const schema = z.object({
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
})

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
)




export default function LoginPage() {
    const navigate = useNavigate()
    const { setAuth } = useAuthStore()
    const [showPassword, setShowPassword] = React.useState(false)

    const { register, handleSubmit, setError, formState: { errors } } = useForm({
        resolver: zodResolver(schema),
    })

    const { mutate: login, isPending } = useMutation({
        mutationFn: (data) => authAPI.login(data),
        onSuccess: (res) => {
            const { accessToken, refreshToken, user, subscription } = res.data.data
            setAuth(user, accessToken, refreshToken, subscription)
            toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
            
            // Redirect logic is handled by ProtectedRoute, but we can nudge it
            const target = user.role === 'super_admin' ? '/admin/dashboard' : '/dashboard'
            navigate(target, { replace: true })
        },
        onError: (err) => {
            const status = err.response?.status
            const message = err.response?.data?.message || 'Connection failed. Please check your network or try again later.'
            
            toast.error(message, { id: 'login-error' })
            
            if (status === 401 || status === 400) {
                setError('email', { type: 'manual', message: 'Incorrect email' })
                setError('password', { type: 'manual', message: 'Incorrect password' })
            } else if (status === 500) {
                toast.error('System error. Please contact administrator.', { id: 'system-error' })
            }
        }
    })




    const handleSocialLogin = () => {
        // Standard OAuth redirect to backend for Google
        window.location.href = `${window.location.origin}${import.meta.env.BASE_URL}api/v1/auth/google`
    }

    return (
        <div className="w-full">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm"
            >
                <div className="space-y-6">
                    <div className="space-y-2 text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Please enter your details to sign in.</p>
                    </div>

                    <div className="space-y-4">
                        <button 
                            type="button"
                            onClick={handleSocialLogin}
                            className="w-full h-11 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
                        >
                            <GoogleIcon />
                            <span>Continue with Google</span>
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                            <span className="flex-shrink mx-4 text-xs font-medium text-slate-400 dark:text-slate-500">or sign in with email</span>
                            <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit(login)} className="space-y-5">
                        <div className="space-y-1.5 group">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Email address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                                <input
                                    {...register('email')}
                                    type="email"
                                    className={`w-full h-11 pl-10 pr-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                                    placeholder="name@company.com"
                                />
                            </div>
                            {errors.email && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-1.5 group">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                                <Link to="/forgot-password" size={16} className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--color-primary)] transition-colors" size={18} />
                                <input
                                    {...register('password')}
                                    type={showPassword ? 'text' : 'password'}
                                    className={`w-full h-11 pl-10 pr-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-all outline-none ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : ''}`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors z-10 p-1"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            {errors.password && <p className="text-xs text-red-500 font-medium ml-1 mt-1">{errors.password.message}</p>}
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full h-11 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isPending ? <Spinner size="sm" color="white" /> : (
                                    <span>Sign in</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
            
            <div className="mt-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    Don't have an account?{' '}
                    <Link to="/signup" className="text-slate-900 dark:text-white hover:text-[var(--color-primary)] transition-colors font-bold">Sign up</Link>
                </p>
            </div>
        </div>
    )
}
