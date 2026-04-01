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
            const message = err.response?.data?.message || 'Invalid email or password'
            toast.error(message, { id: message })
            setError('email', { type: 'manual', message: 'Incorrect email' })
            setError('password', { type: 'manual', message: 'Incorrect password' })
        }
    })




    const handleSocialLogin = () => {
        // Standard OAuth redirect to backend for Google
        window.location.href = '/api/v1/auth/google'
    }

    return (
        <div className="w-full max-w-xl mx-auto space-y-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-10"
            >
                <div className="space-y-8">
                    <div className="space-y-3">
                        <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">Sign In</h2>
                        <div className="h-2 w-16 btn-primary rounded-full" />
                    </div>

                    <div className="space-y-6">
                        <button 
                            type="button"
                            onClick={handleSocialLogin}
                            className="w-full h-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-xl shadow-primary-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-70 group"
                        >
                            <div className="bg-white p-1.5 rounded-lg">
                                <GoogleIcon />
                            </div>
                            <span>Continue with Google</span>
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
                            <span className="flex-shrink mx-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] relative top-[1px]">OR USE YOUR WORK ACCOUNT</span>
                            <div className="flex-grow border-t border-slate-200 dark:border-white/10"></div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit(login)} className="space-y-6">
                    <div className="space-y-2 group">
                        <label className="block text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-primary-500 transition-colors">Work Email</label>
                        <div className="relative">
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                            <input
                                {...register('email')}
                                type="email"
                                className={`w-full h-16 pl-14 pr-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl text-base font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 transition-all ${errors.email ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}
                                placeholder="name@company.com"
                            />
                        </div>
                        {errors.email && <p className="text-xs text-red-500 font-bold ml-2 mt-1">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2 group">
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 group-focus-within:text-primary-500 transition-colors">Password</label>
                            <Link to="/forgot-password" size={16} className="text-xs font-black text-primary hover:text-primary-700 uppercase tracking-wider transition-colors">
                                Forgot?
                            </Link>
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={20} />
                            <input
                                {...register('password')}
                                type={showPassword ? 'text' : 'password'}
                                className={`w-full h-16 pl-14 pr-14 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl text-base font-bold placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 transition-all ${errors.password ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {errors.password && <p className="text-xs text-red-500 font-bold ml-2 mt-1">{errors.password.message}</p>}
                    </div>

                    <div className="pt-6">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="w-full h-16 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl font-black text-base uppercase tracking-widest shadow-xl shadow-primary-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-70"
                        >
                            {isPending ? <Spinner size="sm" color="white" /> : (
                                <>
                                    <span>Sign In to Portal</span>
                                    <ChevronRight size={22} />
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 text-center space-y-4">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        New organization? <Link to="/signup" className="text-primary-600 font-bold hover:underline">Start 28-day free trial</Link>
                    </p>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 italic">
                        Securing workforce productivity in real-time.
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
