import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, UserPlus, ChevronRight, Mail, Lock, Building2, User, Phone } from 'lucide-react'
import { authAPI } from '@/services/endpoints'
import { useAuthStore } from '@/store/authStore'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name is required'),
  organizationName: z.string().min(2, 'Organization name is required'),
  phoneNumber: z.string().length(10, 'Phone number must be 10 digits').regex(/^\d+$/, 'Only digits allowed'),
})

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
)

const MicrosoftIcon = () => (
    <svg width="20" height="20" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
        <path fill="#f3f3f3" d="M0 0h23v23H0z" />
        <path fill="#f35325" d="M1 1h10v10H1z" />
        <path fill="#81bc06" d="M12 1h10v10H12z" />
        <path fill="#05a6f0" d="M1 12h10v10H1z" />
        <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
)

export default function SignupPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = React.useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  const { mutate: signup, isPending } = useMutation({
    mutationFn: (data) => authAPI.register(data),
    onSuccess: (res) => {
      const { accessToken, refreshToken, user } = res.data.data
      setAuth(user, accessToken, refreshToken)
      toast.success('Account created! Welcome to CalTIMS.')
      navigate('/dashboard', { replace: true })
    },
    onError: (err) => {
      const message = err.response?.data?.message || 'Registration failed. Please try again.'
      toast.error(message)
    }
  })

  const { mutate: socialLogin, isPending: isSocialPending } = useMutation({
    mutationFn: (data) => authAPI.socialLogin(data),
    onSuccess: (res) => {
        const { accessToken, refreshToken, user } = res.data.data
        setAuth(user, accessToken, refreshToken)
        toast.success(`Authenticated with ${user.provider}!`)
        navigate('/onboarding', { replace: true })
    },
    onError: (err) => {
        const message = err.response?.data?.message || 'Social login failed'
        toast.error(message)
    }
  })

  const handleSocialLogin = (provider) => {
    socialLogin({ 
        email: `demo_${provider}_new@example.com`, 
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`,
        provider 
    })
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-10"
      >
        <div className="space-y-6 text-center lg:text-left">
          <div className="space-y-3">
            <h2 className="text-5xl font-black text-slate-800 dark:text-white tracking-tight">Join CalTIMS</h2>
            <div className="h-2 w-16 bg-primary-600 rounded-full mx-auto lg:ml-1" />
          </div>
          <div className="flex gap-5 justify-center lg:justify-start mt-6">
            <button 
                type="button"
                onClick={() => handleSocialLogin('google')}
                disabled={isSocialPending}
                className="w-14 h-14 rounded-full border-2 border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95 shadow-md disabled:opacity-50"
            >
                <GoogleIcon />
            </button>
            {/* <button 
                type="button"
                onClick={() => handleSocialLogin('microsoft')}
                disabled={isSocialPending}
                className="w-14 h-14 rounded-full border-2 border-slate-200 dark:border-white/10 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95 shadow-md disabled:opacity-50"
            >
                <MicrosoftIcon />
            </button> */}
          </div>
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-4">or create a work account</p>
        </div>

        <form onSubmit={handleSubmit(signup)} className="space-y-5">
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2 group">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input
                  {...register('name')}
                  className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 font-bold ml-2">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 group">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Organization Name</label>
              <div className="relative">
                <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input
                  {...register('organizationName')}
                  className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.organizationName ? 'border-red-500' : ''}`}
                  placeholder="Company Name"
                />
              </div>
              {errors.organizationName && <p className="text-xs text-red-500 font-bold ml-2">{errors.organizationName.message}</p>}
            </div>

            <div className="space-y-2 group">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                <input
                  {...register('phoneNumber')}
                  maxLength={10}
                  onInput={(e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                  }}
                  className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.phoneNumber ? 'border-red-500' : ''}`}
                  placeholder="10-digit number"
                />
              </div>
              {errors.phoneNumber && <p className="text-xs text-red-500 font-bold ml-2">{errors.phoneNumber.message}</p>}
            </div>
          </div>

          <div className="space-y-2 group">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
              <input
                {...register('email')}
                type="email"
                className={`w-full h-14 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.email ? 'border-red-500' : ''}`}
                placeholder="name@company.com"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 font-bold ml-2">{errors.email.message}</p>}
          </div>

          <div className="space-y-2 group">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                className={`w-full h-14 pl-12 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 transition-all ${errors.password ? 'border-red-500' : ''}`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 font-bold ml-2">{errors.password.message}</p>}
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="w-full h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {isPending ? <Spinner size="sm" color="white" /> : (
                <>
                  <span>Create Account</span>
                  <ChevronRight size={20} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="text-center">
          <p className="text-sm font-medium text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-bold hover:underline">Sign In</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
